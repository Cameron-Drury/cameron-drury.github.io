# Cam's PDF Editor source and licences

Cam's PDF Editor application code is free software under the GNU Affero General Public License, version 3 or later. Copyright 2026 Drury Module Pty Ltd. The full licence is in LICENSE.txt.

The browser application source is supplied as readable JavaScript modules in `src/`, alongside `worker.mjs`, `editor.css` and `scripts/pdf-app-template.mjs`. Reproduce the deployed application with `npm ci && npm run build` from the repository source: https://github.com/Cameron-Drury/cameron-drury.github.io

This application-specific licence does not change licences or ownership of unrelated website content or games.

Third-party components:

- MuPDF, Artifex Software Inc., AGPL-3.0-or-later. Exact packaged version in vendor/versions.json. JavaScript wrapper and WebAssembly are copied unmodified from the pinned npm package. Corresponding upstream source and build instructions: https://github.com/ArtifexSoftware/mupdf and https://mupdf.readthedocs.io/en/latest/mupdf-wasm.html. Licence: vendor/MuPDF-LICENSE.txt.
- Tesseract.js and Tesseract.js-core, Apache-2.0. Exact versions in vendor/versions.json. Sources: https://github.com/naptha/tesseract.js and https://github.com/naptha/tesseract.js-core. Licences in vendor/ and vendor/ocr/.
- English recognition data, Tesseract tessdata_fast, Apache-2.0. Source: https://github.com/tesseract-ocr/tessdata_fast. Its English data file is shipped locally so recognition never uploads a document or requests a third-party service.

All PDF and OCR processing happens on the visitor's device. GitHub Pages serves the application files; no document data is sent to a processing server.
