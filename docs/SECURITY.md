# Security

This lists controls that exist in the code. None of it has been penetration tested.

## Implemented

- Passwords hashed with bcrypt (cost 12). Login compares against a dummy hash for unknown emails to reduce account enumeration by timing.
- Login and register limited to 10 attempts per 15 minutes per IP. General API limit of 300 requests per minute per IP.
- Session cookie: httpOnly, SameSite=Lax, Secure in production.
- Permission checks on the server for every `/api/admin` route. Customer order routes filter by the signed-in user's id, so other customers' orders look like missing ones.
- Server side order totals from database prices, idempotent order creation, row locking on stock to prevent overselling.
- Payment webhook: raw body HMAC check with constant time comparison, duplicate protection by unique provider reference, amount must match the order total.
- Password reset tokens are random, stored only as SHA-256 hashes, expire after 30 minutes and are single use. The forgot password response is identical whether or not the email exists.
- Users cannot change their own role or status. Role and permission changes and other staff actions are written to the audit log.
- Parameterized SQL everywhere. Values placed directly in SQL text are integers that were validated by zod first (pagination) or fixed strings chosen from an allow list (sorting).
- Input validation with zod. Unknown fields are rejected on auth and inventory bodies. JSON bodies limited to 50 KB.
- CORS uses an explicit allow list from `CORS_ORIGINS`. Wildcard is refused at startup. Credentials are enabled only for those origins.
- State changing requests carrying an Origin header from a non allowed origin are rejected.
- Helmet headers including a locked down CSP for the API, HSTS in production, no-referrer, frame denial. Permissions-Policy set.
- Errors return a generic message and a request ID. Stack traces and database errors are logged, never returned.
- Logger redacts password, token, cookie, authorization and card fields.
- Startup fails if required configuration is missing or the JWT secret is under 32 characters.
- Graceful shutdown, request and header timeouts, health endpoints at `/health/live` and `/health/ready`.

## Implemented since the last review

- Email verification with single use, hashed, expiring tokens.
- Background job queue for outbound email, so a slow or down provider cannot block a request; jobs retry with backoff and stop after 5 attempts rather than retrying forever.
- Product image upload restricted to JPEG/PNG/WebP, 5MB limit, server generated filenames (no path traversal via a client supplied name), and a magic byte check that rejects a file whose content does not match its declared type. A staff rights confirmation is required before an image is accepted.
- Product reviews can only be created for a delivered order that belongs to the signed in customer, enforced by a database constraint, and are not public until a manager or administrator approves them.

## Not implemented yet

- An actual email delivery provider. Emails are queued and logged, not sent, until `src/utils/mailer.js` is connected to one.
- Account lockout beyond IP rate limiting (credential stuffing across many IPs is not covered).
- CSRF tokens (relies on SameSite plus Origin checks).
- A real payment provider, refund payouts, and matching the webhook to the provider's documented format.
- Frontend Content Security Policy (must be set by the host serving the built frontend and tested).
- File uploads (none exist, so none are exposed). Product images are https links entered by staff.
- Stored `changes` in the audit log are shown to authorized staff only, but no retention policy is set.
- Dependency audit, secret scan, automated security tests. See `docs/AUDIT.md`.

## Reporting

Add a security contact here once the business provides one: NOT YET CONFIGURED.
