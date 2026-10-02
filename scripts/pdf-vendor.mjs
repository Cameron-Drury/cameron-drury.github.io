import { mkdir, copyFile, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../", import.meta.url));
const vendor = root + "assets/pdf-editor/vendor/";
await mkdir(vendor + "ocr", { recursive: true });
const copies = [
  ...["mupdf.js", "mupdf-wasm.js", "mupdf-wasm.wasm"].map((file) => [
    "mupdf/dist/" + file,
    file,
  ]),
  ["mupdf/LICENSE", "MuPDF-LICENSE.txt"],
  ["tesseract.js/dist/tesseract.esm.min.js", "tesseract.esm.min.js"],
  ["tesseract.js/dist/worker.min.js", "ocr/worker.min.js"],
  [
    "tesseract.js/dist/worker.min.js.LICENSE.txt",
    "ocr/worker.min.js.LICENSE.txt",
  ],
  ["tesseract.js/LICENSE.md", "Tesseract-LICENSE.txt"],
  ["tesseract.js-core/LICENSE", "ocr/Tesseract-Core-LICENSE.txt"],
  ...[
    "tesseract-core-lstm.wasm.js",
    "tesseract-core-simd-lstm.wasm.js",
    "tesseract-core-relaxedsimd-lstm.wasm.js",
  ].map((file) => ["tesseract.js-core/" + file, "ocr/" + file]),
];
await Promise.all(
  copies.map(([source, target]) =>
    copyFile(root + "node_modules/" + source, vendor + target),
  ),
);
await copyFile(
  root + "node_modules/mupdf/LICENSE",
  root + "assets/pdf-editor/LICENSE.txt",
);
const versions = Object.fromEntries(
  await Promise.all(
    ["mupdf", "tesseract.js", "tesseract.js-core"].map(async (name) => [
      name,
      JSON.parse(
        await readFile(root + "node_modules/" + name + "/package.json", "utf8"),
      ).version,
    ]),
  ),
);
await writeFile(
  vendor + "versions.json",
  JSON.stringify(versions, null, 2) + "\n",
);
console.log("Prepared local PDF and OCR engines: " + JSON.stringify(versions));
