# Akram Library — validation report
Date: 2026-09-21

## Passed locally
- 17 database authorization/workflow checks against PGlite (PostgreSQL-compatible), with simulated Supabase auth and storage schemas: public catalog, paid-file denial, unauthenticated order denial, role-escalation denial, self-entitlement denial, price-edit denial, order submission, idempotent submission, self-approval denial, direct status-update denial, cross-user order privacy, owner approval, idempotent approval, hiding books, purchased access after hiding, and denial to another buyer.
- 36 Chromium browser assertions across 390x844 and 1440x1000 viewports: search, language filter, eDahab tel URI, exclusive accordion, pending-order UI, logout UI, real PDF next/previous rendering, free PDF download visibility and file response, admin catalog list, edit price, hide, add with file inputs, archive, restore, approval UI, horizontal overflow, and uncaught JavaScript errors.
- Syntax checks on 10 application scripts.
- 80 local catalog asset references present.

## Scope and limits
Browser authentication, database and payment calls used an in-memory fixture, not live Supabase sessions. PDFs were real local files. SQL tests used simulated auth/storage schemas. No real payment was sent; no live Google/email login was completed. Tel links were inspected, not dialled. Browser viewports approximate phones; they do not verify a physical Android/iPhone dialer.

## Fixed during validation
Payment dialog close button could be covered by the content after scrolling; changed to a sticky 44px control. Updated curated book displays and prices to follow the managed catalog. Configured private bucket access and prevented anonymous catalog policy permission errors. Existing buyers retain access to hidden/archived purchases. SIM/EVC approvals share the same transaction reference uniqueness namespace.

## Required acceptance after deployment
Run SQL setup + seed + verified owner assignment, deploy files, upload paid PDFs, verify real login/logout and password reset, use two distinct accounts to test pending -> owner verified -> readable purchase, verify rejected orders cannot read, check the real dialer and provider recipient, test free downloads on real phone and PC. Verify paid PDFs are no longer publicly hosted; old Git history is a separate cleanup.

## Not implemented
Automatic EVC/eDahab settlement verification, card checkout, provider refunds, automatic notifications, cross-device reading progress/favorites, automatic backup restoration, native mobile app. These are not represented as active features.
