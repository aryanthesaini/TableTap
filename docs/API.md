# API guide

Base path: `/api/v1`. The interactive OpenAPI UI is at **http://localhost:8080/swagger-ui.html**. It's grouped into
public, restaurant, admin and webhooks, and the spec is also exported to [`openapi.json`](openapi.json).

## Conventions

| | |
|---|---|
| Auth | `Authorization: Bearer <JWT>` from `POST /auth/login`. Public and webhook routes need no token. |
| Tenancy | Restaurant routes always act on the restaurant in the token. IDs belonging to other tenants return `404`. |
| Success | The resource DTO is the response body. Lists use `PageResponse { content, page, size, totalElements, totalPages }`. |
| Errors | Every error has the same shape (below). Common statuses: `400` validation, `401` unauthenticated, `403` wrong role, `404`, `409` conflict, `422` business rule, `502` payment provider. |
| Money | JSON numbers with 2 decimal places (`BigDecimal` server-side). Prices are tax-exclusive. |

```json
{
  "timestamp": "2026-11-11T07:40:12.481Z",
  "status": 422,
  "code": "ITEM_UNAVAILABLE",
  "message": "Palak Paneer is sold out right now. Please remove it to continue.",
  "path": "/api/v1/public/checkout",
  "fieldErrors": []
}
```

## Endpoint map

### Auth
| Method | Path | Notes |
|---|---|---|
| POST | `/auth/login` | `{ email, password }` → `{ accessToken, expiresAt, user }` |
| GET | `/auth/me` | current user |
| GET | `/auth/demo-accounts` | demo login list (empty when `app.demo.enabled=false`) |

### Public: customer ordering (no login)
| Method | Path | Notes |
|---|---|---|
| GET | `/public/storefront/{slug}/tables/{qrToken}` | branding, table, menu, whether ordering is enabled |
| POST | `/public/checkout` | prices the cart **server-side**, opens a payment → `CheckoutResponse` |
| GET | `/public/checkout/{checkoutId}` | checkout / payment / order status |
| POST | `/public/checkout/{checkoutId}/confirm` | forwards the gateway result for verification |
| POST | `/public/checkout/{checkoutId}/sync` | asks the provider for the status (after a timeout) |
| GET | `/public/orders/{orderId}` | confirmation and tracking |
| POST | `/public/mock-gateway/orders/{providerOrderId}/pay` | **mock provider only**: simulates the hosted checkout |

### Restaurant (OWNER, STAFF; ★ = owner only)
| Method | Path | Notes |
|---|---|---|
| GET / PUT★ | `/restaurant/profile` | details, tax, branding |
| PATCH★ | `/restaurant/profile/operating-status` | `{ acceptingOrders }` |
| GET | `/restaurant/analytics/overview` | today's KPIs, hourly and 7-day revenue, top items |
| GET | `/restaurant/orders?status=&tableId=&q=&from=&to=&page=&size=` | PENDING orders oldest first, otherwise newest first |
| GET | `/restaurant/orders/counts` | `{ pending, servedToday, ordersToday }` |
| GET | `/restaurant/orders/table-activity` | per-table pending count, today's orders, revenue |
| GET | `/restaurant/orders/{id}` | order with item name and price snapshots |
| POST | `/restaurant/orders/{id}/serve` | idempotent |
| GET | `/restaurant/menu` | categories with items |
| POST★ / PUT★ / DELETE★ | `/restaurant/menu/categories[/{id}]` | delete is a soft delete and cascades to the category's items |
| PUT★ | `/restaurant/menu/categories/order` | `{ orderedIds: [...] }` |
| PUT★ | `/restaurant/menu/categories/{id}/items/order` | `{ orderedIds: [...] }` |
| POST★ / PUT★ / DELETE★ | `/restaurant/menu/items[/{id}]` | |
| PATCH | `/restaurant/menu/items/{id}/availability` | staff can mark an item sold out |
| POST★ | `/restaurant/menu/images` | multipart `file` → `{ url }` |
| GET / POST★ / PUT★ / DELETE★ | `/restaurant/tables[/{id}]` | each response includes `orderingUrl` (the QR target) |
| PATCH★ | `/restaurant/tables/{id}/status` | `{ active }` |
| POST★ | `/restaurant/tables/{id}/qr/regenerate` | invalidates the printed code |
| GET★ | `/restaurant/payments?status=&page=` / `/summary?days=` | |
| GET★ / PUT★ | `/restaurant/payments/configuration` | secrets are write-only |
| POST★ | `/restaurant/menu-imports` | multipart `file`; extraction runs asynchronously |
| GET★ | `/restaurant/menu-imports[/{id}]` | upload with its draft items |
| PUT★ / POST★ / DELETE★ | `/restaurant/menu-imports/{id}/items[/{itemId}]` | edit, add or remove draft items |
| POST★ | `/restaurant/menu-imports/{id}/publish` / `/discard` | explicit approval step |

