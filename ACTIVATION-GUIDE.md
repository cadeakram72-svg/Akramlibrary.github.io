# Akram Library — activation and handover

## What this update does
The original hero and Welcome layout remain. The lower bookshop adds real catalogue covers and offer cards. Dhis Naftaada and Ganacsade have a proposed $10 list price and $5 offer price. Xuska Mawliidka and Maxaynu u Dhibaataysannahay remain free. Checkout is deliberately closed until a secure purchase service exists.

The account page includes Welcome, email sign-in, sign-up, reset-password, Google sign-in and sign-out UI. It adapts to desktop, tablet, Android and iPhone browsers. It is not an installed native app.

## Google / email authentication — owner setup
1. Create a Supabase project in your own account.
2. Copy the project URL and public publishable key into auth-config.js. A legacy public anon key also works with the SDK. NEVER use the service_role/secret key here.
3. In Supabase Authentication URL Configuration set the site URL to https://cadeakram72-svg.github.io/Akramlibrary.github.io/ and allow these redirects:
   https://cadeakram72-svg.github.io/Akramlibrary.github.io/account.html
   https://cadeakram72-svg.github.io/Akramlibrary.github.io/account.html?mode=recovery
4. Enable the Google provider. Use your existing Web Client ID:
   189030132077-84asep9tk2o9bhh2alh8th5n2do3o6js.apps.googleusercontent.com
5. Copy the exact callback URL shown in Supabase to Google Cloud > OAuth client > Authorized redirect URIs. Add https://cadeakram72-svg.github.io under Authorized JavaScript origins.
6. Paste the Google client secret ONLY into the Supabase Google provider dashboard. Never put it in GitHub, auth-config.js or chat.
7. Complete your Google consent screen/publishing configuration. Enable email/password and configure email delivery for real users in Supabase.
8. Upload auth-config.js and test signup + confirmation, email login, Google login, password reset, signout and returning sessions on desktop/mobile.

Official documentation:
https://supabase.com/docs/guides/auth/social-login/auth-google
https://supabase.com/docs/guides/auth/sessions/pkce-flow
https://supabase.com/docs/guides/auth/passwords

## IMPORTANT: priced books are not yet securely sellable
The two priced PDFs are omitted from this new ZIP. However, older copies already uploaded to GitHub and its history remain publicly accessible. Replacing files does not remove those old copies. Client-side routing is NOT access control. Do not accept payment on the basis that these copies are protected.

Before opening sales:
- Remove the previously published paid files from the live repository and plan removal of public history if appropriate. This cannot revoke copies people already downloaded.
- Put paid files in private storage, separate from GitHub Pages.
- Implement server-verified payment/order processing and durable entitlements tied to authenticated user IDs.
- Authorize every paid read server-side, with short-lived signed file access after checking entitlement.
- Decide and document refund/access terms and validate commercial redistribution rights.
- EVC +252618248533 and eDahab +252628248533, payee ABDIWAHID, are owner-provided details only. They are not a payment integration. No bank sample or payment form is used to collect funds.

Paid filenames previously published (do not confuse with their .jpg covers):
assets--books--dhis-naftaada.pdf
assets--books--ganacsade.pdf
assets/books/dhis-naftaada.pdf
assets/books/ganacsade.pdf

## Still not implemented
Secure admin dashboard, cloud reading-progress/favourites sync, purchase backend, payment gateways, protected paid reader, push notifications and native apps. Authentication alone does not supply these. Current reading lists remain local to each browser.

## Upload
Extract ZIP; upload contents of akram-upload-ready to your repository root. Do not upload the enclosing folder or ZIP. Commit and wait for Pages deployment, then hard-refresh. Paid PDF removal is a separate explicit action because old uploads remain.

## Validation
Local JavaScript syntax, catalogue integrity, paid-card routing and preserved upper layout checked. Live OAuth, payments and full visual browser testing cannot be claimed until provider configuration and deployment are completed.
