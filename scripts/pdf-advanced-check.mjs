import assert from "node:assert/strict";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import mupdf from "../assets/pdf-editor/vendor/mupdf.js";
import * as engine from "../assets/pdf-editor/src/engine.mjs";

// This suite uses generated fixtures to catch regressions that a normal document
// cannot expose: neighboring content overlaps, native geometry, and form types.
const output =
  process.env.PDF_QA_DIR ||
  fileURLToPath(new URL("../../pdf-qa/", import.meta.url));
const base = process.env.SITE_URL || "http://127.0.0.1:4173";
const checks = [];
const errors = [];
await mkdir(output, { recursive: true });

async function check(name, fn) {
  try {
    await fn();
    checks.push({ name, passed: true });
    console.log("PASS " + name);
  } catch (error) {
    checks.push({ name, passed: false, error: error.message });
    console.error("FAIL " + name + ": " + error.message);
  }
}
function readPDF(bytes, fn) {
  const document = new mupdf.PDFDocument(bytes);
  try {
    return fn(document);
  } finally {
    document.destroy();
  }
}
function withPage(document, fn) {
  const page = document.loadPage(0);
  try {
    return fn(page);
  } finally {
    page.destroy();
  }
}
function text(bytes) {
  return readPDF(bytes, (document) =>
    withPage(document, (page) => {
      const structured = page.toStructuredText();
      try {
        return structured.asText();
      } finally {
        structured.destroy();
      }
    }),
  );
}
function nativeImages(bytes) {
  return readPDF(bytes, (document) =>
    withPage(document, (page) => {
      const structured = page.toStructuredText({ "preserve-images": true });
      const images = [];
      try {
        structured.walk({
          onImageBlock(bounds, transform, image) {
            images.push({ rect: bounds, transform });
            image.destroy();
          },
        });
        return images;
      } finally {
        structured.destroy();
      }
    }),
  );
}
function pixel(bytes, x, y) {
  return readPDF(bytes, (document) =>
    withPage(document, (page) => {
      const pixmap = page.toPixmap(
        mupdf.Matrix.identity,
        mupdf.ColorSpace.DeviceRGB,
        false,
        true,
      );
      try {
        const offset =
          ((y - pixmap.getY()) * pixmap.getWidth() + x - pixmap.getX()) *
          pixmap.getNumberOfComponents();
        return Array.from(pixmap.getPixels().slice(offset, offset + 3));
      } finally {
        pixmap.destroy();
      }
    }),
  );
}
function near(actual, expected, tolerance = 0.05) {
  assert.equal(actual.length, expected.length);
  actual.forEach((value, index) =>
    assert.ok(
      Math.abs(value - expected[index]) < tolerance,
      `${JSON.stringify(actual)} expected ${JSON.stringify(expected)}`,
    ),
  );
}
function solidImage(rgb) {
  const pixmap = new mupdf.Pixmap(
    mupdf.ColorSpace.DeviceRGB,
    [0, 0, 12, 12],
    false,
  );
  try {
    const pixels = pixmap.getPixels();
    for (let i = 0; i < pixels.length; i += 3) pixels.set(rgb, i);
    return new Uint8Array(pixmap.asPNG());
  } finally {
    pixmap.destroy();
  }
}
function formFixture() {
  const document = new mupdf.PDFDocument();
  const font = new mupdf.Font("Helvetica");
  const fontRef = document.addSimpleFont(font);
  font.destroy();
  document.insertPage(
    0,
    document.addPage([0, 0, 600, 800], 0, { Font: { F: fontRef } }, ""),
  );
  const page = document.findPage(0),
    fields = [];
  const field = (name, type, value, rect, flags = 0, options) => {
    const item = document.addObject({
      Type: "Annot",
      Subtype: "Widget",
      FT: type,
      T: document.newString(name),
      V: document.newString(value),
      Ff: flags,
      Rect: rect,
      F: 4,
      DA: document.newString("/F 14 Tf 0 g"),
      P: page,
    });
    if (options) item.put("Opt", options);
    fields.push(item);
    return item;
  };
  field("country", "Ch", "NZ", [50, 650, 300, 690], 131072, [
    [document.newString("AU"), document.newString("Australia")],
    [document.newString("NZ"), document.newString("New Zealand")],
  ]);
  field("notes", "Tx", "First line\nSecond line", [50, 500, 400, 610], 4096);
  field("locked", "Tx", "Read only", [50, 420, 400, 460], 1);
  const off = document.addStream("q Q", {
    Type: "XObject",
    Subtype: "Form",
    BBox: [0, 0, 18, 18],
    Resources: {},
  });
  const on = document.addStream("0 g 3 3 12 12 re f", {
    Type: "XObject",
    Subtype: "Form",
    BBox: [0, 0, 18, 18],
    Resources: {},
  });
  const radio = document.addObject({
    FT: "Btn",
    Ff: 32768,
    T: document.newString("plan"),
    V: "One",
    Kids: [],
  });
  const kids = ["One", "Two"].map((name, index) =>
    document.addObject({
      Type: "Annot",
      Subtype: "Widget",
      Parent: radio,
      P: page,
      Rect: [50 + index * 60, 350, 68 + index * 60, 368],
      F: 4,
      AS: index === 0 ? "One" : "Off",
      AP: { N: { Off: off, [name]: on } },
    }),
  );
  radio.put("Kids", kids);
  page.put("Annots", [...fields, ...kids]);
  document
    .getTrailer()
    .get("Root")
    .put("AcroForm", {
      Fields: [...fields, radio],
      DR: { Font: { F: fontRef } },
      DA: document.newString("/F 14 Tf 0 g"),
    });
  const buffer = document.saveToBuffer({ garbage: 4 });
  try {
    return new Uint8Array(buffer.asUint8Array());
  } finally {
    buffer.destroy();
    document.destroy();
  }
}
const forms = formFixture();
const red = solidImage([220, 30, 40]),
  blue = solidImage([20, 80, 220]),
  green = solidImage([30, 170, 70]);
