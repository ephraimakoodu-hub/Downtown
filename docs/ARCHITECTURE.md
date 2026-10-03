# Architecture

## Overview

Single page React app talks to a JSON API over HTTPS. The API talks to MySQL through a pooled connection.

    Browser (React) -> /api (Express) -> MySQL

## Backend layout

- `src/config`: environment validation (fails at startup), database pool and transaction helper.
- `src/middleware`: request IDs, rate limits, authentication, permission checks, audit writer, central error handler.
- `src/routes`: one router per area. Routers receive the pool and env, so they are testable.
- `src/utils`: logger with redaction, money helpers (integer kobo), HTTP error classes.
- `migrations`: ordered SQL files applied by `npm run migrate`.

## Key decisions

- Money is integer kobo everywhere. The API returns kobo, the client formats it.
- Roles and permissions live in the database (`roles`, `permissions`, `role_permissions`). The API checks permissions on every protected route and re-reads the user's role on each request, so changes apply immediately.
- Stock is tracked per product per location (`inventory`), so more stores or warehouses can be added as rows. `reserved` is reserved for checkout. Availability is `on_hand - reserved`.
- Every stock change writes a `stock_movements` row and an `audit_logs` row in the same transaction.
- Orders and payments tables exist with unique constraints for idempotency and provider references, but no order or payment code exists yet.
- Sessions are JWTs in an httpOnly, SameSite=Lax cookie (Secure in production).

## Orders and stock

1. Customer cart lives in the browser as product ids and quantities only. `POST /api/cart/quote` prices it from database prices.
2. `POST /api/orders` requires an `Idempotency-Key`. In one transaction it claims the key, locks inventory rows in product id order, checks availability, increases `reserved`, writes the order with server calculated totals and a price snapshot per line, and stores the response against the key. Repeating the same key returns the stored response. Reusing a key with a different body is rejected.
3. Staff move the order through `placed, confirmed, processing, ready (pickup) or dispatched (delivery), delivered`, or `cancelled`. Transitions are enforced in `src/utils/orderStatus.js`.
4. Stock leaves the shelf (`on_hand` and `reserved` both drop, a `sale` movement is written) when the order reaches ready or dispatched. Cancelling before that releases the reservation.
5. Delivery and pickup are off until staff switch them on in Settings, with a delivery fee.

## Payments

No provider is integrated. `POST /webhooks/payment` verifies an HMAC-SHA512 signature over the raw body, ignores duplicate provider references, and only marks a payment succeeded if the amount equals the server calculated order total. The header name, algorithm and payload shape are assumptions that must be matched to the chosen provider. Starting a payment (`POST /api/orders/:ref/pay`) returns 501 until an adapter exists. A successful payment record does not change the order status automatically.

## Frontend

Vite and React. Routes for the shop use a shared shell. `/admin/*` uses its own layout and hides menu items by permission (the server still enforces every permission). Tables collapse into stacked cards below 720px.

## Background jobs

The `jobs` table is a durable queue: `src/jobs/queue.js` enqueues a typed job inside the same transaction as the action that triggered it (so a job is never queued for a database change that got rolled back), and a separate process, `src/jobs/worker.js`, polls for due jobs with `SELECT ... FOR UPDATE SKIP LOCKED` so multiple worker processes cannot claim the same job twice. A failed job retries with exponential backoff up to `max_attempts`, then is left `failed` (a dead letter) rather than retried forever. Currently the only job type is `send_email`. This keeps a slow or unavailable email provider from making a registration or password reset request wait, per the performance requirement that expensive operations run in the background.

## Caching

`src/lib/cache.js` is a small in-process TTL cache, used only for public, non-personal, read-heavy data (currently the category list). It is deliberately not Redis: with one web process and no measured load problem yet, a shared cache adds operational cost without a demonstrated benefit. Any admin write that changes cached data calls `cacheClear()` for that key. If the app is ever scaled to multiple processes, this cache would need to move to a shared store or be removed in favour of the 30 second HTTP cache headers already on public endpoints.

## Product images

Staff can either paste an https URL or upload a file. An upload goes through `src/lib/imageUpload.js` (multer, restricted to JPEG/PNG/WebP, 5MB limit, server generated filename) and is then checked by `src/lib/imageSignature.js`, which reads the file's actual bytes and rejects anything that does not match its claimed type, so a renamed non-image file is caught even if its declared mimetype was spoofed. Files are served from a fixed static directory (`/uploads/products`) with no directory listing. Staff must tick a rights confirmation checkbox before an upload is accepted; this records an attestation, it does not verify licensing.

## Reviews

A review can only be created for a `(order, product)` pair that is the signed in customer's own delivered order, enforced by a unique database constraint, which also stops the same purchase being reviewed twice. New reviews start `pending` and are not shown publicly until a manager or administrator approves them through `/admin/reviews`. There is no way to submit a review without a matching delivered order, so there is no path to a fabricated or unverified review through this system.

## Email verification

Registration issues a random, single use, 24 hour token (stored only as a SHA-256 hash) and queues a `send_email` job. `/verify-email` marks the account verified. Since no email provider is connected yet, the email is logged, not delivered; the flow is otherwise complete and testable once a provider is added.

## Planned next

Payment provider adapter, email provider, image upload with validation, background jobs for email and reports, caching where measured, browser and API tests.
