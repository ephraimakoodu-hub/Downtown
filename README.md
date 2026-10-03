# Downtown Supermarket platform

Online catalogue and operations platform for Downtown Supermarket, Ado-Ekiti, Nigeria.
Stack: React (Vite) frontend, Node.js (Express) API, MySQL.

## Status

Everything below is written but has NOT been run end to end. See `docs/AUDIT.md` for exactly what was and was not verified.

Customer: home, catalogue with search and filters, product page, cart (server priced), checkout (pickup or delivery, server side totals and stock reservation, idempotent), account, order history and status view, order cancel, refund request, password change and reset request, legal page drafts, storage notice.

Staff: dashboard, products, inventory with stock adjustment, categories, brands, suppliers, purchase orders with receiving, orders with status workflow, refund decisions, users and roles, audit log, settings.

Backend: MySQL schema and migrations, role based permissions, audit logging, payment webhook with signature verification and duplicate protection, health checks, a durable background job queue with a separate worker process, an in-memory cache for read-heavy public data, email verification, product image upload with content-type verification, and a customer review system restricted to verified purchases.

Not done: a connected payment provider, an email delivery service (see below), browser tests, Nigerian legal review.

## Prerequisites

Node.js 20 or newer, MySQL 8.0.16 or newer (CHECK constraints are enforced from 8.0.16).

## Background jobs

Some work (currently: sending emails) runs through a database backed job queue instead of blocking an HTTP request. Run the worker alongside the API:

    cd backend && npm run worker

If the worker is not running, queued jobs (verification emails, password reset emails) will sit pending until it starts; nothing is lost, but nothing is sent either.

## Email

No email provider is connected. `src/utils/mailer.js` is the single place to add one (see `docs/ARCHITECTURE.md`). Until then, registration, email verification and password reset still work end to end at the database and API level, but the emails themselves are only logged, not delivered.

## Setup

    cd backend
    cp .env.example .env        # fill in values, generate JWT_SECRET as shown in the file
    npm install
    npm run migrate
    ADMIN_PASSWORD='use-a-long-password' npm run create-admin -- you@example.com "Your Name"
    npm run dev

    cd ../frontend
    npm install
    npm run dev                 # http://localhost:5173, proxies /api to port 4000

## Tests

    cd backend && npm test

Current tests cover money conversion, environment validation, order status rules, order pricing, payment signature verification, the image upload content check, and the in-memory cache. There are no API, database or browser tests yet.

## Business details

Edit `frontend/src/config.js`. Fields left as `null` are not displayed. Do not enter unverified information.
The colours in `frontend/src/styles/tokens.css` and the "DS" mark are temporary placeholders, not official branding.

## More

`docs/ARCHITECTURE.md`, `docs/SECURITY.md`, `docs/DEPLOYMENT.md`, `docs/AUDIT.md`.