const imageRect = [60, 520, 220, 630],
  neighborRect = [130, 570, 290, 680];
engine.open(forms);
engine.mutate({ type: "image", page: 0, rect: imageRect, bytes: red });
engine.mutate({ type: "image", page: 0, rect: neighborRect, bytes: blue });
engine.mutate({
  type: "text",
  page: 0,
  rect: [140, 590, 295, 630],
  text: "KEEP IMAGE TEXT",
  fontSize: 12,
  baseline: 610,
});
engine.mutate({
  type: "note",
  page: 0,
  rect: [330, 450, 354, 474],
  text: "Keep annotation",
});
const images = engine.save();
engine.create(600, 800);
engine.mutate({
  type: "text",
  page: 0,
  rect: [50, 50, 300, 100],
  text: "MOVE THIS LINE",
  fontSize: 16,
  baseline: 80,
});
engine.mutate({
  type: "text",
  page: 0,
  rect: [50, 60, 300, 120],
  text: "KEEP THIS NEIGHBOR",
  fontSize: 16,
  baseline: 91,
});
const overlappingText = engine.save();
await Promise.all([
  writeFile(path.join(output, "advanced-form-source.pdf"), forms),
  writeFile(path.join(output, "advanced-image-source.pdf"), images),
  writeFile(path.join(output, "advanced-text-source.pdf"), overlappingText),
]);

