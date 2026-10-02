# Drury Module website

Static GitHub Pages site for Drury Module’s software and games, including Cam’s Free Software, Idle Ant Colony and Game Central. The build generates 12 HTML pages, a sitemap, robots.txt and a page manifest. Generated HTML and bundled browser assets are committed to the repository; GitHub Pages serves them directly.

GitHub Pages publishes this site from the repository’s `main` branch and root directory. Verify the deployment and public pages after pushing a new revision; local previews do not publish changes.

## Local development

Requires Node.js, npm and Python 3. The PDF editor also needs a modern browser with JavaScript, WebAssembly and Web Workers. Install the dependencies and Chromium once:

```sh
npm ci
npx playwright install chromium
```

Build and verify the generated site, then start the preview:

```sh
npm run build
npm run check
npm run preview
```

Open [the local preview](http://127.0.0.1:4173), [the software catalog](http://127.0.0.1:4173/software/) or [the PDF editor](http://127.0.0.1:4173/software/pdf-editor/). `npm run build` copies the installed PDF/OCR engines into local browser assets, then generates the site. `npm run check` validates generated pages’ local links, assets, anchors, headings and metadata.

Run the PDF engine checks after building:

```sh
npm run test:pdf
```

Run browser checks in a separate terminal while `npm run preview` is running:

```sh
npm run test:browser
npm run test:pdf:browser
node scripts/pdf-advanced-check.mjs
node scripts/catalog-check.mjs
```

The advanced PDF check generates its own fixtures, then verifies overlapping text and images, native annotation geometry, and choice, multiline, readonly and radio form fields through exported PDFs. Its fixtures, downloads, screenshots and results use `PDF_QA_DIR`, or a `pdf-qa/` directory beside the checkout by default. It requires the preview for its browser checks.

The catalog check verifies navigation, the one real app, search, reset and responsive grid capacity up to six columns. Its extra cards exist only in the test browser DOM. Screenshots and results default to a `catalog-qa/` directory beside the checkout; set `CATALOG_OUTPUT` to use a different directory.

To use an installed Chrome instead of downloading Chromium on macOS:

```sh
BROWSER_EXECUTABLE_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" npm run test:browser
```

## Where to edit

- `scripts/build.mjs`: site templates, free software catalog entries, product copy, navigation, contact address and App Store links.
- `scripts/pdf-app-template.mjs`: the standalone PDF editor HTML at `/software/pdf-editor/`.
- `scripts/policies.mjs`: privacy policy content.
- `scripts/support-data.mjs`: support FAQs.
- `assets/css/site.css`, `assets/js/site.js` and `assets/js/catalog.js`: site styling, animation, navigation, catalog filtering and the email draft builder.
- `assets/pdf-editor/editor.css` and `assets/pdf-editor/src/app.mjs`: PDF workspace styling and browser interactions.
- `assets/pdf-editor/src/engine.mjs` and `assets/pdf-editor/worker.mjs`: PDF document operations and their serial Web Worker bridge.
- `assets/pdf-editor/src/ocr.mjs` and `assets/pdf-editor/src/drafts.mjs`: English text recognition and local browser draft storage.
- `scripts/pdf-vendor.mjs` and `assets/pdf-editor/vendor/`: bundled MuPDF, Tesseract and English OCR data, with upstream licenses and version metadata.
- `assets/images/`: local artwork and social images.

Rebuild after content changes. Avoid editing generated HTML directly, as the next build replaces it. Support forms only prepare a draft in the visitor’s email app; there is no form submission server.

The Software navigation opens `/software/`, the **Cam’s Free Software** catalog by Drury Module. It currently lists one app, **Cam’s PDF Editor**, at `/software/pdf-editor/`. The grid grows with real catalog entries and uses up to six columns on wide screens. The homepage introduces the free tools and the games. Software enquiries can use the project email link or select “Software project” in the support form; PDF editor support can select “Cam’s PDF Editor”.

## Cam’s PDF Editor

The editor processes PDFs on the visitor’s device. Documents, images, signatures and OCR input are never uploaded to a document service. App code, the PDF engine and the English OCR model are served as local assets from this site. Loading these assets requires a connection; local processing does not imply that the whole site is an installable offline app.

The workspace supports:

- Opening PDFs, document search, page thumbnails, bookmarks, zoom and undo/redo.
- Adding and replacing text, inserting and replacing images, highlights, underlines, strikeouts, drawing, shapes, notes and stamps. Selected text, images and annotations can be moved or resized with drag handles; arrow keys move the selection.
- Merging, extracting, duplicating, deleting, reordering, rotating and cropping pages, plus blank pages, page numbers and watermarks.
- Filling supported PDF form fields, placing visual signatures, permanent redaction and English OCR for scanned pages.
- PDF downloads with compression, annotation/form flattening, metadata removal and optional password protection.

Signatures are drawn, typed or inserted as images. They are visual marks; certificate signing and certificate validation are not supported. Replacement text uses standard fonts and a CJK fallback, so the original embedded font may be substituted. Some scripts and characters cannot be inserted with the bundled fonts and produce an explicit error. Replacing a text box does not reflow an entire document.

OCR uses the bundled English model and adds a searchable text layer. Its accuracy depends on the scan; check recognised text before relying on it. Large documents, high zoom levels and OCR can exceed a phone’s memory or take time. The engine limits oversized page renders and reports errors so the user can lower the zoom or use a larger device.

Local drafts use IndexedDB in the current browser. They stay on that device and can disappear when browser data is cleared. Download the edited PDF to keep a copy. No account or cloud synchronisation is provided.

The PDF editor source under `assets/pdf-editor/` is licensed under **AGPL-3.0-or-later**; see [`assets/pdf-editor/LICENSE.txt`](assets/pdf-editor/LICENSE.txt). It includes MuPDF under the same license and Tesseract components under their bundled upstream licenses. License texts and engine versions are shipped in `assets/pdf-editor/vendor/`. This editor license does not change the licenses of unrelated site artwork or games.

## Public URLs

These are the App Store marketing/developer, support and privacy URLs. Verify they load publicly before entering them in App Store Connect.

| Product         | Marketing / developer                                                    | Support                                                                 | Privacy                                                                 |
| --------------- | ------------------------------------------------------------------------ | ----------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Drury Module    | [Developer website](https://cameron-drury.github.io/)                    | [Support centre](https://cameron-drury.github.io/support/)              | [Website privacy](https://cameron-drury.github.io/privacy/#website)     |
| Idle Ant Colony | [Marketing page](https://cameron-drury.github.io/games/idle-ant-colony/) | [App support](https://cameron-drury.github.io/support/idle-ant-colony/) | [App privacy](https://cameron-drury.github.io/privacy/idle-ant-colony/) |
| Game Central    | [Marketing page](https://cameron-drury.github.io/games/game-central/)    | [App support](https://cameron-drury.github.io/support/game-central/)    | [App privacy](https://cameron-drury.github.io/privacy/game-central/)    |

Idle Ant Colony links to its [verified App Store listing](https://apps.apple.com/au/app/idle-ant-colony/id6755945955). Game Central deliberately says “Coming soon” and has no invented App Store URL. Add its actual listing URL in `scripts/build.mjs` when available.

## Deployment and protected content

The GitHub Pages source is the `main` branch, repository root (`/`). Include the rebuilt HTML, assets and metadata in the deployment, then verify the public links above. `.nojekyll` keeps the generated site as static files. Building or previewing locally does not publish anything.

**`kyna.html` is completely off limits.** Do not edit, rename, delete or reformat it. It is excluded from the build and generated-page link checks. Preserve `app-ads.txt` unchanged; it is retained for the existing advertising setup.

## App Store follow-up

Idle Ant Colony’s current App Store privacy label says “Data Not Collected”, while its existing privacy policy and app source include Google AdMob. The owner needs to reconcile the App Store Connect privacy disclosures with the SDK behaviour as a separate action. The new website policy describes advertising data handling; publishing it does not change App Store Connect. Update each app’s submitted marketing, support and privacy URLs only after the website deployment is verified.
