# AKRAM LIBRARY — Completion report, 29 September 2026

**Status: tested implementation package; NOT deployed or approved for live automated payments.** Existing design and catalog data were preserved. No production purchase, email, secret, database mutation or repository push was made.

## 1. Completed in the code

- Added authenticated Supabase Edge Function adapters for WAAFI hosted mobile-wallet checkout and Stripe hosted international checkout. Real merchant configuration is required; disabled providers remain unavailable. No simulated success exists in production code.
- Server-priced orders tied to one verified user/book, payment-attempt leases, provider idempotency, canonical provider re-query, raw webhook HMAC verification, replay/amount/currency/customer checks, transaction uniqueness, atomic entitlement/receipt creation and late/duplicate-charge alerts.
- Refresh/resume/status/cancel/retry handling. Verified confirmation adds account access; a newly confirmed pending checkout opens the book. A return URL or “Pay” click cannot grant access.
- Purchase history now includes manual and provider orders, receipts and actual entitlements. Admin's personal library is scoped to their own purchases.
- Transactional receipt outbox, retry leases, immutable email payloads and Resend idempotency. An ambiguous delivery outside the deduplication window requires review.
- Account-scoped, revision-checked PDF and text reading-position synchronization, offline local fallback and stale-device conflict protection. Guest progress is not silently copied into another account.
- Existing admin book CRUD retained; fixed edits overwriting discount/sales metadata. Added gross sales/day reporting, provider status checks, verified cancellation recording, refund cases, financial alerts, access hold/restore and audit history. Operational exports page through records instead of silently stopping at 1,000.
- Bilingual Terms, Privacy and Refund pages, support/refund submission, policy links, correct profile behavior and sign-in return to the selected checkout.
- Upgraded the vulnerable older Supabase SDK to pinned 2.50.0, bundled the browser SDK locally, added CSP/referrer controls, request-size bounds, HTTPS redirect allowlists and explicit payment test/live mode checks.
- Preserved private book originals outside the local public website directory. The update contains no paid PDFs and does not modify catalog.json or assets--books.json.

## 2. Still blocked

| Blocker | Evidence / next action |
|---|---|
| Public paid PDFs | Both named paid PDFs returned HTTP 200/application/pdf from the live GitHub Pages site during audit. Upload/verify private copies, remove public copies, and review Git history/deployment artifacts/caches. A ZIP upload does not remove existing files. |
| Ganacsade private delivery | Live public catalog says price USD 5, published=true, file_path=null. Owner must upload/link its existing PDF in the private admin editor. Dhis Naftaada has a private path, but authenticated retrieval still needs a live controlled-account test. |
| Deployment access | No authenticated repository push or Supabase deployment session was supplied. New migrations, function, scheduler and frontend are not live. |
| Merchant activation | No real WAAFI or international merchant keys/signing secrets were supplied. No real provider sandbox/live purchase was performed. |
| Receipt delivery | No Resend key/verified sender domain or scheduler secret was supplied. No real receipt was sent. Auth signup/reset SMTP also needs a live email test. |
| Legal/business launch approval | Owner must approve identity/address disclosures, retention/cancellation/refund requirements and book distribution rights. The policy pages are drafts, not a legal certification. |
| Production operations | Live monitoring, MFA/access review, backup restore, provider rate limits, physical iPhone/Android behavior and load testing must be accepted before launch. |

Automated eDahab/Premier/Salaam are not integrated without an approved provider contract/API. Existing manual eDahab remains. USD is the only configured currency; no exchange rates or new prices were invented. Stripe requires an eligible merchant jurisdiction. Native apps/push notifications were previously deferred and are not included. Existing notes/highlights/favorites remain device-local; only reading position and purchased access synchronize.

Refunds/disputes are captured for admin review; refund disbursements happen in the provider dashboard. “Resolve” never sends money. Gross sales are not provider payouts/net profit. Daily settlement/fee/refund statement matching remains an owner operation. Repurchase after an access hold/refund is handled through support, avoiding an automatic second charge against the same existing order.

## 3. Required credentials/configuration

- WAAFI merchant UID, store ID, HPP key, webhook secret and approved methods/environment.
- Approved Stripe merchant secret key and webhook signing secret, if eligible.
- Resend key and verified sender/domain; support/reply-to remains cadeakram72@gmail.com.
- Supabase CLI login/deployment access, SITE_URL, PAYMENT_MODE, PAYMENTS_ENABLED and private CRON_SECRET/Vault schedule.
- Existing Supabase Auth Site URL/allowed redirects and SMTP validation; Google OAuth account ownership stays with the owner.

Use Supabase Secrets, not GitHub or chat, for private credentials. The publishable key already in auth-config.js stays unchanged. See DEPLOYMENT.md for exact webhook URLs, events, deployment commands, rollback and acceptance tests.

## 4. Files changed

23 new/updated public files are in GITHUB_UPDATE. Exact paths and hashes are in CHANGED_FILES.md and verification/changed-files.json. Main groups: backend/checkout/purchases/account, reader synchronization, admin operations, policy pages, local SDK and rebuilt storefront.js. React source is supplied separately. Additive migrations 05–07, the Edge Function, tests and deployment configuration are in SERVER.

No hero, Welcome composition, colors, book covers, authors, prices or wallet numbers were redesigned/replaced. The small wallet phone field uses the existing checkout styling. storefront.css was rebuilt but is byte-identical to baseline. The two paid PDF originals were preserved locally outside the public tree, and are not distributed in this update ZIP.

## 5. Verification and remaining errors

**162 local assertions passed:**

| Suite | Assertions | What was tested |
|---|---:|---|
| PostgreSQL/PGlite | 46 | Original schema + additive migrations, rerun, RLS, private-file authorization, order identity, amount/currency, duplicate/late events, admin authorization, receipts, holds, progress and queues |
| Security helpers | 23 | Stripe/WAAFI HMAC, modified/stale signatures, exact money and redirect allowlists |
| Edge handler contracts | 21 | Real handler/SDK with mocked transports: auth, server prices, provider creation/binding, canonical confirmation, receipt send, resume, admin denial and WAAFI registration ping |
| Reading sync client | 7 | Cross-device restore, stale writes, guest/account separation |
| Browser flows | 35 | 1440px/390px checkout/admin/policies, no pending/cancelled unlock, USSD links, language, preserved discounts, reset redirect, sign-in return and actual bundled SDK initialization |
| Existing collection/text reader | 21 | Search, Somali/English collections, Room 03, responsive book spreads, keyboard navigation and notes |
| Existing PDF reader | 9 | Desktop/mobile PDF spread and page navigation |

TypeScript checks and Deno checks passed. No local HTML asset targets were missing. Catalog hashes match baseline. Dependency audit found 0 known vulnerabilities in the checked runtime dependency tree after the SDK update. Non-failing tooling warnings: outdated Browserslist data and Node punycode deprecation.

**Not tested/claimed:** real charges, real webhook delivery, real email inbox delivery, live Google/password sessions, iOS/Android physical dialers, production RLS deployment, backup restoration or 1,000 simultaneous production customers. The local suites use isolated fixtures and do not insert fake orders into production. The attempted anonymous live Storage signing check could not complete due to a network error; live private-file authorization remains an acceptance check.

The outstanding live errors are the public paid PDF exposure and missing Ganacsade private link. Until the launch gates above are resolved, this must not be described as a completed secure live payment system.
