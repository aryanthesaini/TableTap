# Architecture & Decisions

TableTap is a multi-tenant QR ordering SaaS for restaurants, built as a **modular monolith**:
one Spring Boot service with a Next.js web app in front of it and PostgreSQL behind it.

```
 Browser ──► Next.js (3000) ──/api/*, /files/*──► Spring Boot (8080) ──► PostgreSQL
   │  customer storefront (/r/{slug}/t/{token})
   │  restaurant dashboard (/dashboard/*)
   └─ platform admin (/admin/*)
```

The Next.js server proxies `/api/*` and `/files/*` to the backend, so the browser sees one
origin. That means there is no CORS to configure, and QR URLs only need one public base URL.

## Backend modules (`com.platform.*`)

| Module         | Owns                                                                 | Depends on |
|----------------|----------------------------------------------------------------------|------------|
| `common`       | errors, paging, security plumbing (`CurrentUser`), file storage, config | –        |
| `auth`         | `AppUser`, login, JWT issuing, demo accounts                         | restaurant |
| `restaurant`   | `Restaurant`, profile/settings, operating status, admin status changes | common  |
| `menu`         | `MenuCategory`, `MenuItem`, ordering, availability                    | restaurant |
| `table`        | `RestaurantTable`, QR tokens                                          | restaurant |
| `payment`      | `Payment`, `PaymentConfiguration`, `PaymentProvider` (+ mock gateway), webhooks | restaurant |
| `order`        | `CheckoutSession`, `CustomerOrder`, `OrderItem`, public storefront + checkout | restaurant, menu, table, payment |
| `menuai`       | `MenuUpload`, `MenuDraftItem`, `MenuExtractionProvider`               | menu       |
| `analytics`    | dashboard + platform statistics (read-only queries)                   | order, restaurant |
| `notification` | `NotificationProvider`; listens to order events                        | order (events only) |

Rules:
- Request flow: Controller → Service interface → Service implementation → Repository.
- Controllers only accept and return DTOs (Java records). Entities never leave the service layer.
- Dependencies point one way only, so there are no cycles. **Payment never imports order.** Order calls
  `PaymentService`. Payment announces outcomes with Spring events (`PaymentCapturedEvent`),
  and the order module listens for them.

## Multi-tenancy

- Every tenant-owned table has a `restaurant_id`. Every restaurant-scoped query filters by it,
  for example `findByIdAndRestaurantId`.
- `restaurantId` is **never** read from the request path or body on authenticated endpoints. It always comes
  from the JWT (`CurrentUser.requireRestaurantId()`). Asking for another tenant's resource returns `404`.
- Public (customer) endpoints resolve the tenant from the unguessable table QR token. The URL slug
  must also match the token's restaurant.

## API surface (`/api/v1`)

| Prefix                    | Audience                         | Auth                    |
|---------------------------|----------------------------------|-------------------------|
| `/auth/*`                 | login, current user              | public / JWT            |
| `/public/*`               | customer storefront & checkout   | none (table token)      |
| `/restaurant/*`           | owner & staff dashboard          | JWT, `OWNER` / `STAFF`  |
| `/admin/*`                | platform admin                   | JWT, `PLATFORM_ADMIN`   |
| `/webhooks/payments/*`    | payment provider callbacks       | provider signature      |

Successful responses return the resource DTO directly. Lists return `PageResponse<T>`. All errors use
one shape: `{ status, code, message, path, timestamp, fieldErrors[] }`.
OpenAPI docs: `http://localhost:8080/swagger-ui.html`.

## Checkout & payment flow (designed to match Razorpay)

