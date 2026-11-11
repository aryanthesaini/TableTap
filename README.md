# TableTap: QR ordering for restaurants

TableTap is a multi-tenant SaaS for restaurants. Guests scan the QR code on their table, browse the menu
on their phone, and pay online with no app or account. The order then lands in the restaurant's dashboard.
Every restaurant has its own menu, tables, orders and its own Razorpay merchant account.

This repository contains the MVP. Payments, AI menu extraction, file storage and notifications are simulated
behind interfaces, and everything else runs for real: Spring Boot, PostgreSQL, JWT auth and tenant isolation.

```
backend/    Spring Boot 3 · Java 21 · PostgreSQL · Flyway   (modular monolith, com.platform.*)
frontend/   Next.js 14 · TypeScript · Tailwind · Radix (shadcn-style) · TanStack Query
docs/       ARCHITECTURE.md · API.md · openapi.json
```

---

## Quick start

### Option A: Docker Compose (Postgres + API + web)

```bash
docker compose up --build
```

- Web app: http://localhost:3000
- API docs (Swagger UI): http://localhost:8080/swagger-ui.html

To scan QR codes from a real phone on your Wi-Fi, set the public URL that the codes point to:
`APP_PUBLIC_BASE_URL=http://<your-LAN-IP>:3000 docker compose up --build`.

### Option B: run locally without Docker

Requirements: **Java 21**, **Maven 3.6+**, **Node 18.18+** (20 recommended). No PostgreSQL install is needed:
the dev launcher starts a real embedded PostgreSQL 16.

```bash
# Terminal 1: API on :8080, with embedded Postgres (data persists in backend/data/postgres)
cd backend
./run-local.sh

# Terminal 2: web app on :3000 (proxies /api and /files to :8080)
cd frontend
npm install
npm run dev
```

To use your own PostgreSQL instead, run `mvn spring-boot:run` with `DB_URL`, `DB_USERNAME` and
`DB_PASSWORD` set.
**To reset the demo data**, stop the backend and delete `backend/data/`.

## Demo accounts

All accounts use the password **`demo1234`**. The login page also lists them for one-click sign-in.

| Restaurant | Owner | Staff |
|---|---|---|
| Saffron Table (New Delhi, North Indian) | `owner@saffrontable.in` | `staff@saffrontable.in` |
| Coastal Curry Co. (Mumbai, seafood) | `owner@coastalcurry.in` | `staff@coastalcurry.in` |
| Wok & Tandoor (Bengaluru, Indo-Chinese) | `owner@wokandtandoor.in` | `staff@wokandtandoor.in` |
| **Platform admin** | `admin@tabletap.dev` | |

Seed data per restaurant: about 30 menu items in 6 categories (a few sold out), 10 tables (Saffron's Table 10
is inactive), roughly 75–110 paid orders over the last 7 days including some still pending, a few failed payments,
and a test-mode payment configuration.

## A 5-minute demo

1. **Sign in** as `owner@saffrontable.in`. The overview shows today's orders, revenue, pending orders and table activity.
2. **Tables & QR codes**: click any QR code to preview it, download a printable table card, or **Open ordering page**.
3. **Order as a guest.** Open the ordering page at phone width (DevTools → device mode). Add dishes, add a kitchen note,
   tap **Pay**, and in the test gateway sheet choose **Pay** for success. You can also try **Payment fails** or **Bank times out**.
4. Back in **Orders**, the new order is waiting under *Pending*, and a "New order received" toast appears on any dashboard page.
   Click **Served**. The guest's confirmation page updates to "Served" on its own.
5. **Menu**: toggle an item's availability off. The guest menu now shows it as *Sold out* and checkout rejects it.
6. **AI menu upload** → **Try a sample menu**. Review the extracted items: amber fields need a check, and one item has no price.
   Fix them, then **Publish**. The items appear on the live menu.
7. **Payments** shows captured and failed transactions. **Settings** holds restaurant details and the merchant-account connection.
8. Sign in as **staff** (`staff@saffrontable.in`). Payments and AI upload are hidden, and menu editing is limited to availability.
9. Sign in as **admin** (`admin@tabletap.dev`) to see platform stats. **Suspend** a restaurant: its team can't sign in
   and its guests can't order. Then **Activate** it again.
10. Sign in as another restaurant's owner. None of Saffron Table's data is visible.

## Architecture in brief

The full write-up, including module boundaries, the payment sequence diagram, data model notes and assumptions,
is in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

