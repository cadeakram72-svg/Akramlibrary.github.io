# AKRAM LIBRARY — GitHub Pages edition

Owner: Akram · Contact: cadeakram72@gmail.com

## Waxa ku jira / Included
31 books; original library room design; approved green reader logo; English/Somali UI; search and filtering; favorites and reading lists; text and PDF readers; PDF download; book credits; zoom, themes and bookmarks.

This is a static export for GitHub Pages, not a deployment of the original server application. The original private Site has not been changed. There are no passwords, secret keys, payment references or user database exports in this package.

## Xadka noocan / Limitations
- No working Google login. The supplied OAuth client ID alone is not authentication infrastructure.
- No authenticated admin dashboard, online uploads, payments or cross-device sync.
- Book management is through repository files and catalog.json.
- Favorites/progress/bookmarks are browser-local. Clearing browser data removes them.
- No mobile application, push notifications or offline website cache. Downloaded PDFs can be opened offline in a PDF app.
- UI translation covers common controls; books remain in their original language.
- GitHub Free Pages uses a public repository: all uploaded website code and book files are publicly accessible. Never upload private records or secrets.
- Removing a book later does not retract copies already downloaded or stored in Git history.

## Tallaabooyinka GitHub / Setup
1. Create a GitHub account or sign in. Your username determines the free address.
2. Create a PUBLIC repository named EXACTLY YOUR-USERNAME.github.io (replace YOUR-USERNAME with your real GitHub username). Example only: username akramreader -> repository akramreader.github.io -> https://akramreader.github.io. Availability of this example is not guaranteed.
3. Extract this ZIP. Upload the CONTENTS of the akram-github-pages folder, not the ZIP and not an extra enclosing folder. index.html must appear at the repository root.
4. In the repository choose Add file > Upload files. Upload root files and the assets folder; split into batches if the browser upload limit is reached. Commit changes after each batch. Preserve folder names and file names exactly.
5. Check that assets/books contains four PDF files and their covers, and assets contains the text/cover subfolders plus pdf.mjs and pdf.worker.mjs.
6. ONLY WHEN READY TO MAKE THE WEBSITE PUBLIC: Settings > Pages > Source: Deploy from a branch > Branch: main > Folder: /(root) > Save.
7. GitHub displays the actual URL. Publication may take up to 10 minutes. If a 404 remains, confirm repository name, index.html location and Pages deployment status.
8. Test search, Somali/English switch, each of the four PDFs, next/previous page, download, favorites and mobile layout.

A project repository named akram-library also works at https://YOUR-USERNAME.github.io/akram-library/ because local asset paths are relative.
A github.io address is free; akramlibrary.com is NOT provided free by GitHub. You can connect an owned custom domain later. Do not add a CNAME for a domain you do not own.

## Local preview / Tijaabo laptop
Install Python if needed, open a terminal in this folder, and run:

    python -m http.server 8000

Open http://localhost:8000 in your browser. Do not double-click index.html: fetching JSON/PDF may be blocked on file:// URLs. Stop with Ctrl+C.

## Add or remove a book / Buug ku dar ama ka saar
1. Keep a copy of catalog.json first.
2. Upload the PDF into assets/books/my-book.pdf and cover into assets/books/my-book.jpg. Use short lowercase file names without spaces.
3. Add a catalog entry following BOOK-EXAMPLE.json. Copy the OBJECT into the catalog ARRAY, separated from other entries by a comma. All IDs must be unique.
4. Set paid:false and price:0. Paid access is not supported by this edition.
5. Include the correct author, translator, description, category, page count and rights notice. Keep the original PDF notices intact.
6. Commit your changes. Refresh after GitHub completes deployment.
7. To hide a book, remove its object from catalog.json. To remove direct downloads too, also delete its PDF and cover files. Old public copies may remain available elsewhere or in Git history.

## Updating the design later
Edit index.html (layout/text), style.css (homepage styles), reading-room.css (PDF reading styles), app.js (discovery/text reader), read.js (PDF reader), locale.js (UI translation). Keep a Git commit before changes; use GitHub history to restore earlier source versions.
Keep a ZIP backup of the repository on a second device or cloud storage. This does not back up browser-local reader preferences.

## Google and server migration
Before restoring Google login/admin uploads, select and configure a real backend with server-validated identity, authorization and durable storage. Do not simulate sign-in by decoding an unverified token or saving an email in localStorage. Never put an OAuth client secret in browser code or a public repository. The previous Sites-specific sign-in endpoints and headers will not work on GitHub Pages.

## Sources
https://docs.github.com/en/pages/quickstart
https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages
https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site

Book copyright and licenses belong to their respective rights holders. Preserve source attribution and original notices. This package grants no additional rights to third-party books or libraries.
