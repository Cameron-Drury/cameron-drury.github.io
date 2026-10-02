import assert from "node:assert/strict";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import * as engine from "../assets/pdf-editor/src/engine.mjs";
import mupdf from "../assets/pdf-editor/vendor/mupdf.js";

const root = fileURLToPath(new URL("../", import.meta.url));
const output =
  process.env.PDF_QA_DIR ||
  fileURLToPath(new URL("../../pdf-qa/", import.meta.url));
await mkdir(output, { recursive: true });
const sample = new Uint8Array(
  await readFile(root + "assets/pdf-editor/sample.pdf"),
);
const pixel = new Uint8Array(
  Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=",
    "base64",
  ),
);
const checks = [];
function test(name, fn) {
  engine.open(sample);
  try {
    fn();
    checks.push({ name, passed: true });
  } catch (error) {
    checks.push({ name, passed: false, error: error.message });
    console.error(name + ": " + error.stack);
  }
}
function readOutput(bytes, fn, password) {
  const doc = new mupdf.PDFDocument(bytes);
  try {
    if (password) assert.ok(doc.authenticatePassword(password));
    return fn(doc);
  } finally {
    doc.destroy();
  }
}
function text(doc, i) {
  const page = doc.loadPage(i);
  const structured = page.toStructuredText();
  try {
    return structured.asText();
  } finally {
    structured.destroy();
    page.destroy();
  }
}
function outputText(bytes, i) {
  return readOutput(bytes, (doc) => text(doc, i));
}
function line(i, phrase) {
  const item = engine
    .render(i, 0.5)
    .textBlocks.find((x) => x.text.includes(phrase));
  assert.ok(item, "Expected text line: " + phrase);
  return item;
}
function widgets(bytes, i) {
  return readOutput(bytes, (doc) => {
    const page = doc.loadPage(i);
    const fields = page.getWidgets();
    try {
      return fields.map((w) => ({ name: w.getName(), value: w.getValue() }));
    } finally {
      fields.forEach((w) => w.destroy());
      page.destroy();
    }
  });
}