- **Modular monolith**: `auth`, `restaurant`, `menu`, `table`, `order`, `payment`, `menuai`, `analytics`, `notification`, `common`.
  Requests flow Controller → Service interface → implementation → Repository. Controllers only ever see DTOs.
  Modules don't form cycles: payment never imports order, and the two communicate through Spring events.
- **Tenant isolation**: the restaurant id always comes from the verified JWT, and every query is scoped by
  `restaurant_id`. Customer endpoints are scoped by an unguessable table QR token, and the URL slug must match it.
- **Payments ("never trust the browser")**: the cart is priced server-side into a `checkout_session`.
  The provider order is created with the restaurant's own keys. The browser only forwards the gateway's
  `payment_id + signature`; the backend verifies the HMAC **and** asks the provider for the payment status.
  An order is created only when the payment is captured, idempotently, so a webhook arriving first or twice is safe.
  Stale payments time out through a scheduled job.
- **Replaceable integrations**: `PaymentProvider` (mock Razorpay), `MenuExtractionProvider` (mock AI),
  `FileStorageProvider` (local disk), and `NotificationProvider` (log output).

### Going to production: what to replace

| Concern | Do this |
|---|---|
| Real Razorpay | Implement `RazorpayPaymentProvider implements PaymentProvider` (Orders API, `/payments/{id}`, `/orders/{id}/payments`, signature checks) and set `app.payments.provider=razorpay`. In the web app, replace `MockGatewaySheet` / `payWithMockGateway` with Razorpay Checkout.js; the handler already forwards the same three fields. |
| Real AI extraction | Implement `MenuExtractionProvider`: read the file through `FileStorageProvider`, call a vision LLM with a JSON schema matching `ExtractedItem`, and set `app.menu-ai.provider`. |
| S3 / CDN | Implement `FileStorageProvider` (`store` returns a CDN URL) and set `app.storage.provider`. |
| Secrets | Encrypt `payment_configuration.key_secret` / `webhook_secret` at rest (KMS), set a strong `JWT_SECRET`, and run with `SPRING_PROFILES_ACTIVE=prod` so no demo seed loads. |
| Identity | Swap the `JwtDecoder` in `SecurityConfig` for your IdP (or keep the built-in issuer) and add password reset and invites. |
| Notifications | Implement `NotificationProvider` (WhatsApp, SMS or push). It's invoked after commit for each new order. |

## Tests

```bash
cd backend && mvn test        # JAVA_HOME must point to JDK 21
```

27 tests in total:

- **Unit tests** for the business-critical services:
  - checkout pricing and validation, including sold-out items, cross-tenant items, wrong slugs, inactive tables and paused ordering;
  - payment verification, covering forged signatures, failed payments, timeout → expiry, webhook signatures and duplicate webhooks;
  - order placement from captured payments, with idempotency and an amount-mismatch guard;
  - mark-served and tenant scoping;
  - AI-menu publishing rules.
- **An end-to-end integration test** on real PostgreSQL (embedded, with Flyway schema and demo seed). It goes from QR storefront to
  server-priced checkout, mock gateway, verified capture, restaurant order and served. It also covers tenant isolation, roles,
  a failed payment never creating an order, and the standard error format.

The frontend is type-checked and linted by `npm run build`.

## Configuration

| Variable | Default | Purpose |
|---|---|---|
| `DB_URL` / `DB_USERNAME` / `DB_PASSWORD` | `jdbc:postgresql://localhost:5432/tabletap`, `tabletap` | PostgreSQL |
| `APP_PUBLIC_BASE_URL` | `http://localhost:3000` | Base URL encoded into table QR codes |
| `JWT_SECRET` | dev value | HS256 signing key (≥ 32 bytes) |
| `SPRING_PROFILES_ACTIVE` | `demo` | `demo` loads seed data; `prod` disables demo data and demo accounts |
| `PAYMENT_PROVIDER` | `mock` | Payment adapter |
| `PAYMENT_PENDING_TIMEOUT` | `PT15M` | When unfinished payments are marked failed |
| `STORAGE_LOCAL_ROOT` | `./data/uploads` | Local file storage directory |
| `BACKEND_URL` (frontend) | `http://localhost:8080` | Where Next.js proxies `/api` and `/files` |

## Notes and known limitations

- The dashboard refreshes by polling every 8–15 seconds. A WebSocket or SSE channel is a natural next step.
- Seed orders are generated relative to when the database was created. Reset the DB to get fresh "today" numbers.
- Mock-gateway state lives in memory. Restarting the backend mid-payment leaves that payment pending until the expiry job fails it.
- Seed food photos are from TheMealDB and are for demo use only. Items without a photo get a typographic placeholder.
- Refunds exist as a payment status in the model but have no UI in this MVP.
