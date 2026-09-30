# Reproducing verification

Use an isolated test environment. Test data is confined to the test process; no real payment provider is contacted by the automated suites.

SERVER contains package.json/package-lock.json, tests, reference/01_SETUP.sql and supabase/. Install with `npm ci`. Node 24+ is used for TypeScript stripping in security.mjs; Deno runs the server contract test. Run:

```sh
npm run test:db
npm run test:security
npm run test:server
```

Merge GITHUB_UPDATE into a complete local copy of the existing website first. Do not replace that website with GITHUB_UPDATE alone; images/free books are deliberately unchanged and absent from the patch. Set AKRAM_SITE_DIR to the absolute merged website directory for reading-sync.cjs and browser.cjs. The browser script defaults to the author's Linux Chromium path; use your Playwright-installed Chromium path via AKRAM_CHROMIUM when outside that environment. Run `npx playwright install chromium` as needed.

The screenshots show clearly named fixture purchases; they are not evidence of a live transaction. For a real end-to-end acceptance run, follow DEPLOYMENT.md with controlled accounts in provider sandbox, then an owner-authorized live transaction. Never make fake “paid” rows in production to demonstrate success.

React source build: from SOURCE/akram-storefront-src run `npm ci`, `npm run typecheck`, then `npm run build`, setting AKRAM_OUTPUT_DIR to the merged website directory. Build the local auth SDK from SERVER with `node scripts/build-auth.mjs`, setting AKRAM_AUTH_OUTPUT to the destination supabase-client.js. Keep dependency licence notices with that bundle.
