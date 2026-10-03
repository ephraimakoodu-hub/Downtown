# Deployment

Nothing has been deployed. No domain has been registered or configured. This is a checklist, not a record.

## Domain and HTTPS
Register a domain, point DNS A/AAAA (or CNAME) records at the host, and issue a TLS certificate (for example through the host or Let's Encrypt). Serve the frontend and API over HTTPS only. Set `CORS_ORIGINS` to the exact frontend origin.

## Backend
Run `node src/server.js` under a process manager (systemd, PM2 or a container platform) so it restarts after a crash. Run `node src/jobs/worker.js` as a second, separate long-running process under the same process manager: it sends queued emails and must keep running independently of the web server. Set `NODE_ENV=production`. Set `TRUST_PROXY=true` only when behind a reverse proxy you control. Every variable in `backend/.env.example` must be set through the host's secret store, not committed.

## Frontend
Run `npm run build` in `frontend` and serve `dist` from a static host or the reverse proxy. Route all paths to `index.html`. Proxy `/api` to the backend, or configure the API origin and CORS accordingly. Set a Content Security Policy and test it against the built site.

## Database
Use MySQL 8.0.16 or newer with a dedicated application user that has only the privileges it needs. Run `npm run migrate` on each release. Take a backup before every migration.

## Backups
Recommended starting point, to be confirmed with the business: daily full logical or snapshot backups, retention chosen by the business, copies stored off the database host. A backup is not proven until a restore has been performed and checked, so schedule a restore test and record the result here. No backup has been taken or tested yet.

## Monitoring
Point uptime checks at `/health/ready`. Ship the JSON logs (one line per request, with `requestId`) to a log service. Add an error monitoring service when chosen. None is configured.

## Payments
No provider is integrated. Choose a provider that offers hosted or tokenized checkout so card data never touches this server, then implement server side price calculation and signed webhook verification before enabling payments.

## First run checklist

1. `npm run migrate`, then create the first administrator with `npm run create-admin`.
2. Sign in at `/admin`. In Settings, choose whether to offer pickup and delivery and set the delivery fee.
3. Rename the placeholder location "Main store" if needed, add categories, brands, suppliers, products, then receive stock through a purchase order or Inventory adjustment.
4. Fill in `frontend/src/config.js` with verified details, then have the policy pages reviewed.
5. Place a test order and walk it through every status. Confirm stock numbers at each step.