test("Open/render/search/outline", () => {
  assert.equal(engine.info().pageCount, 3);
  assert.equal(engine.render(0, 1).width, 596);
  assert.ok(engine.info().outline.length);
  assert.equal(engine.search("SECRET-4827")[0].page, 1);
});
test("Existing text replacement removes source text", () => {
  const target = line(1, "Confidential reference");
  engine.mutate({
    type: "replaceText",
    page: 1,
    ...target,
    text: "Safe reference: PUBLIC-100",
    targetRect: [target.rect[0], target.rect[1], 550, target.rect[3] + 5],
    clip: false,
  });
  const result = outputText(engine.save(), 1);
  assert.ok(result.includes("PUBLIC-100"));
  assert.ok(!result.includes("SECRET-4827"));
});
test("Unicode editable text and output reopening", () => {
  engine.mutate({
    type: "text",
    page: 0,
    rect: [60, 350, 550, 400],
    text: "Café — £20 • 中文",
    fontSize: 16,
  });
  const result = outputText(engine.save(), 0);
  for (const phrase of ["Café", "£20", "中文"])
    assert.ok(result.includes(phrase), result);
});
test("Undo/redo exports the correct content", () => {
  engine.mutate({
    type: "text",
    page: 0,
    rect: [60, 350, 550, 400],
    text: "UNDO-CHECK",
    fontSize: 16,
  });
  assert.ok(engine.info().canUndo);
  engine.undo();
  assert.ok(!outputText(engine.save(), 0).includes("UNDO-CHECK"));
  engine.redo();
  assert.ok(outputText(engine.save(), 0).includes("UNDO-CHECK"));
});
test("Failed action rolls back all preceding changes", () => {
  const before = engine
    .extractText()
    .map((x) => x.text)
    .join("");
  const target = line(1, "Confidential");
  assert.throws(() =>
    engine.mutate({
      type: "replaceText",
      page: 1,
      ...target,
      text: "Too much text for this line box",
      fontSize: 80,
    }),
  );
  assert.equal(
    engine
      .extractText()
      .map((x) => x.text)
      .join(""),
    before,
  );
});
test("Annotations survive export and can be edited/deleted", () => {
  for (const type of [
    "highlight",
    "underline",
    "strikeout",
    "rectangle",
    "ellipse",
    "note",
    "stamp",
  ])
    engine.mutate({
      type,
      page: 0,
      rect: [50, 300, 240, 330],
      text: type === "stamp" ? "Approved" : "Review this",
      color: "#78629d",
    });
  for (const type of ["ink", "line", "arrow"])
    engine.mutate({
      type,
      page: 0,
      points: [
        [60, 340],
        [80, 360],
        [150, 355],
      ],
      color: "#78629d",
    });
  const first = engine.render(0, 0.5).annotations[0];
  engine.mutate({
    type: "editAnnotation",
    page: 0,
    id: first.id,
    text: "Changed note",
  });
  readOutput(engine.save(), (doc) => {
    const page = doc.loadPage(0);
    const annotations = page.getAnnotations();
    try {
      assert.equal(annotations.length, 10);
      assert.equal(annotations[0].getContents(), "Changed note");
    } finally {
      annotations.forEach((a) => a.destroy());
      page.destroy();
    }
  });
  engine.mutate({ type: "deleteAnnotation", page: 0, id: first.id });
  assert.equal(engine.render(0, 0.5).annotations.length, 9);
});
test("Fillable text and checkbox values persist without flattening", () => {
  engine.mutate({
    type: "formValue",
    page: 2,
    name: "full_name",
    value: "Cameron Drury",
  });
  engine.mutate({ type: "formValue", page: 2, name: "agreement", value: true });
  const bytes = engine.save();
  assert.deepEqual(widgets(bytes, 2), [
    { name: "full_name", value: "Cameron Drury" },
    { name: "agreement", value: "Yes" },
  ]);
  readOutput(bytes, (doc) =>
    assert.equal(doc.getTrailer().get("Root", "AcroForm", "Fields").length, 2),
  );
});
test("Explicit flattening removes widgets and retains visible values", () => {
  engine.mutate({
    type: "formValue",
    page: 2,
    name: "full_name",
    value: "Flattened Name",
  });
  const bytes = engine.save({ flatten: true });
  assert.equal(widgets(bytes, 2).length, 0);
  assert.ok(outputText(bytes, 2).includes("Flattened Name"));
});
test("Genuine redaction removes text and its search results", () => {
  const target = line(1, "Confidential");
  engine.mutate({ type: "redact", page: 1, rect: target.rect });
  assert.ok(engine.search("SECRET-4827").length);
  engine.mutate({ type: "applyRedactions", all: true });
  assert.equal(engine.search("SECRET-4827").length, 0);
  const bytes = engine.save();
  assert.ok(!outputText(bytes, 1).includes("SECRET-4827"));
  assert.ok(!Buffer.from(bytes).includes(Buffer.from("SECRET-4827")));
});
test("Secure redaction works on ordinary PDFs without forms", () => {
  engine.create(595, 842);
  engine.mutate({
    type: "text",
    page: 0,
    rect: [60, 150, 500, 180],
    text: "PLAIN-SECRET",
    fontSize: 16,
  });
  engine.mutate({
    type: "metadata",
    metadata: { title: "PRIVATE-METADATA", author: "PRIVATE-AUTHOR" },
  });
  engine.mutate({ type: "redact", page: 0, rect: [55, 145, 505, 185] });
  engine.mutate({ type: "applyRedactions", all: true });
  const bytes = engine.save();
  assert.ok(!outputText(bytes, 0).includes("PLAIN-SECRET"));
  readOutput(bytes, (doc) => {
    assert.ok(!doc.getMetaData("info:Title"));
    assert.ok(!doc.getMetaData("info:Author"));
  });
});
test("Redaction also removes sensitive annotation contents and form fields", () => {
  engine.mutate({
    type: "freeText",
    page: 0,
    rect: [60, 350, 300, 400],
    text: "ANNOTATION-SECRET",
    fontSize: 15,
  });
  engine.mutate({ type: "redact", page: 0, rect: [55, 345, 305, 405] });
  engine.mutate({
    type: "formValue",
    page: 2,
    name: "full_name",
    value: "FORM-SECRET",
  });
  const field = engine
    .render(2, 0.5)
    .widgets.find((w) => w.name === "full_name");
  engine.mutate({ type: "redact", page: 2, rect: field.rect });
  engine.mutate({ type: "applyRedactions", all: true });
  const bytes = engine.save();
  assert.ok(!outputText(bytes, 0).includes("ANNOTATION-SECRET"));
  assert.ok(!widgets(bytes, 2).some((w) => w.name === "full_name"));
  readOutput(bytes, (doc) => {
    const fields = doc.getTrailer().get("Root", "AcroForm", "Fields");
    fields.forEach((f) =>
      assert.notEqual(f.get("V").asString(), "FORM-SECRET"),
    );
  });
});
test("Rotate then edit uses displayed coordinates", () => {
  engine.mutate({ type: "rotate", page: 0, degrees: 90 });
  const p = engine.render(0, 0.5);
  assert.ok(p.bounds[2] > p.bounds[3]);
  engine.mutate({
    type: "text",
    page: 0,
    rect: [60, 350, 550, 400],
    text: "ROTATED-EDIT",
    fontSize: 16,
  });
  assert.ok(outputText(engine.save(), 0).includes("ROTATED-EDIT"));
});
test("Crop then edit preserves page coordinate placement", () => {
  engine.mutate({ type: "crop", page: 0, rect: [30, 30, 550, 800] });
  const p = engine.render(0, 0.5);
  assert.ok(Math.abs(p.bounds[2] - p.bounds[0] - 520) < 1);
  engine.mutate({
    type: "text",
    page: 0,
    rect: [60, 350, 500, 400],
    text: "CROPPED-EDIT",
    fontSize: 16,
  });
  assert.ok(outputText(engine.save(), 0).includes("CROPPED-EDIT"));
});
test("Page insertion, duplication, reordering, extraction and deletion", () => {
  engine.mutate({ type: "blankPage", at: 1 });
  assert.equal(engine.info().pageCount, 4);
  engine.mutate({ type: "duplicatePages", pages: [0], at: 4 });
  assert.equal(engine.info().pageCount, 5);
  engine.mutate({ type: "reorderPages", order: [4, 0, 1, 2, 3] });
  const extracted = engine.extract([0, 4]);
  readOutput(extracted, (doc) => {
    assert.equal(doc.countPages(), 2);
    assert.ok(text(doc, 0).includes("better ideas"));
  });
  assert.equal(widgets(extracted, 1).length, 2);
  readOutput(extracted, (doc) =>
    assert.equal(
      doc.getTrailer().get("Root", "AcroForm", "Fields").length,
      2,
      "Extracted fields must remain in canonical AcroForm tree",
    ),
  );
  readOutput(engine.save(), (doc) =>
    assert.equal(
      doc.getTrailer().get("Root", "AcroForm", "Fields").length,
      2,
      "Reordering must retain canonical forms",
    ),
  );
  engine.mutate({ type: "deletePages", pages: [1, 2] });
  assert.equal(engine.info().pageCount, 3);
});
test("Merge retains pages and usable canonical forms", () => {
  engine.mutate({ type: "merge", bytes: sample, at: 3 });
  assert.equal(engine.info().pageCount, 6);
  assert.equal(engine.render(5, 0.5).widgets.length, 2);
  const bytes = engine.save();
  readOutput(bytes, (doc) =>
    assert.ok(
      doc.getTrailer().get("Root", "AcroForm", "Fields").length >= 4,
      "Merged fields missing from canonical AcroForm tree",
    ),
  );
});
test("Duplicate form page retains independently usable fields", () => {
  engine.mutate({ type: "duplicatePages", pages: [2], at: 3 });
  assert.equal(engine.info().pageCount, 4);
  assert.equal(engine.render(3, 0.5).widgets.length, 2);
  const bytes = engine.save();
  readOutput(bytes, (doc) =>
    assert.ok(
      doc.getTrailer().get("Root", "AcroForm", "Fields").length >= 4,
      "Duplicated form fields missing from canonical tree",
    ),
  );
});
test("Images and signatures remain renderable after reopening", () => {
  for (const type of ["image", "signature"])
    engine.mutate({ type, page: 0, rect: [350, 400, 500, 460], bytes: pixel });
  const result = engine.render(0, 0.5);
  assert.ok(result.png.byteLength > 1000);
  readOutput(engine.save(), (doc) => {
    const page = doc.loadPage(0);
    const image = page.toPixmap(
      mupdf.Matrix.scale(0.5, 0.5),
      mupdf.ColorSpace.DeviceRGB,
    );
    assert.ok(image.asPNG().byteLength > 1000);
    image.destroy();
    page.destroy();
  });
});
test("Existing images can be replaced and removed", () => {
  engine.mutate({
    type: "image",
    page: 0,
    rect: [350, 400, 500, 460],
    bytes: pixel,
  });
  const image = engine.render(0, 0.5).imageBlocks.find((x) => x.rect[0] > 300);
  assert.ok(image);
  engine.mutate({
    type: "replaceImage",
    page: 0,
    rect: image.rect,
    bytes: pixel,
    targetRect: [100, 400, 200, 450],
  });
  const moved = engine.render(0, 0.5).imageBlocks.find((x) => x.rect[0] < 200);
  assert.ok(moved);
  engine.mutate({ type: "deleteImage", page: 0, rect: moved.rect });
  assert.equal(engine.render(0, 0.5).imageBlocks.length, 0);
});
test("OCR layer adds searchable text without changing page pixels", () => {
  const before = engine.render(0, 0.5).png;
  engine.mutate({
    type: "ocr",
    page: 0,
    lines: [
      { text: "OCR-LAYER-TEXT", rect: [60, 350, 400, 380], fontSize: 16 },
    ],
  });
  assert.ok(outputText(engine.save(), 0).includes("OCR-LAYER-TEXT"));
  assert.deepEqual(engine.render(0, 0.5).png, before);
});
test("Watermark, numbering, metadata and links persist", () => {
  engine.mutate({ type: "watermark", text: "REVIEW", opacity: 0.2 });
  engine.mutate({ type: "pageNumbers", prefix: "Page ", start: 10 });
  engine.mutate({
    type: "metadata",
    metadata: { title: "Verified PDF", author: "Cam" },
  });
  engine.mutate({
    type: "link",
    page: 0,
    rect: [50, 50, 200, 80],
    uri: "https://example.com",
  });
  const bytes = engine.save();
  assert.ok(outputText(bytes, 0).includes("REVIEW"));
  assert.ok(outputText(bytes, 0).includes("Page 10"));
  readOutput(bytes, (doc) => {
    assert.equal(doc.getMetaData("info:Title"), "Verified PDF");
    const page = doc.loadPage(0);
    const links = page.getLinks();
    assert.equal(links[0].getURI(), "https://example.com");
    links.forEach((l) => l.destroy());
    page.destroy();
  });
  assert.ok(
    !readOutput(engine.save({ clearMetadata: true }), (doc) =>
      doc.getMetaData("info:Title"),
    ),
  );
});
test("AES-256 passwords protect exported documents", () => {
  const bytes = engine.save({ password: "test-password" });
  readOutput(bytes, (doc) => {
    assert.ok(doc.needsPassword());
    assert.equal(doc.authenticatePassword("wrong"), 0);
    assert.ok(doc.authenticatePassword("test-password"));
    assert.equal(doc.countPages(), 3);
  });
  assert.equal(engine.open(bytes).needsPassword, true);
  assert.equal(engine.open(bytes, "test-password").pageCount, 3);
  readOutput(engine.save(), (doc) =>
    assert.ok(
      doc.needsPassword(),
      "Default save must preserve the opened PDF password",
    ),
  );
  readOutput(engine.extract([0]), (doc) =>
    assert.ok(
      doc.needsPassword(),
      "Extracted pages must preserve the source password",
    ),
  );
  readOutput(engine.save({ password: "" }), (doc) =>
    assert.ok(
      !doc.needsPassword(),
      "Explicit password removal must produce an unlocked PDF",
    ),
  );
});
test("Invalid and destructive page choices leave document intact", () => {
  assert.throws(() => engine.mutate({ type: "deletePages", pages: [0, 1, 2] }));
  assert.throws(() =>
    engine.mutate({ type: "reorderPages", order: [0, 0, 2] }),
  );
  assert.equal(engine.info().pageCount, 3);
  assert.throws(() =>
    engine.mutate({
      type: "link",
      page: 0,
      rect: [10, 10, 100, 30],
      uri: "javascript:alert(1)",
    }),
  );
});
test("Text movement and resizing persist in the PDF and undo", () => {
  const source = line(0, "A place to try"),
    r = source.rect;
  const target = [
    r[0] + 40,
    r[1] + 100,
    r[0] + 40 + (r[2] - r[0]) * 1.4,
    r[1] + 100 + (r[3] - r[1]) * 1.4,
  ];
  engine.mutate({
    type: "replaceText",
    page: 0,
    ...source,
    targetRect: target,
    fontSize: source.fontSize * 1.4,
    baseline: target[1] + (source.origin[1] - r[1]) * 1.4,
    clip: false,
    wrap: false,
  });
  const moved = line(0, "A place to try");
  assert.ok(Math.abs(moved.rect[0] - target[0]) < 1);
  assert.ok(Math.abs(moved.fontSize - source.fontSize * 1.4) < 0.1);
  readOutput(engine.save(), (doc) => {
    const p = doc.loadPage(0);
    try {
      const hits = p.search(source.text);
      assert.equal(hits.length, 1);
      assert.ok(hits[0][0][1] > r[1] + 90);
    } finally {
      p.destroy();
    }
  });
  engine.undo();
  assert.ok(Math.abs(line(0, "A place to try").rect[1] - r[1]) < 1);
});
test("Existing images move and resize without replacement bytes", () => {
  for (const type of ["image", "signature"])
    engine.mutate({ type, page: 0, rect: [60, 350, 180, 410], bytes: pixel });
  const before = engine.render(0, 0.5).imageBlocks;
  engine.mutate({
    type: "moveImage",
    page: 0,
    rect: before[0].rect,
    targetRect: [240, 450, 480, 570],
  });
  readOutput(engine.save(), (doc) => {
    const p = doc.loadPage(0),
      s = p.toStructuredText({ "preserve-images": true }),
      images = [];
    try {
      s.walk({
        onImageBlock(b, transform, image) {
          images.push(b);
          image.destroy();
        },
      });
      assert.ok(
        images.some(
          (b) => Math.abs(b[0] - 240) < 1 && Math.abs(b[2] - 480) < 1,
        ),
      );
    } finally {
      s.destroy();
      p.destroy();
    }
  });
  engine.undo();
  assert.equal(engine.render(0, 0.5).imageBlocks.length, before.length);
});
test("Native annotation geometry transforms with the selected frame", () => {
  for (const type of ["highlight", "ink", "arrow"]) {
    engine.mutate(
      type === "highlight"
        ? { type, page: 0, rect: [70, 350, 230, 380], color: "#7356b2" }
        : {
            type,
            page: 0,
            points: [
              [70, 450],
              [130, 480],
              [230, 460],
            ],
            color: "#7356b2",
          },
    );
    const annotation = engine.render(0, 0.5).annotations.at(-1),
      r = annotation.rect;
    const target = [
      r[0] + 80,
      r[1] + 60,
      r[0] + 80 + (r[2] - r[0]) * 1.5,
      r[1] + 60 + (r[3] - r[1]) * 1.5,
    ];
    engine.mutate({
      type: "transformAnnotation",
      page: 0,
      id: annotation.id,
      targetRect: target,
    });
    readOutput(engine.save(), (doc) => {
      const p = doc.loadPage(0),
        items = p.getAnnotations();
      try {
        const item = items.at(-1);
        const b = item.getBounds();
        assert.ok(
          Math.abs(b[0] - target[0]) < 5 && Math.abs(b[1] - target[1]) < 5,
          `${type} bounds ${b} expected ${target}`,
        );
        if (item.hasQuadPoints())
          assert.ok(item.getQuadPoints()[0][0] > r[0] + 70);
        if (item.hasInkList())
          assert.ok(item.getInkList()[0][0][0] > r[0] + 70);
        if (item.hasLine()) assert.ok(item.getLine()[0][0] > r[0] + 70);
      } finally {
        items.forEach((a) => a.destroy());
        p.destroy();
      }
    });
  }
});
test("Scanned text source boxes persist and remove all original pixels", () => {
  const raster = engine.render(0, 1.5).png;
  const sourceRect = [52.5, 231.5, 237, 242.5];
  engine.create(595, 842);
  engine.mutate({
    type: "image",
    page: 0,
    rect: [0, 0, 595, 842],
    bytes: raster,
  });
  engine.mutate({
    type: "ocr",
    page: 0,
    lines: [
      {
        text: "A place to try your new PDF editor.",
        rect: sourceRect,
        fontSize: 12,
        baseline: 240.85,
      },
    ],
  });
  engine.open(engine.save());
  const selected = line(0, "A place to try");
  assert.deepEqual(selected.sourceRect, sourceRect);
  engine.mutate({ type: "duplicatePages", pages: [0], at: 1 });
  assert.deepEqual(line(1, "A place to try").sourceRect, sourceRect);
  engine.mutate({
    type: "replaceText",
    page: 0,
    rect: selected.rect,
    text: "",
    replaceImagePixels: true,
  });
  const bytes = engine.save();
  assert.ok(!outputText(bytes, 0).includes("A place to try"));
  readOutput(bytes, (doc) => {
    const p = doc.loadPage(0),
      pixmap = p.toPixmap(
        mupdf.Matrix.identity,
        mupdf.ColorSpace.DeviceRGB,
        false,
        true,
      );
    try {
      const pixels = pixmap.getPixels(),
        channels = pixmap.getNumberOfComponents(),
        stride = pixmap.getStride();
      const colorAt = (x, y) => [
        ...pixels.slice(
          y * stride + x * channels,
          y * stride + x * channels + 3,
        ),
      ];
      const background = colorAt(40, 237);
      for (let y = 233; y <= 240; y++)
        for (let x = 54; x <= 235; x++)
          assert.ok(
            colorAt(x, y).every(
              (value, channel) => Math.abs(value - background[channel]) < 5,
            ),
            `Original scanned pixels remain at ${x},${y}`,
          );
      const records = p.getObject().get("CamsOCR");
      assert.equal(records.isNull() || records.length === 0, true);
    } finally {
      pixmap.destroy();
      p.destroy();
    }
  });
});
engine.open(sample);
engine.mutate({
  type: "formValue",
  page: 2,
  name: "full_name",
  value: "Cameron Drury",
});
engine.mutate({
  type: "text",
  page: 0,
  rect: [60, 350, 550, 400],
  text: "Export verified locally.",
  fontSize: 16,
});
await writeFile(output + "/edited.pdf", engine.save());
engine.close();
await writeFile(
  output + "/engine-results.json",
  JSON.stringify(checks, null, 2),
);
const failed = checks.filter((x) => !x.passed);
console.log(
  `PDF engine: ${checks.length - failed.length}/${checks.length} scenarios passed. Evidence: ${output}`,
);
if (failed.length) process.exitCode = 1;
