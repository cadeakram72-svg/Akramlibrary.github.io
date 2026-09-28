# AKRAM LIBRARY — Payment handover

## Waxa hadda la rakibayo
GITHUB_UPLOAD: geli 5-ta fayl halka index.html yaallo, kadib Commit changes.
Checkout-ku waa madow/dahab, mobile/desktop, Soomaali/English, cover/title/author/USD total, EVC iyo eDahab keypad, receipt submission, order recovery iyo status polling. Akram admin-ka hadda jira ayaa xaqiijiya lacagta. Furitaanka keypad-ku ama return URL-gu ma furo buugga. Dalab pending/approved ah dib looma abuuro; SQL-ka hore unique(user_id,book_id) ayaa ilaaliya.
Ha dib u bixin marka network-ku go'o; Purchase History ka hubi.

## Waxa aan wali ku xirnayn
Automated provider checkout, signed webhooks, international cards/wallets, automatic country detection, non-USD settlement, outbound receipt email and cloud reading-position synchronization are NOT activated. No provider credentials have been provided. A region picker is used rather than guessing location from language/timezone. Unsupported methods are clearly labelled, not actionable. Reading access can work on another device after sign-in; last-page sync is a separate unfinished feature.

## Waxa Akram laga rabo
1. Merchant account la ansixiyey iyo provider-ka aad doorato. WaafiPay has hosted checkout, transaction inquiry and webhooks: https://docs.waafipay.com/hpp-api and https://docs.waafipay.com/webhooks . Ask the provider which EVC/WAAFI/Sahal/eDahab/Premier/Salaam rails and international wallets are approved for YOUR merchant account; do not assume all are supported.
2. Sandbox credentials, approved settlement currency and merchant country, registered HTTPS callback/webhook URLs. Set secrets in Supabase Edge Function secrets, NEVER GitHub/public JS/chat.
3. Email sending provider plus verified sender domain for receipts.
4. Sandbox tests before live payments; signed-off small real purchase/refund test with your provider.

## Server adapter contract (next integration phase)
POST /checkout accepts book_id only plus authenticated user JWT. Validate JWT server-side; derive user_id; call akram_provider_order(user_id,book_id). Price/currency come from server DB, never browser. Reuse existing pending provider checkout by order id. Use a stable provider idempotency key based on order+attempt. If the provider has no documented idempotency, serialize initiation and reconcile unknown outcomes by provider reference before retry; NEVER issue a fresh charge blindly.
Persist a unique provider/payment id in akram_payment_attempts before redirect. Hosted provider page collects card/PIN info. Use an allowlist for redirect hosts. Callback URLs only display DB status and never grant access.
Webhook: verify raw-body signature/timestamp exactly per selected provider documentation, validate merchant identity and successful final status, retrieve transaction from provider's authenticated API, compare amount/currency and saved provider id. Then call akram_settle_verified_payment. The SQL transaction locks the order, deduplicates provider event IDs, grants the correct user's entitlement, and queues one notification. Duplicate deliveries cannot grant another user's book. Unknown payments are quarantined, not guessed.
GET /orders/:id requires JWT and ownership (RLS); includes paid/failed/cancelled/pending. Retry preserves logical order; a new payment attempt is allowed only after the previous provider attempt is terminal and reconciled. Cancellation must be confirmed by provider; leaving the page does NOT mean cancelled. Delayed successful settlement must still be reconciled. Failure events must never downgrade paid.
Notification worker: claim outbox rows with FOR UPDATE SKIP LOCKED, use stable email-provider idempotency key order_id, set sent_at after provider accepts, retry with backoff. Without email provider idempotency, duplicate receipt email cannot be ruled out after a timeout.
Background reconciliation handles lost webhooks. Use bounded polling, visibility pause, retry backoff and database pooling. Rate-limit checkout creation. Maintain webhook audit and provider dispute/refund procedures. Refund policy must define entitlement revocation.

## SQL foundation
05_PROVIDER_FOUNDATION.sql is FUTURE backend groundwork, NOT needed to install the manual UI. Do not run it as if it enables WAAFI or bank cards. It relies on original 01_SETUP and private storage. It deliberately grants settlement only to service_role. No exposed edge endpoint is included until a provider contract is selected. Future My Library/purchase history must include akram_payment_orders as well as legacy akram_orders. Preserve legacy entitlements.

## Required release gates
- Own vs other-user order reads; browser cannot invoke settle/create-for-user functions.
- Double click, duplicate webhook, same provider transaction on two orders, mismatched amount/currency, forged callback, expired webhook, out-of-order events.
- Lost initiation response and refresh: reuse/reconcile, no double charge.
- Payment verified grants one correct entitlement; private PDF unavailable to everyone else.
- Paid book access across devices, failed/cancelled/pending states, receipt retry, administrator audit.
- 1,000-concurrent-client load test with real deployment capacity and sandbox provider quotas. No throughput guarantee has been measured in this delivery.