for (const type of ["moveImage", "replaceImage", "deleteImage"]) {
  await check(
    `${type} preserves overlapping image, text, annotations and forms`,
    () => {
      engine.open(images);
      const target = [330, 540, 490, 650];
      engine.mutate({
        type,
        page: 0,
        rect: imageRect,
        targetRect: target,
        ...(type === "replaceImage" ? { bytes: green } : {}),
      });
      const result = engine.save();
      const blocks = nativeImages(result);
      assert.equal(blocks.length, type === "deleteImage" ? 1 : 2);
      near(
        blocks.find((image) => Math.abs(image.rect[0] - neighborRect[0]) < 1)
          .rect,
        neighborRect,
      );
      assert.ok(
        text(result).includes("KEEP IMAGE TEXT"),
        "Unselected native text was lost",
      );
      near(pixel(result, 270, 660), [20, 80, 220], 2);
      near(pixel(result, 180, 600), [20, 80, 220], 2);
      if (type !== "deleteImage") {
        near(
          blocks.find((image) => Math.abs(image.rect[0] - target[0]) < 1).rect,
          target,
        );
        near(
          pixel(result, 470, 640),
          type === "replaceImage" ? [30, 170, 70] : [220, 30, 40],
          2,
        );
      }
      readPDF(result, (document) =>
        withPage(document, (page) => {
          const widgets = page.getWidgets(),
            annotations = page.getAnnotations();
          try {
            assert.equal(widgets.length, 5);
            assert.equal(
              document.getTrailer().get("Root", "AcroForm", "Fields").length,
              4,
            );
            assert.equal(
              widgets
                .find((widget) => widget.getName() === "country")
                .getValue(),
              "NZ",
            );
            assert.equal(
              annotations
                .find((annotation) => annotation.getType() === "Text")
                .getContents(),
              "Keep annotation",
            );
          } finally {
            widgets.forEach((widget) => widget.destroy());
            annotations.forEach((annotation) => annotation.destroy());
          }
        }),
      );
      engine.undo();
      assert.deepEqual(
        engine.render(0, 0.5).imageBlocks.map((image) => image.rect),
        [imageRect, neighborRect],
      );
    },
  );
}
await check(
  "Coincident native images can be targeted independently by their selected id",
  () => {
    engine.create(600, 800);
    for (const bytes of [red, blue])
      engine.mutate({ type: "image", page: 0, rect: imageRect, bytes });
    const selected = engine.render(0, 0.5).imageBlocks[1];
    const target = [330, 540, 490, 650];
    engine.mutate({
      type: "moveImage",
      page: 0,
      ...selected,
      targetRect: target,
    });
    const result = engine.save();
    near(nativeImages(result)[0].rect, imageRect);
    near(nativeImages(result)[1].rect, target);
    near(pixel(result, 80, 540), [220, 30, 40], 2);
    near(pixel(result, 350, 560), [20, 80, 220], 2);
  },
);
await check(
  "Image movement on a rotated, cropped page preserves displayed coordinates",
  () => {
    engine.create(600, 800);
    engine.mutate({ type: "rotate", page: 0, degrees: 90 });
    engine.mutate({ type: "crop", page: 0, rect: [30, 30, 760, 570] });
    const source = [50, 100, 170, 200],
      neighbor = [120, 150, 240, 250],
      target = [380, 160, 620, 360];
    engine.mutate({ type: "image", page: 0, rect: source, bytes: red });
    engine.mutate({ type: "image", page: 0, rect: neighbor, bytes: blue });
    engine.mutate({
      type: "moveImage",
      page: 0,
      rect: source,
      targetRect: target,
    });
    const result = engine.save();
    near(nativeImages(result)[0].rect, target);
    near(nativeImages(result)[1].rect, neighbor);
    near(pixel(result, 600, 340), [220, 30, 40], 2);
    near(pixel(result, 220, 230), [20, 80, 220], 2);
  },
);
for (const replacement of ["MOVE THIS LINE", "CHANGED SELECTED LINE"]) {
  await check(
    `${replacement === "MOVE THIS LINE" ? "Moving" : "Replacing"} native text preserves overlapping neighboring glyphs`,
    () => {
      engine.open(overlappingText);
      const source = engine
        .render(0, 0.5)
        .textBlocks.find((line) => line.text === "MOVE THIS LINE");
      const target = [350, 300, 590, 330];
      engine.mutate({
        type: "replaceText",
        page: 0,
        ...source,
        text: replacement,
        targetRect: target,
        baseline: target[1] + source.origin[1] - source.rect[1],
        clip: false,
        wrap: false,
      });
      const result = engine.save();
      assert.ok(
        text(result).includes("KEEP THIS NEIGHBOR"),
        `Neighbor text changed: ${JSON.stringify(text(result))}`,
      );
      assert.ok(text(result).includes(replacement));
      readPDF(result, (document) =>
        withPage(document, (page) => {
          const hits = page.search(replacement);
          assert.equal(hits.length, 1);
          assert.ok(hits[0][0][1] > 290);
        }),
      );
      engine.undo();
      assert.equal(text(engine.save()), text(overlappingText));
    },
  );
}
function annotationGeometry(bytes) {
  return readPDF(bytes, (document) =>
    withPage(document, (page) => {
      const annotations = page.getAnnotations();
      try {
        const annotation = annotations[0];
        return {
          bounds: annotation.getBounds(),
          quads: annotation.hasQuadPoints() ? annotation.getQuadPoints() : [],
          ink: annotation.hasInkList() ? annotation.getInkList() : [],
          line: annotation.hasLine() ? annotation.getLine() : [],
          contents: annotation.getContents(),
        };
      } finally {
        annotations.forEach((annotation) => annotation.destroy());
      }
    }),
  );
}
for (const type of [
  "highlight",
  "underline",
  "strikeout",
  "ink",
  "line",
  "arrow",
]) {
  await check(
    `${type} transforms native geometry and survives export/undo`,
    () => {
      engine.create(600, 800);
      const isQuad = ["highlight", "underline", "strikeout"].includes(type);
      engine.mutate({
        type,
        page: 0,
        ...(isQuad
          ? { rect: [70, 350, 230, 380] }
          : {
              points: [
                [70, 450],
                [130, 480],
                [230, 460],
              ],
            }),
        color: "#7356b2",
        text: "Geometry review",
      });
      const before = engine.save(),
        source = engine.render(0, 0.5).annotations[0],
        geometry = annotationGeometry(before),
        r = source.rect;
      const target = [
        r[0] + 80,
        r[1] + 60,
        r[0] + 80 + (r[2] - r[0]) * 1.5,
        r[1] + 60 + (r[3] - r[1]) * 1.2,
      ];
      const map = (point) => [
        target[0] + (point[0] - r[0]) * 1.5,
        target[1] + (point[1] - r[1]) * 1.2,
      ];
      engine.mutate({
        type: "transformAnnotation",
        page: 0,
        id: source.id,
        targetRect: target,
      });
      const transformed = annotationGeometry(engine.save());
      geometry.quads.forEach((quad, index) =>
        near(
          transformed.quads[index],
          Array.from({ length: 4 }, (_, point) =>
            map(quad.slice(point * 2, point * 2 + 2)),
          ).flat(),
        ),
      );
      geometry.ink.forEach((stroke, i) =>
        stroke.forEach((point, j) => near(transformed.ink[i][j], map(point))),
      );
      geometry.line.forEach((point, i) =>
        near(transformed.line[i], map(point)),
      );
      assert.equal(transformed.contents, "Geometry review");
      engine.undo();
      assert.deepEqual(annotationGeometry(engine.save()), geometry);
    },
  );
}
engine.close();

