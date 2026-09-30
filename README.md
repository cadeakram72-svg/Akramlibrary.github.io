# Akram Library — premium collection

A React 19 / TypeScript / Tailwind CSS 3 component application, mounted **only after the existing Welcome section**. The original header, architectural hero and full Welcome markup are preserved. Static deployment is compatible with the existing GitHub Pages repository; no Node server or Next.js hosting is required.

## Rebuild

Use Node.js 20 or newer:

```
npm ci
npm run typecheck
npm run build
```

Run from this source folder. By default, build outputs `storefront.js` and `storefront.css` to the sibling `akram-upload-ready` folder. Set `AKRAM_OUTPUT_DIR` to choose a different output folder. Upload the two compiled files to the GitHub Pages site root after changes. The first installation additionally needs the index, integration files and images in GITHUB_UPLOAD.

## Structure

- `src/main.tsx`: state, catalog fetch, preserved-header event bridge, section composition.
- `src/components/Layout.tsx`: announcement, collection navigation, hero, categories, trust and footer.
- `src/components/UI.tsx`: reusable book card/grid, wishlist, ratings, accessible native dialog.
- `src/components/Commerce.tsx`: search/filter controls, details, bag/order summary, reviews and subscriptions.
- `src/components/Reader.tsx`: text reader with pagination, theme, type size, bookmarks and fullscreen.
- `src/types.ts`, `src/lib.ts`: types, persistence, category matching, pagination.
- `src/styles.css`: entirely scoped to `#akram-storefront`; Tailwind preflight is disabled.
- `setup/04_REVIEWS_NEWSLETTER.sql`: additive optional migration; run after the previous owner/database setup.
- `tests/`: functional UI and SQL policy tests.

## Existing integrations

`backend.js` supplies the managed Supabase catalog and shared authentication client. Public catalog reading is independent of the auth SDK. `shop.js` retains the EVC/eDahab/SIM dialer and manual transaction-reference order workflow. `read.html` remains the PDF reader. `member-nav.js` retains My Profile, owner dashboard and purchases links. English public-domain text books use the new React reader.

The catalog is authoritative: this redesign adds no new licensed book files, fabricated reviews, sales statistics or card-payment processing. The card grid features existing Somali books and public-domain English books. A bag permits one digital license per title/account; there is no shipping or physical quantity checkout. Each paid book uses the existing individual order flow. Prices are read from the database.

## Optional database features

The migration enables public reading of published reviews, authenticated review writes (one per user/book, requiring entitlement for paid books), and newsletter email collection. It does **not send emails** or connect an email marketing provider. Newsletter access is owner-only; unsubscribe/correction requests go to the contact email. Before sending bulk newsletters, configure a mail provider with confirmation/unsubscribe flows. Existing payment verification remains manual.

## Images

Original project-bound photographs were produced with the built-in image generation tool and optimized to WebP:

- The collection introduction now displays the actual uploaded book covers (Hoggaami Naftaada, Xuska Mawliidka and Maxaynu u Dhibaataysannahay). The illustrative Art of Reading photograph is no longer used.
- `storefront-reading.webp`: open book, glasses, coffee and blanket beside a forest-green chair.

Generated imagery is decorative, not a product offered for purchase. All real book-cover images remain the existing catalog assets.

## Tests

Tests ran at 1440px desktop and 390px mobile using a local catalog fixture and mocked authentication/newsletter responses. Real OAuth, mobile carrier dialing, payment receipt, and remote production deployment were not executed by these tests. See TEST_REPORT.md.

For independent testing, install Playwright and @electric-sql/pglite in this source folder, install a Playwright Chromium browser, place the existing static site at a sibling `akram-upload-ready`, and invoke tests from the parent directory. `AKRAM_CHROMIUM` can specify a Chromium binary. `PLAYWRIGHT_MODULE` / `PGLITE_MODULE` can point to installed module paths. Tests start their own local HTTP server on port 8765.

## Ownership and updates

Keep this source archive and the site repository backed up. Never put a Supabase service-role key, Google client secret, payment API secret, or private paid PDF into public GitHub. This update contains no such secrets or PDFs. Changes to book data/prices belong in the existing owner dashboard, not in the React source.
