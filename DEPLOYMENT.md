# Deployment and launch gate

This is an update to the existing GitHub Pages + Supabase project. It is not a replacement site. No live database mutation, repository push, payment, email delivery, or deployment was performed by this work.

## Preserve production

1. Export the repository and database. Back up Storage separately, including private paid PDFs. Keep encrypted copies and test a restore in an isolated project. The browser admin export is an operational export, not an auth/Storage/database backup.
2. Compare the update with the current repository before replacing files. During audit, live index.html, backend.js, checkout.js, account.js, admin.js and auth-config.js matched the starting workspace byte-for-byte. New edits after that audit must be merged.
3. Run `supabase/00_PREFLIGHT.sql` read-only. Resolve missing private PDFs. Ganacsade's live file_path was null. Both named paid PDFs in DELETE_FROM_GITHUB.txt were publicly accessible. Removing current files does not purge historical commits/artifacts/caches. Follow https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository . Do not force-rewrite history without coordinating backups/collaborators.
4. Use a separate staging Supabase project and staging host for provider sandbox acceptance. Do not grant test entitlements in the production database or reseed real catalog data.

## Database

Existing `01_SETUP.sql` must already be installed, with the current owner role. Run new migrations 05, 06, 07 in order. They do not reseed books or change catalog prices/authors. They are rerunnable in that order. If an older provider prototype already contains multiple attempts per order, inspect it before migration 06's generation uniqueness index; do not delete financial rows to make a migration pass.

Migration 06 backfills historical receipts for confirmed orders, WITHOUT emailing all previous customers. Only new approvals/confirmations enter the receipt email queue. Sales figures are gross confirmed order receipts in USD, not bank payout reconciliation, tax accounts, fees, or net-refund totals.

The existing reviews/newsletter migration 04 remains separate and unchanged. If it is absent, apply the existing `04_REVIEWS_NEWSLETTER.sql` after backup; it is not a catalog seed. Newsletter signup stores consent/contact information; this update implements purchase receipts, not a marketing campaign service.

## Edge Function

Install the Supabase CLI using its official instructions. From the SERVER directory (containing `supabase/`):

```sh
supabase login
supabase link --project-ref hbbejwxcjtlkxdcbmgwj
supabase secrets set --env-file /absolute/private/path/secrets.env
supabase functions deploy akram-commerce --project-ref hbbejwxcjtlkxdcbmgwj --no-verify-jwt
```

`verify_jwt=false` is intentional: user routes call Supabase Auth getUser to validate JWTs; webhooks validate raw-body HMAC signatures; jobs validate a separate secret. Do not remove these checks. Never put service-role/provider keys in frontend code. The existing publishable browser key is public by design.

Copy secrets.env.example to a private path, fill it with real merchant values, and keep PAYMENTS_ENABLED=false until staging acceptance. SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are supplied to deployed Supabase functions. SITE_URL must exactly be the canonical HTTPS website base, including its repository path.

### Stripe

Use an approved merchant account in a supported country. Configure a webhook to:
`https://hbbejwxcjtlkxdcbmgwj.supabase.co/functions/v1/akram-commerce/stripe-webhook`

Subscribe to checkout.session.completed, checkout.session.async_payment_succeeded, checkout.session.async_payment_failed, checkout.session.expired, charge.refunded, charge.dispute.created and charge.dispute.closed. Set the matching webhook signing secret. USD only is configured. The hosted provider determines available cards/wallets; no card data is collected by Akram Library. PAYMENT_MODE and Stripe key mode must match.

### WAAFI

Use merchant HPP credentials, not personal wallet PINs/numbers. Set WAAFI_API_URL to https://sandbox.waafipay.com/asm for test or https://api.waafipay.net/asm for live, matching PAYMENT_MODE. Register:
`https://hbbejwxcjtlkxdcbmgwj.supabase.co/functions/v1/akram-commerce/waafi-webhook`

Subscribe to authorization and refund events; configure the signing secret. Unsigned `webhook.test` pings return 200 without doing anything to an order. Real events require signatures, merchant identity and provider re-query verification. WAAFI documentation states failed webhook deliveries are not automatically retried, so the reconciliation scheduler is essential.

The adapter uses documented MWALLET_ACCOUNT HPP. Actual EVC/WAAFI/Sahal availability depends on merchant enablement. Automated eDahab, Premier and Salaam are NOT claimed: no approved integration credentials/specifications were supplied for those methods. Existing eDahab manual transfer remains. Do not show an unconnected bank as active.

