# Changed files

23 public files. Only these go in the existing GitHub Pages publish root.

- `SUPABASE_CLIENT_LICENSES.txt`
- `account.html`
- `account.js`
- `admin-production.js`
- `admin.html`
- `admin.js`
- `backend.js`
- `checkout.css`
- `checkout.html`
- `checkout.js`
- `index.html`
- `member-nav.js`
- `privacy.html`
- `purchases.html`
- `purchases.js`
- `read.html`
- `read.js`
- `reading-sync.js`
- `refund.html`
- `refund.js`
- `storefront.js`
- `supabase-client.js`
- `terms.html`

## Removed from the local public tree

- `assets--books--dhis-naftaada.pdf` — original preserved privately; remove public deployment copy separately.
- `assets--books--ganacsade.pdf` — original preserved privately; remove public deployment copy separately.

## Source/backend

- React: src/components/Reader.tsx, Library.tsx, Layout.tsx and src/types.ts; rebuilt storefront.js.
- SERVER/supabase/migrations/05_PROVIDER_FOUNDATION.sql, 06_COMPLETION.sql, 07_OPERATIONS.sql.
- SERVER/supabase/functions/akram-commerce/index.ts, handler.ts, security.ts.
- SERVER/supabase/config.toml, preflight, scheduler and secrets template.
- SERVER/tests, scripts, dependency lock, deployment/testing guides and verification report.

Catalog and book-asset data are unchanged. No paid PDF or real secret is included.