```
customer           Next.js            backend (order)          backend (payment)         provider (mock)
  │ Pay ₹X ───────────►│ POST /public/checkout ─► price cart server-side
  │                    │                       ─► CheckoutSession(OPEN)
  │                    │                       ─► PaymentService.initiate ─► Payment(CREATED) ─► createOrder()
  │                    │◄── {checkoutId, providerOrderId, keyId, amount}
  │ mock gateway sheet │ POST /public/mock-gateway/{providerOrderId}/authorize {SUCCESS|FAILURE|TIMEOUT}
  │                    │◄── {paymentId, orderId, signature}     (what Razorpay Checkout hands the browser)
  │                    │ POST /public/checkout/{id}/confirm {paymentId, orderId, signature}
  │                    │                       ─► PaymentService.verifyAndCapture
  │                    │                              verify HMAC signature with restaurant's secret
  │                    │                              fetch payment status from provider (source of truth)
  │                    │                              Payment → CAPTURED, publish PaymentCapturedEvent
  │                    │                       ◄─ OrderPlacementService (listener) creates CustomerOrder(PENDING)
  │◄── order number ───│
                         the provider also sends a signed webhook (async) → same idempotent capture path
```

- The frontend only passes along what the gateway gave it. The backend decides success by checking the
  signature **and** asking the provider for the payment status.
- **No `CustomerOrder` exists until payment is captured.** The priced cart lives in `checkout_session`.
  Capture is idempotent: the confirm call and the webhook can arrive in either order, or both.
- Timeout: the payment stays `PENDING`. A scheduled sweeper marks stale `CREATED`/`PENDING`
  payments `FAILED` after `app.payments.pending-timeout`.
- Switching to real Razorpay means writing `RazorpayPaymentProvider implements PaymentProvider` and
  setting `app.payments.provider=razorpay`. The order module stays unchanged.

## Integration seams

| Interface                 | MVP implementation             | Swap for                       |
|---------------------------|--------------------------------|--------------------------------|
| `PaymentProvider`         | `MockPaymentProvider`          | Razorpay Orders API            |
| `MenuExtractionProvider`  | `MockMenuExtractionProvider`   | LLM / vision model             |
| `FileStorageProvider`     | `LocalFileStorageProvider`     | S3 / GCS                       |
| `NotificationProvider`    | `MockNotificationProvider`     | WhatsApp / SMS / push          |

## Database

- PostgreSQL, Flyway migrations: `db/migration` holds the schema, and `db/demo` holds demo seed data. The seed data
  is enabled by the `demo` profile and is never shipped to production.
- UUID primary keys (`gen_random_uuid()`). Enumerations are `varchar` + `CHECK` constraints, which map
  cleanly to `@Enumerated(STRING)`.
- Money is `numeric(12,2)` ↔ `BigDecimal`.
- Soft delete (`deleted_at`) on menu categories, menu items and tables, because orders reference them.
  Order items also snapshot name and price, so history never changes.
- `RestaurantUser` from the brief is implemented as `app_user`. It also stores platform admins, with
  `restaurant_id IS NULL`, enforced by a CHECK constraint.

## Authentication

Real Spring Security with stateless HS256 JWTs (Spring's `oauth2-resource-server` + Nimbus) and
BCrypt passwords. The "mock" part is only that users are seeded and the login page offers one-click demo
accounts. Moving to an external IdP only means changing the `JwtDecoder` configuration.

Roles: `OWNER` (everything in their restaurant), `STAFF` (overview, orders, tables view/QR download,
menu availability toggle), `PLATFORM_ADMIN` (`/admin`).

## Assumptions (simplest reasonable interpretation)

1. Prices are tax-exclusive. Tax is a single restaurant-level rate (e.g. GST 5%).
2. Each checkout = one order = one payment. A table can have many orders.
3. Order status is `PENDING → SERVED` only. Refund status exists in the model but has no UI in the MVP.
4. A suspended restaurant (platform admin) cannot take orders, and its users cannot log in.
   A restaurant "closed" by its owner shows the menu but blocks checkout.
5. Staff may toggle item availability (kitchen runs out of an item) but cannot edit the menu.
6. The cart lives in the browser (localStorage, per table) until checkout. Everything that happens
   at or after checkout is server-side.
7. Demo seed orders are generated relative to migration time. Reset the DB to refresh "today" data.
8. Seed food photos come from TheMealDB (demo use only). Items without photos show a typographic placeholder.