Confirm allowed live HPP redirect hostname with the merchant. The code only allows explicit known HTTPS hosts; do not accept arbitrary returned URLs. Unknown initiation remains pending for reconciliation instead of creating another charge. Admin can record cancellation only after independent provider confirmation that no payment was collected and the checkout is cancelled.

### Receipt email and scheduled recovery

Set RESEND_API_KEY and RECEIPT_FROM on a domain verified with Resend. Keep cadeakram72@gmail.com as support/reply-to. Auth signup/reset emails separately require Supabase SMTP configuration and sender verification; the receipt worker does not replace Auth email.

Create a random CRON_SECRET locally (for example `openssl rand -hex 32`), store it in Supabase Secrets and Vault. Enable Cron/pg_net/Vault and follow SCHEDULE_JOBS.sql. Create only one schedule, monitor both Cron results and HTTP responses. The worker handles bounded pending-order batches and leased email batches; scale worker scheduling within provider rate limits based on measured backlog. No thousand-concurrent-customer production load test was performed.

Receipt payloads are snapshotted, idempotency keys are stable, and ambiguous deliveries older than 23 hours are flagged for review rather than blindly resent outside Resend's deduplication window. Inspect Resend logs before manually repairing an email job. No automatic money transfer occurs when a refund support case is resolved.

## Frontend

Upload ONLY GITHUB_UPDATE contents to the existing publish root. Preserve existing other assets/data. Explicitly delete the two public paid PDFs after private verification. Cache versions are updated. The Supabase browser SDK is now locally bundled (supabase-client.js); upload it along with account.js/backend.js. CSP permits local scripts and needed styles/images/connections; no inline script or eval is allowed on the main pages.

Test the browser console for CSP/resource errors after deployment. GitHub Pages does not provide arbitrary server headers here; deployment-level HSTS/frame-ancestors/security monitoring must be reviewed with the hosting capabilities rather than asserted as configured.

## Required acceptance tests

- Existing Google and password sign-in/sign-out, profile menu, signup confirmation, forgotten password and recovery link on both devices. Supabase Site URL and allowed redirects must reference the hosted account.html, not localhost. Test Auth email delivery with a real controlled account.
- User A purchases: book → checkout → provider → webhook/reconciliation → paid order + entitlement + receipt outbox in one transaction → My Library → actual private PDF → receipt inbox.
- User B cannot read A's orders, receipts, reading position or private book without their own entitlement.
- Wrong amount/currency, forged/stale webhook, mismatched merchant/customer/book, duplicate event/transaction, cancellation, delayed confirmation, refresh, offline return, and payment retry. No click or return URL should unlock anything.
- Verify duplicate *charges*, not just duplicate events, appear in operations alerts. Compare orders and transaction references with the provider's daily report; compare provider payouts/fees/refunds with bank/wallet statements separately.
- Refund/dispute alerts require merchant review. Process approved refunds in provider tools, then record resolution and apply/release an access hold if appropriate. This release intentionally does not automate refund disbursement.
- Cloud reading position restores on a second device; a stale device cannot overwrite a newer revision. Local notes/favorites remain local as before.
- Admin book creation/edit/upload/hide/archive/restore, manual payment review, reports, alerts, export, unauthorized admin denial. Verify source licences and paid distribution rights.
- Free downloads, existing search/filtering, mobile layout, reader previous/next/bookmarks, email failures/retry, scheduler failure recovery, backup restore.

## Launch decision / rollback

Keep automatic checkout disabled until paid asset exposure, private upload, real provider acceptance, verified sender, scheduler, owner policy approval and production security review are complete. Enable live merchant keys, PAYMENT_MODE=live and PAYMENTS_ENABLED=true only after those checks. Arrange monitoring for old pending orders, failed receipts and payment alerts; protect owner/provider accounts with MFA and restrict administrative access.

If a problem appears, set PAYMENTS_ENABLED=false to stop new automated checkouts; keep signed webhooks and reconciliation running for money already in flight. Restore frontend files from the last known-good backup if necessary. Do not drop tables, erase paid orders, revoke all purchases, or restore a stale database over new transactions. Diagnose and apply a forward fix; retain the audit trail.

Policies supplied are usable bilingual drafts reflecting implemented behavior. Owner must approve business identity/address, governing jurisdiction disclosures where required, retention periods, consumer/cancellation rules and provider refund requirements. No legal or PCI certification is claimed. Client devices can save/screenshot content they can read; disabling the download button is not DRM.
