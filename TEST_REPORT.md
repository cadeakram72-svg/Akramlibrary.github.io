# Validation — 27 September 2026

## Passed

- TypeScript strict check and production esbuild/Tailwind build.
- Byte-for-byte comparison: preserved body markup for the original header, hero and Welcome matches the pre-update version.
- 33 local browser assertions across 1440×1000 and 390×1000: catalog card counts, English/Somali shelves, no horizontal overflow, search results and empty state, language filter, wishlist count, add/remove bag items, book detail, actual local text pagination next/previous, Somali language switch, and mocked newsletter success. No uncaught page errors.
- 13 PGlite SQL checks: additive migration can run twice; anonymous subscription; normalized unique email; private subscriber-table access; invalid email rejection; unauthenticated review denial; authenticated review; no unowned paid-book review; hidden-title denial; rating validation; existing review update; public identity column inaccessible; duplicate subscriptions do not duplicate rows.
- Desktop and mobile screenshots inspected after the production build. Long titles clamped, reader modal and bag are responsive.

## Boundaries

Authentication, review/subscription persistence and payment flows in production depend on the existing Supabase setup and the new optional migration. Browser tests used a local catalog fixture, a mocked signed-out auth client and mocked review/subscription HTTP responses. They do not prove live Google login or real payment settlement. SQL tests simulate the relevant auth schema/roles locally. The new migration has not been run on the live project by the assistant.

The generated images are decorative original assets. Existing catalog covers and book files are reused. No changes were made to payment amounts in the database or to the original header/hero/Welcome content. No remote files were deployed.