### Platform admin (PLATFORM_ADMIN)
| Method | Path |
|---|---|
| GET | `/admin/overview` |
| GET | `/admin/restaurants`, `/admin/restaurants/{id}` |
| PATCH | `/admin/restaurants/{id}/status` `{ status: ACTIVE \| SUSPENDED }` |

### Webhooks
| Method | Path | Notes |
|---|---|---|
| POST | `/webhooks/payments/{provider}/{restaurantId}` | header `X-Razorpay-Signature` = HMAC-SHA256(raw body, restaurant webhook secret). Idempotent by event id. |

## Walkthrough: one order, end to end (curl)

```bash
API=http://localhost:8080/api/v1

# 1. Find a table's QR token (as the owner) — or read it off the Tables page
TOKEN=$(curl -s $API/auth/login -H 'content-type: application/json' \
  -d '{"email":"owner@saffrontable.in","password":"demo1234"}' | jq -r .accessToken)
QR=$(curl -s $API/restaurant/tables -H "Authorization: Bearer $TOKEN" | jq -r '.[0].qrToken')

# 2. Customer opens the menu
ITEM=$(curl -s $API/public/storefront/saffron-table/tables/$QR | jq -r '.categories[1].items[0].id')

# 3. Checkout — only ids and quantities are sent; the server prices everything
CHECKOUT=$(curl -s $API/public/checkout -H 'content-type: application/json' \
  -d "{\"restaurantSlug\":\"saffron-table\",\"tableToken\":\"$QR\",\"items\":[{\"menuItemId\":\"$ITEM\",\"quantity\":2}],\"note\":\"less spicy\"}")
echo $CHECKOUT | jq '{checkoutId, subtotal, taxAmount, totalAmount, payment}'
CID=$(echo $CHECKOUT | jq -r .checkoutId); POID=$(echo $CHECKOUT | jq -r .payment.providerOrderId)

# 4. Customer pays in the gateway (mock). Outcome: SUCCESS | FAILURE | TIMEOUT
PAID=$(curl -s $API/public/mock-gateway/orders/$POID/pay -H 'content-type: application/json' -d '{"outcome":"SUCCESS","method":"UPI"}')

# 5. Browser forwards the gateway result; the server verifies the signature and asks the provider
curl -s $API/public/checkout/$CID/confirm -H 'content-type: application/json' \
  -d "$(echo $PAID | jq '{providerOrderId, providerPaymentId, signature}')"
# → {"checkoutId":"…","status":"COMPLETED","paymentStatus":"CAPTURED","orderId":"…","orderNumber":1086}

# 6. Restaurant sees it (pending orders are listed oldest-first) and serves it
ORDER=$(curl -s "$API/restaurant/orders?status=PENDING" -H "Authorization: Bearer $TOKEN" | jq '.content[-1]')
echo $ORDER | jq '{orderNumber, tableName, totalAmount}'
curl -s -X POST $API/restaurant/orders/$(echo $ORDER | jq -r .id)/serve -H "Authorization: Bearer $TOKEN" | jq .status   # "SERVED"
```

### Example: `POST /public/checkout` response
```json
{
  "checkoutId": "5b1e…",
  "status": "OPEN",
  "restaurantName": "Saffron Table",
  "tableName": "Table 6",
  "currency": "INR",
  "items": [
    { "menuItemId": "30d1…", "name": "Butter Chicken", "unitPrice": 480.00, "quantity": 2, "lineTotal": 960.00, "dietary": "NON_VEG" }
  ],
  "subtotal": 960.00, "taxLabel": "GST", "taxRatePercent": 5.00, "taxAmount": 48.00, "totalAmount": 1008.00,
  "payment": {
    "paymentId": "8c0f…", "provider": "MOCK", "keyId": "rzp_test_SaffronT4bl3",
    "providerOrderId": "order_Q3kWm2…", "amount": 1008.00, "amountMinor": 100800, "currency": "INR"
  }
}
```

### Example: restaurant `OrderResponse`
```json
{
  "id": "e2a4…", "orderNumber": 1086, "tableId": "52a9…", "tableName": "Table 6",
  "status": "PENDING", "paymentStatus": "CAPTURED", "currency": "INR",
  "subtotal": 960.00, "taxAmount": 48.00, "totalAmount": 1008.00, "customerNote": "less spicy",
  "itemCount": 2,
  "items": [{ "menuItemId": "30d1…", "name": "Butter Chicken", "unitPrice": 480.00, "quantity": 2, "lineTotal": 960.00, "dietary": "NON_VEG" }],
  "createdAt": "2026-11-11T08:01:44Z", "servedAt": null
}
```
