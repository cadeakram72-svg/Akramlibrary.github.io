# AKRAM LIBRARY — Owner Dashboard Edition (21 September 2026)

Run 01_SETUP.sql, 02_CATALOG.sql and 03_OWNER.sql in your own Supabase SQL Editor BEFORE deploying this edition. They are supplied in Akram_Admin_Install.zip, alongside the Somali administration guide.

The front end is hosted on GitHub Pages. Supabase provides authentication, the managed catalog, manual order review, purchase entitlements and private PDF storage. The configured backend is required; an unavailable backend does not silently resurrect hidden books from the old catalog.

Owner dashboard: admin.html
Customer purchases: purchases.html
Owner email: cadeakram72@gmail.com

Payment collection through wallet USSD is followed by manual owner verification. No bank-card processor or automatic EVC/eDahab payment API is enabled. Never confirm an order based only on a screenshot. Verify the real provider transaction and amount first.

Paid PDFs must be uploaded through the dashboard. They are not included in this distribution. Delete any older public paid PDFs from your repository separately. Existing git history, caches and downloaded copies are not removed by this package. A browser reader cannot guarantee prevention of copying or screenshots.

Favorites and reading progress remain device-local. Purchases are account-linked after setup and approval.

Validation: local browser tests use a mock authentication/payment backend; database security tests run in local PostgreSQL-compatible PGlite. Live Google/email login, real provider payments and real Supabase deployment remain required owner acceptance tests. See HAGE_MAAMUL.html and TEST_REPORT.md in the installation package.
