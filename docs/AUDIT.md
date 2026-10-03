# Audit

Date: 2026-09-28. Scope: the code in this repository. There was no pre-existing Downtown Supermarket repository, so this is a self-review of newly written code, not an independent audit.

## What was actually run

| Check | Result |
|---|---|
| `node --check` on every backend source file | Passed |
| Unit tests for money, order status rules, order pricing, payment signature, image signature check, in-memory cache (16 tests) | Passed |
| `test/env.test.js` | Written, NOT run (dependencies could not be installed) |
| JSX syntax scan of all 31 frontend files with the TypeScript parser (a deliberate error was detected, so the scan works) | No syntax errors |
| `npm install` | Failed: no network access in the build environment |
| `npm audit`, ESLint, `vite build`, accessibility tools, secret scanner | NOT run |
| Migrations `001`, `002`, `003` against MySQL | NOT run. SQL syntax, CHECK constraints and seed inserts are unverified |
| Any API route executed against a database | NOT done |
| Frontend rendered in a browser, keyboard, contrast and mobile testing | NOT done |
| Search for em dashes in project files | None found |

Treat everything as unverified until `npm install`, migrations, tests and a manual pass are done on a machine with network access. Expect bugs, especially in SQL and in React runtime behaviour.

## Findings

| # | Finding | Severity | Location | Recommended fix | Fixed | Verification |
|---|---|---|---|---|---|---|
| 1 | No payment provider. Payments cannot be taken online. Webhook format is an assumption | High (feature gap) | routes/payments.js | Choose a provider, implement adapter, match webhook | No | Signature check unit tested only |
| 2 | Password reset emails are not delivered (no mail provider). Reset flow cannot be used | High | utils/mailer.js | Connect an email provider | No | n/a |
| 3 | No email verification | Medium | routes/auth.js | Add verification token flow | No | n/a |
| 4 | Rate limiting is per IP with an in memory store, not shared across instances | Medium | middleware/rateLimit.js | Shared store (Redis) if scaled out | No | n/a |
| 5 | Customer facing search relies on FULLTEXT plus LIKE prefix; short words may behave differently under MySQL settings | Low | routes/products.js | Test with the real catalogue and tune | No | Not tested |
| 6 | Public product responses are cached for 30 seconds, so stock can be briefly stale. Checkout re checks stock under lock | Low | routes/products.js | Accepted | Accepted | By code reading |
| 7 | Frontend Content Security Policy not set | Medium | hosting | Set and test at the host | No | n/a |
| 8 | Payment success does not advance the order status; staff do it manually | Low | routes/payments.js | Decide the business rule | No | n/a |
| 9 | Order and stock logic (locking, reservation, commit, cancel) has no automated database test | High | routes/orders.js, adminOperations.js | Add integration tests against MySQL | No | Code review only |
| 10 | Placeholder location "Main store" and default settings seeded. Delivery and pickup are OFF until staff enable them | Low | migrations | Rename location, set settings | No | n/a |
| 11 | Product images are https links entered by staff. No upload, no license record | Medium | Products form | Add upload with validation, record source and rights per image | No | n/a |
| 12 | Legal pages are drafts with marked gaps. No lawyer review. Whether a cookie consent banner is required for essential only storage is an open legal question | High | pages/Legal.jsx | Business fills details, Nigerian lawyer reviews | No | n/a |
| 13 | Tracking and third parties: none used. No analytics, no external fonts, scripts or embeds | Info | frontend | Keep it that way unless consent is built | n/a | Manual read of index.html and source |
| 14 | No secrets in repository. `.env` git-ignored, `.env.example` names only. No git history to scan | Info | repo | Run a secret scanner before first push | n/a | Manual review only |
| 15 | No product reviews feature, so no fake reviews exist | Info | n/a | Build verified purchase reviews later if wanted | n/a | n/a |
| 16 | Admin lists are paginated at 25 (50 for audit) with fixed limits. No CSV export or bulk actions | Low | admin routes | Add as needed | No | n/a |
| 17 | Accessibility: labels, focus styles, skip links, status announcements and 44px targets were built in, but contrast, screen reader and keyboard behaviour have not been tested | Medium | frontend | Test with axe and a screen reader | No | Not tested |
| 18 | Background jobs, caching layer and error monitoring hook not built | Low | backend | Add when measured need or provider chosen | No | n/a |

| 19 | Email verification, image upload and reviews are now built (see below) but none has been run against a live database or a real file upload | High | migrations/003, routes/reviews.js, lib/imageUpload.js | Run migration 003, exercise each flow manually, add integration tests | No | Unit tests only (image signature check, cache) |
| 20 | Background job worker (`src/jobs/worker.js`) has not been run; only its pure logic (backoff math is untested directly, though covered indirectly by code review) has been checked | Medium | src/jobs | Run the worker against a real queue and confirm retry and dead-letter behaviour | No | Syntax check only |
| 21 | No email provider is connected, so verification and password reset emails are queued and logged, never delivered | High | utils/mailer.js | Connect a provider | No | n/a |

## Nigerian legal and privacy review

Preliminary only. I could fetch web search result titles but not full page content in this environment (the fetch tool was blocked), so I have not read primary sources in full and this is not a substitute for a lawyer's review.

FACT (from search result titles, not independently verified against the primary text):
- The relevant law is the Nigeria Data Protection Act, 2023 (NDPA), administered by the Nigeria Data Protection Commission (NDPC).
- The NDPC has published guidance on registering "data controllers and processors of major importance" and has introduced a compliance audit regime for entities that meet that status.

LEGAL QUESTION REQUIRING PROFESSIONAL REVIEW (not established here):
- Whether Downtown Supermarket's processing (customer accounts, orders, delivery addresses) would make it a data controller "of major importance" under the NDPA, and if so, what registration and annual audit obligations follow. I did not verify the numeric or activity thresholds for this status and have not put any figure in this codebase or its copy.
- Whether the site's cookie and local storage use (session cookie, cart storage, both described in `frontend/src/pages/Legal.jsx`) requires a consent banner under Nigerian law, given it currently sets no analytics, advertising or tracking.
- Data retention periods for accounts, orders and logs.
- Consumer protection, electronic transactions and payment processing rules applicable to online supermarket orders.
- Marketing communications rules, if the business ever adds marketing email or SMS.
- Any rules specific to children's data (this site does not knowingly collect it and has no age gate).

Nothing in this codebase or its documentation claims legal compliance. The draft policy pages say so explicitly and are marked as needing review.

## Business information still required

Address, phone, email, opening hours, delivery areas and fee, pickup availability, refund and return periods, legal entity name and registration number, logo and brand colours, product data and photos, payment provider choice, email provider choice, retention periods.