const installedChrome =
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const executablePath =
  process.env.BROWSER_EXECUTABLE_PATH ||
  ((await stat(installedChrome).catch(() => null))
    ? installedChrome
    : undefined);
let browser;
try {
  browser = await chromium.launch({ headless: true, executablePath });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    acceptDownloads: true,
  });
  const page = await context.newPage();
  page.setDefaultTimeout(12000);
  page.on("pageerror", (error) => errors.push(error.message));
  async function ready() {
    await page.locator("#editor").waitFor({ state: "visible" });
    await page.waitForFunction(
      () =>
        document.querySelector("#working-overlay").hidden &&
        document.querySelector("#page-image").complete &&
        document.querySelector("#page-image").naturalWidth > 0,
    );
  }
  async function openFixture(name) {
    await page.goto(base + "/software/pdf-editor/");
    await page.locator("#file-input").setInputFiles(path.join(output, name));
    await ready();
  }
  async function download(name) {
    await page.locator("#save-button").click();
    await page.locator("#export-name").fill(name);
    const waiting = page.waitForEvent("download");
    await page.locator("#modal-submit").click();
    const result = await waiting;
    const target = path.join(output, name);
    await result.saveAs(target);
    return new Uint8Array(await readFile(target));
  }
  async function moveSelection(dx, dy) {
    const frame = await page.locator(".selection-frame").boundingBox();
    const overlay = await page.locator("#page-overlay").boundingBox();
    const viewbox = await page.locator("#page-overlay").evaluate((element) => ({
      width: element.viewBox.baseVal.width,
      height: element.viewBox.baseVal.height,
    }));
    const x = frame.x + frame.width / 2,
      y = frame.y + frame.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(
      x + (dx * overlay.width) / viewbox.width,
      y + (dy * overlay.height) / viewbox.height,
      { steps: 8 },
    );
    await page.mouse.up();
    await ready();
  }
  await check(
    "Native choice, multiline, readonly and radio UI export canonical values",
    async () => {
      await openFixture("advanced-form-source.pdf");
      await page.locator('[data-mode="Fill & Sign"]').click();
      const country = page.getByLabel("country", { exact: true }),
        notes = page.getByLabel("notes", { exact: true }),
        locked = page.getByLabel("locked", { exact: true });
      assert.equal(await country.inputValue(), "NZ");
      assert.equal(
        await country.locator("option:checked").innerText(),
        "New Zealand",
      );
      assert.equal(
        await notes.evaluate((element) => element.tagName),
        "TEXTAREA",
      );
      assert.equal(await notes.inputValue(), "First line\nSecond line");
      assert.equal(
        await locked.evaluate(
          (element) => element.readOnly || element.disabled,
        ),
        true,
      );
      assert.equal(
        await page.locator('[data-export-value="One"]').isChecked(),
        true,
      );
      assert.equal(
        await page.locator('[data-export-value="Two"]').isChecked(),
        false,
      );
      assert.equal(
        await page.locator('[data-export-value="Two"]').getAttribute("type"),
        "radio",
      );
      await country.selectOption("AU");
      await ready();
      await notes.click();
      await notes.press("ControlOrMeta+A");
      await notes.pressSequentially("Edited first line");
      await notes.press("Enter");
      await notes.pressSequentially("Edited second line");
      await notes.press("Tab");
      await ready();
      await page.locator('[data-export-value="Two"]').check();
      await ready();
      assert.equal(
        await page.locator('[data-export-value="One"]').isChecked(),
        false,
      );
      const result = await download("advanced-browser-form.pdf");
      readPDF(result, (document) => {
        const values = {};
        document
          .getTrailer()
          .get("Root", "AcroForm", "Fields")
          .forEach((field) => {
            const value = field.get("V");
            values[field.get("T").asString()] = value.isName()
              ? value.asName()
              : value.asString();
          });
        assert.deepEqual(values, {
          country: "AU",
          notes: "Edited first line\nEdited second line",
          locked: "Read only",
          plan: "Two",
        });
        withPage(document, (nativePage) => {
          const widgets = nativePage.getWidgets();
          try {
            const radio = widgets.filter(
              (widget) => widget.getName() === "plan",
            );
            assert.deepEqual(
              radio.map((widget) => widget.getObject().get("AS").asName()),
              ["Off", "Two"],
            );
          } finally {
            widgets.forEach((widget) => widget.destroy());
          }
        });
      });
      await page
        .locator("#file-input")
        .setInputFiles(path.join(output, "advanced-browser-form.pdf"));
      await ready();
      await page.locator('[data-mode="Fill & Sign"]').click();
      assert.equal(await country.inputValue(), "AU");
      assert.equal(
        await notes.inputValue(),
        "Edited first line\nEdited second line",
      );
      assert.equal(
        await page.locator('[data-export-value="Two"]').isChecked(),
        true,
      );
      await page.screenshot({
        path: path.join(output, "advanced-browser-form.png"),
      });
    },
  );
  await check(
    "Saving immediately after typing a form field includes the new value",
    async () => {
      await openFixture("advanced-form-source.pdf");
      await page.locator('[data-mode="Fill & Sign"]').click();
      await page
        .getByLabel("notes", { exact: true })
        .fill("Saved immediately\nSecond saved line");
      const result = await download("advanced-browser-form-immediate.pdf");
      readPDF(result, (document) => {
        const fields = document.getTrailer().get("Root", "AcroForm", "Fields");
        let value;
        fields.forEach((field) => {
          if (field.get("T").asString() === "notes")
            value = field.get("V").asString();
        });
        assert.equal(value, "Saved immediately\nSecond saved line");
      });
    },
  );
  await check(
    "Dragging an overlapping native image preserves neighboring content in downloaded PDF",
    async () => {
      await openFixture("advanced-image-source.pdf");
      await page.locator('[data-mode="Edit"]').click();
      await page.locator("#tool-editImages").click();
      await page.locator('[data-image="0"]').press("Enter");
      await moveSelection(260, -100);
      const result = await download("advanced-browser-image.pdf");
      assert.equal(nativeImages(result).length, 2);
      assert.ok(text(result).includes("KEEP IMAGE TEXT"));
      near(
        nativeImages(result).find(
          (image) => Math.abs(image.rect[0] - neighborRect[0]) < 1,
        ).rect,
        neighborRect,
      );
      near(pixel(result, 180, 600), [20, 80, 220], 2);
      near(pixel(result, 270, 660), [20, 80, 220], 2);
      near(
        nativeImages(result).find((image) => Math.abs(image.rect[0] - 320) < 2)
          .rect,
        [320, 420, 480, 530],
        2,
      );
      await page.screenshot({
        path: path.join(output, "advanced-browser-image.png"),
      });
    },
  );
  await check(
    "Dragging overlapping native text preserves the neighboring line in downloaded PDF",
    async () => {
      await openFixture("advanced-text-source.pdf");
      await page.locator('[data-mode="Edit"]').click();
      await page.locator('[aria-label="Edit MOVE THIS LINE"]').press("Enter");
      await moveSelection(250, 200);
      const result = await download("advanced-browser-text.pdf");
      assert.ok(
        text(result).includes("KEEP THIS NEIGHBOR"),
        `Neighbor text changed: ${JSON.stringify(text(result))}`,
      );
      assert.ok(text(result).includes("MOVE THIS LINE"));
      readPDF(result, (document) =>
        withPage(document, (nativePage) => {
          const hits = nativePage.search("MOVE THIS LINE");
          assert.equal(hits.length, 1);
          assert.ok(hits[0][0][1] > 250);
        }),
      );
      await page.screenshot({
        path: path.join(output, "advanced-browser-text.png"),
      });
    },
  );
} catch (error) {
  checks.push({
    name: "Advanced browser setup",
    passed: false,
    error: error.message,
  });
} finally {
  if (browser) await browser.close();
}
if (errors.length)
  checks.push({
    name: "Browser has no uncaught errors",
    passed: false,
    error: errors.join("\n"),
  });
const failed = checks.filter((result) => !result.passed);
await writeFile(
  path.join(output, "advanced-results.json"),
  JSON.stringify({ checks, errors }, null, 2) + "\n",
);
console.log(
  `PDF advanced: ${checks.length - failed.length}/${checks.length} scenarios passed. Evidence: ${output}`,
);
if (failed.length) process.exitCode = 1;
