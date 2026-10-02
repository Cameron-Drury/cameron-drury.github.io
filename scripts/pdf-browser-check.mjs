import assert from "node:assert/strict";
import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";
import { readFile, writeFile, mkdir, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import mupdf from "../assets/pdf-editor/vendor/mupdf.js";
import * as fixtureEngine from "../assets/pdf-editor/src/engine.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const output =
  process.env.PDF_QA_DIR ||
  fileURLToPath(new URL("../../pdf-qa/", import.meta.url));
const screenshots = process.env.PDF_SCREENSHOT_DIR || output;
await mkdir(output, { recursive: true });
await mkdir(screenshots, { recursive: true });
fixtureEngine.open(
  new Uint8Array(await readFile(root + "assets/pdf-editor/sample.pdf")),
);
const scannedPage = fixtureEngine.render(0, 1.5);
fixtureEngine.create(595, 842);
fixtureEngine.mutate({
  type: "image",
  page: 0,
  rect: [0, 0, 595, 842],
  bytes: scannedPage.png,
});
await writeFile(output + "/browser-scanned-source.pdf", fixtureEngine.save());
fixtureEngine.close();
const fixtureImage = new mupdf.Pixmap(
  mupdf.ColorSpace.DeviceRGB,
  [0, 0, 32, 24],
  false,
);
const imagePixels = fixtureImage.getPixels();
for (let i = 0; i < imagePixels.length; i += 3) {
  imagePixels[i] = 115;
  imagePixels[i + 1] = 86;
  imagePixels[i + 2] = 178;
}
await writeFile(output + "/browser-image.png", fixtureImage.asPNG());
fixtureImage.destroy();
const base = process.env.SITE_URL || "http://127.0.0.1:4173";
const installedChrome =
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const executablePath =
  process.env.BROWSER_EXECUTABLE_PATH ||
  ((await stat(installedChrome).catch(() => null))
    ? installedChrome
    : undefined);
const browser = await chromium.launch({ headless: true, executablePath });
const checks = [],
  errors = [],
  externalRequests = [];
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  acceptDownloads: true,
});
const page = await context.newPage();
page.setDefaultTimeout(12000);
page.on("pageerror", (error) => errors.push(error.message));
page.on("request", (request) => {
  if (/^https?:/.test(request.url()) && !request.url().startsWith(base))
    externalRequests.push(request.url());
});
page.on("dialog", (dialog) => dialog.accept());
async function run(name, fn) {
  try {
    await fn();
    checks.push({ name, passed: true });
    console.log("PASS " + name);
  } catch (error) {
    checks.push({ name, passed: false, error: error.message });
    console.error("FAIL " + name + ": " + error.message);
    await page
      .screenshot({ path: output + "/failure-" + checks.length + ".png" })
      .catch(() => {});
  }
}
async function ready() {
  await page.locator("#editor").waitFor({ state: "visible" });
  await page.waitForFunction(
    () =>
      document.querySelector("#working-overlay").hidden &&
      document.querySelector("#page-image").complete &&
      document.querySelector("#page-image").naturalWidth > 0,
  );
}
async function mode(name) {
  await page.locator(`[data-mode="${name}"]`).click();
}
async function sample() {
  await page.goto(base + "/software/pdf-editor/");
  await page.locator("#sample-button").click();
  await ready();
}
async function save(name, configure = async () => {}) {
  await page.locator("#save-button").click();
  await page.locator("#export-name").fill(name);
  await configure();
  const wait = page.waitForEvent("download");
  await page.locator("#modal-submit").click();
  const download = await wait;
  const path = output + "/" + name;
  await download.saveAs(path);
  return new Uint8Array(await readFile(path));
}
function readPDF(bytes, fn, password) {
  const doc = new mupdf.PDFDocument(bytes);
  try {
    if (password) assert.ok(doc.authenticatePassword(password));
    return fn(doc);
  } finally {
    doc.destroy();
  }
}
function text(doc, number) {
  const p = doc.loadPage(number);
  const s = p.toStructuredText();
  try {
    return s.asText();
  } finally {
    s.destroy();
    p.destroy();
  }
}
async function drag(rect) {
  const b = await page.locator("#page-overlay").boundingBox();
  const vb = await page.locator("#page-overlay").evaluate((el) => ({
    x: el.viewBox.baseVal.x,
    y: el.viewBox.baseVal.y,
    width: el.viewBox.baseVal.width,
    height: el.viewBox.baseVal.height,
  }));
  const map = (x, y) => [
    b.x + ((x - vb.x) * b.width) / vb.width,
    b.y + ((y - vb.y) * b.height) / vb.height,
  ];
  const [sx, sy] = map(rect[0], rect[1]),
    [ex, ey] = map(rect[2], rect[3]);
  await page.mouse.move(sx, sy);
  await page.mouse.down();
  await page.mouse.move(ex, ey, { steps: 8 });
  await page.mouse.up();
  await ready();
}
async function overlayRect(selector) {
  return page
    .locator(selector)
    .evaluate((el) => [
      Number(el.getAttribute("x")),
      Number(el.getAttribute("y")),
      Number(el.getAttribute("x")) + Number(el.getAttribute("width")),
      Number(el.getAttribute("y")) + Number(el.getAttribute("height")),
    ]);
}
async function moveSelected(dx, dy) {
  const r = await overlayRect(".selection-frame");
  await drag([
    (r[0] + r[2]) / 2,
    (r[1] + r[3]) / 2,
    (r[0] + r[2]) / 2 + dx,
    (r[1] + r[3]) / 2 + dy,
  ]);
}

await run("Welcome and PDF import", async () => {
  await page.goto(base + "/software/pdf-editor/");
  await page.screenshot({
    path: screenshots + "/pdf-welcome-desktop.png",
    fullPage: true,
  });
  assert.ok(await page.locator("#dropzone").isVisible());
  await page.locator("#sample-button").click();
  await ready();
  assert.equal(await page.locator("#total-pages").innerText(), "/ 3");
  assert.equal(
    (await page.locator("#page-overlay [data-text]").count()) > 5,
    true,
  );
  await page.screenshot({ path: screenshots + "/pdf-editor-desktop.png" });
  await page.locator("#bookmarks-view-button").click();
  await page.locator("[data-bookmark-page]").first().waitFor();
  await page.locator("[data-bookmark-page]").first().click();
  await ready();
  await page.locator("#pages-view-button").click();
});
await run("Existing text edit, undo, redo, and PDF download", async () => {
  await mode("Edit");
  await page
    .locator('[aria-label="Edit A place to try your new PDF editor."]')
    .click();
  await page.locator("#replacement-text").fill("Free software. Useful tools.");
  await page.locator("#apply-text-edit").click();
  await ready();
  assert.equal(
    await page
      .locator('[aria-label="Edit Free software. Useful tools."]')
      .count(),
    1,
  );
  await page.locator("#undo-button").click();
  await ready();
  assert.equal(
    await page
      .locator('[aria-label="Edit A place to try your new PDF editor."]')
      .count(),
    1,
  );
  await page.locator("#redo-button").click();
  await ready();
  const bytes = await save("browser-edited.pdf");
  readPDF(bytes, (doc) => {
    const value = text(doc, 0);
    assert.ok(value.includes("Free software. Useful tools."));
    assert.ok(!value.includes("A place to try your new PDF editor."));
  });
});
await run("Find text across the document", async () => {
  await mode("Read");
  await page.locator("#tool-search").click();
  await page.locator("#search-input").fill("SECRET-4827");
  await page.locator('[data-search-match="0"]').waitFor();
  await page.locator('[data-search-match="0"]').click();
  await ready();
  await page.locator(".search-match").first().waitFor();
  assert.equal(await page.locator("#current-page").inputValue(), "2");
  await page.locator("#search-input").fill("");
  await page.locator("#pages-view-button").click();
});
await run("Annotations and signatures export as PDF content", async () => {
  await mode("Annotate");
  await page.locator("#tool-highlight").click();
  await drag([50, 251, 300, 274]);
  await page.locator("#tool-note").click();
  await page.locator("#option-text").fill("A useful review note.");
  await drag([420, 330, 450, 360]);
  await mode("Fill & Sign");
  await page.locator("#tool-signature").click();
  await page.locator('[data-signature-tab="type"]').click();
  await page.locator("#signature-name").fill("Sample User");
  await page.locator("#modal-submit").click();
  await drag([100, 390, 350, 450]);
  const bytes = await save("browser-marks.pdf");
  readPDF(bytes, (doc) => {
    const p = doc.loadPage(1);
    const list = p.getAnnotations();
    try {
      assert.ok(list.some((a) => a.getType() === "Highlight"));
      assert.ok(list.some((a) => a.getContents() === "A useful review note."));
    } finally {
      list.forEach((a) => a.destroy());
      p.destroy();
    }
  });
});
await run(
  "Native form fields remain fillable and have canonical values",
  async () => {
    await page.locator("#current-page").fill("3");
    await page.locator("#current-page").press("Tab");
    await ready();
    await mode("Fill & Sign");
    await page.locator('[aria-label="full_name"]').fill("Sample User");
    await page.locator('[aria-label="full_name"]').press("Tab");
    await ready();
    await page.locator('[aria-label="agreement"]').check();
    await ready();
    const bytes = await save("browser-form.pdf");
    readPDF(bytes, (doc) => {
      const fields = doc.getTrailer().get("Root", "AcroForm", "Fields");
      assert.equal(fields.length, 2);
      const values = {};
      fields.forEach((f) => {
        values[f.get("T").asString()] = f.get("V").isName()
          ? f.get("V").asName()
          : f.get("V").asString();
      });
      assert.equal(values.full_name, "Sample User");
      assert.equal(values.agreement, "Yes");
    });
  },
);
await run(
  "Saving directly from an active form field retains the entered value",
  async () => {
    await sample();
    await page.locator("#current-page").fill("3");
    await page.locator("#current-page").press("Tab");
    await ready();
    await mode("Fill & Sign");
    await page.locator('[aria-label="full_name"]').fill("One click save");
    const bytes = await save("browser-direct-form-save.pdf");
    readPDF(bytes, (doc) => {
      const fields = doc.getTrailer().get("Root", "AcroForm", "Fields");
      const values = {};
      fields.forEach((f) => {
        values[f.get("T").asString()] = f.get("V").asString();
      });
      assert.equal(values.full_name, "One click save");
    });
  },
);
await run(
  "Permanent redaction has an explicit review step and removes content",
  async () => {
    await page.locator("#current-page").fill("2");
    await page.locator("#current-page").press("Tab");
    await ready();
    await mode("Protect");
    await page.locator("#tool-redact").click();
    await drag([50, 281, 350, 302]);
    await page.locator("#tool-applyRedactions").click();
    assert.ok(await page.locator("#redaction-confirm").isVisible());
    await page.locator("#redaction-confirm").check();
    await page.locator("#modal-submit").click();
    await ready();
    const bytes = await save("browser-redacted.pdf");
    readPDF(bytes, (doc) => assert.ok(!text(doc, 1).includes("SECRET-4827")));
  },
);
await run("Page tools, extraction and password-protected export", async () => {
  await mode("Pages");
  await page.locator("#tool-duplicate").click();
  await ready();
  assert.equal(await page.locator("#total-pages").innerText(), "/ 4");
  await page.locator("#tool-rotate").click();
  await ready();
  await page.locator("#tool-extract").click();
  await page.locator("#extract-page-range").fill("1,4");
  await page.locator("#extract-name").fill("browser-extracted.pdf");
  const downloadWait = page.waitForEvent("download");
  await page.locator("#modal-submit").click();
  const extracted = await downloadWait;
  await extracted.saveAs(output + "/browser-extracted.pdf");
  readPDF(
    new Uint8Array(await readFile(output + "/browser-extracted.pdf")),
    (doc) => {
      assert.equal(doc.countPages(), 2);
      assert.equal(
        doc.getTrailer().get("Root", "AcroForm", "Fields").length,
        2,
      );
    },
  );
  const bytes = await save("browser-protected.pdf", () =>
    page.locator("#export-password").fill("test-password"),
  );
  readPDF(bytes, (doc) => assert.ok(doc.needsPassword()));
});
await run(
  "Protected PDFs prompt and retain their password by default",
  async () => {
    await page.goto(base + "/software/pdf-editor/");
    await page
      .locator("#file-input")
      .setInputFiles(output + "/browser-protected.pdf");
    await page.locator("#pdf-password").fill("test-password");
    await page.locator("#modal-submit").click();
    await ready();
    const bytes = await save("browser-protected-again.pdf");
    readPDF(bytes, (doc) => assert.ok(doc.needsPassword()));
  },
);
await run("Blank PDF and text insertion work", async () => {
  await page.goto(base + "/software/pdf-editor/");
  await page.locator("#blank-button").click();
  await ready();
  assert.equal(await page.locator("#total-pages").innerText(), "/ 1");
  await page.locator("#tool-text").click();
  await page.locator("#option-text").fill("A fresh document.");
  await drag([70, 100, 420, 140]);
  const bytes = await save("browser-blank.pdf");
  readPDF(bytes, (doc) =>
    assert.ok(text(doc, 0).includes("A fresh document.")),
  );
});
await run("Local recovery draft restores after reload", async () => {
  await page
    .locator("#draft-state")
    .filter({ hasText: "Recovery draft saved" })
    .waitFor();
  await page.reload();
  await page.locator("#restore-button").waitFor({ state: "visible" });
  await page.locator("#restore-button").click();
  await ready();
  await mode("Edit");
  assert.equal(
    await page.locator('[aria-label="Edit A fresh document."]').count(),
    1,
  );
});
await run(
  "Opening another PDF preserves the current edited recovery draft",
  async () => {
    await page.locator("#tool-text").click();
    await page.locator("#option-text").fill("KEEP PREVIOUS DRAFT");
    await drag([70, 250, 420, 290]);
    await page
      .locator("#file-input")
      .setInputFiles(root + "assets/pdf-editor/sample.pdf");
    await page.locator("#total-pages").filter({ hasText: "/ 3" }).waitFor();
    await ready();
    await page.reload();
    await page.locator("#restore-button").waitFor({ state: "visible" });
    await page.locator("#restore-button").click();
    await ready();
    await mode("Edit");
    assert.equal(await page.locator("#total-pages").innerText(), "/ 1");
    assert.equal(
      await page.locator('[aria-label="Edit KEEP PREVIOUS DRAFT"]').count(),
      1,
    );
  },
);
await run("Text can be dragged and resized with export and undo", async () => {
  await sample();
  await mode("Edit");
  const selector = '[aria-label="Edit A place to try your new PDF editor."]';
  const before = await overlayRect(selector);
  await page.locator(selector).click();
  assert.equal(await page.locator("[data-resize]").count(), 8);
  await moveSelected(35, 100);
  const moved = await overlayRect(selector);
  assert.ok(Math.abs(moved[0] - before[0] - 35) < 2);
  assert.ok(Math.abs(moved[1] - before[1] - 100) < 2);
  const handle = await overlayRect('[data-resize="se"]');
  await drag([
    (handle[0] + handle[2]) / 2,
    (handle[1] + handle[3]) / 2,
    (handle[0] + handle[2]) / 2 + 80,
    (handle[1] + handle[3]) / 2 + 8,
  ]);
  const resized = await overlayRect(selector);
  assert.ok(resized[2] - resized[0] > moved[2] - moved[0] + 20);
  const bytes = await save("browser-transformed-text.pdf");
  readPDF(bytes, (doc) => {
    const p = doc.loadPage(0),
      hits = p.search("A place to try your new PDF editor.");
    try {
      assert.equal(hits.length, 1);
      assert.ok(hits[0][0][1] > before[1] + 90);
    } finally {
      p.destroy();
    }
  });
  await page.screenshot({ path: screenshots + "/pdf-text-drag-resize.png" });
  await page.locator("#undo-button").click();
  await ready();
  const restoredSize = await overlayRect(selector);
  assert.ok(
    Math.abs(restoredSize[2] - restoredSize[0] - (moved[2] - moved[0])) < 2,
  );
});
await run("Images and signatures can be dragged and resized", async () => {
  await sample();
  await mode("Edit");
  await page
    .locator("#image-input")
    .setInputFiles(output + "/browser-image.png");
  await page.locator('#tool-image[aria-pressed="true"]').waitFor();
  await drag([70, 350, 230, 440]);
  await page.locator("#tool-editImages").click();
  await page.locator('[data-image="0"]').click();
  await moveSelected(80, 60);
  let r = await overlayRect(".selection-frame");
  assert.ok(Math.abs(r[0] - 150) < 2 && Math.abs(r[1] - 410) < 2);
  await page.locator(".selection-frame").press("Shift+ArrowRight");
  await ready();
  assert.ok(
    Math.abs((await overlayRect(".selection-frame"))[0] - r[0] - 10) < 2,
  );
  await page.locator("#undo-button").click();
  await ready();
  await page.locator('[data-image="0"]').click();
  let h = await overlayRect('[data-resize="se"]');
  await drag([
    (h[0] + h[2]) / 2,
    (h[1] + h[3]) / 2,
    (h[0] + h[2]) / 2 + 50,
    (h[1] + h[3]) / 2 + 30,
  ]);
  r = await overlayRect(".selection-frame");
  assert.ok(r[2] - r[0] > 200 && r[3] - r[1] > 110);
  const ratio = (r[2] - r[0]) / (r[3] - r[1]);
  h = await overlayRect('[data-resize="se"]');
  await page.keyboard.down("Shift");
  await drag([
    (h[0] + h[2]) / 2,
    (h[1] + h[3]) / 2,
    (h[0] + h[2]) / 2 + 35,
    (h[1] + h[3]) / 2 + 5,
  ]);
  await page.keyboard.up("Shift");
  const proportional = await overlayRect(".selection-frame");
  assert.ok(
    Math.abs(
      (proportional[2] - proportional[0]) /
        (proportional[3] - proportional[1]) -
        ratio,
    ) < 0.02,
  );
  await mode("Fill & Sign");
  await page.locator("#tool-signature").click();
  await page.locator('[data-signature-tab="type"]').click();
  await page.locator("#signature-name").fill("Move Me");
  await page.locator("#modal-submit").click();
  await page.locator('#tool-signature[aria-pressed="true"]').waitFor();
  await drag([60, 570, 260, 630]);
  await mode("Read");
  await page.locator('[data-image="1"]').click();
  await moveSelected(110, 50);
  const bytes = await save("browser-transformed-images.pdf");
  readPDF(bytes, (doc) => {
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
      assert.equal(images.length, 2);
      assert.ok(
        images.some((b) => Math.abs(b[0] - 150) < 2 && b[2] - b[0] > 200),
      );
      assert.ok(
        images.some(
          (b) => Math.abs(b[0] - 170) < 2 && Math.abs(b[1] - 620) < 2,
        ),
      );
    } finally {
      s.destroy();
      p.destroy();
    }
  });
  await page.screenshot({ path: screenshots + "/pdf-images-drag-resize.png" });
});
await run("Drawn marks can be dragged and resized", async () => {
  await sample();
  await mode("Annotate");
  await page.locator("#tool-rectangle").click();
  await drag([70, 350, 230, 440]);
  await mode("Read");
  await page.locator("[data-annotation]").click();
  await moveSelected(80, 60);
  let h = await overlayRect('[data-resize="se"]');
  await drag([
    (h[0] + h[2]) / 2,
    (h[1] + h[3]) / 2,
    (h[0] + h[2]) / 2 + 50,
    (h[1] + h[3]) / 2 + 30,
  ]);
  const bytes = await save("browser-transformed-mark.pdf");
  readPDF(bytes, (doc) => {
    const p = doc.loadPage(0),
      annotations = p.getAnnotations();
    try {
      assert.equal(annotations.length, 1);
      const b = annotations[0].getBounds();
      assert.ok(b[0] > 140 && b[1] > 400 && b[2] - b[0] > 200);
    } finally {
      annotations.forEach((a) => a.destroy());
      p.destroy();
    }
  });
  await page.screenshot({ path: screenshots + "/pdf-drag-resize.png" });
});
await run(
  "Scanned PDFs gain searchable text and editable visible words",
  async () => {
    await page.goto(base + "/software/pdf-editor/");
    await page
      .locator("#file-input")
      .setInputFiles(output + "/browser-scanned-source.pdf");
    await ready();
    await mode("Edit");
    assert.equal(await page.locator("[data-text]").count(), 0);
    await page.locator("#tool-ocr").click();
    await page.locator("#modal-submit").click();
    await page.locator("[data-text]").first().waitFor({ timeout: 90000 });
    await ready();
    const target = page.locator(
      '[aria-label="Edit A place to try your new PDF editor."]',
    );
    await target.click();
    assert.ok(await page.locator("#replace-scanned-pixels").isChecked());
    await page.locator("#replacement-text").fill("Scanned text can be edited.");
    await page.locator("#apply-text-edit").click();
    await ready();
    const bytes = await save("browser-scanned-edited.pdf");
    readPDF(bytes, (doc) => {
      assert.ok(text(doc, 0).includes("Scanned text can be edited."));
      assert.ok(!text(doc, 0).includes("A place to try your new PDF editor."));
    });
    await page.screenshot({ path: screenshots + "/pdf-scanned-edit.png" });
  },
);
await run("Accessibility and responsive welcome/loaded layouts", async () => {
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto(base + "/software/pdf-editor/");
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
      `Welcome overflow at ${width}`,
    );
    const welcome = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    assert.deepEqual(
      welcome.violations.map((v) => ({
        id: v.id,
        nodes: v.nodes.map((n) => n.target),
      })),
      [],
      `Welcome accessibility ${width}`,
    );
    if (width === 390)
      await page.screenshot({
        path: screenshots + "/pdf-welcome-mobile.png",
        fullPage: true,
      });
    await page.locator("#sample-button").click();
    await ready();
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
      `Loaded overflow at ${width}`,
    );
    const loaded = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    assert.deepEqual(
      loaded.violations.map((v) => ({
        id: v.id,
        nodes: v.nodes.map((n) => n.target),
      })),
      [],
      `Loaded accessibility ${width}`,
    );
    if (width === 390)
      await page.screenshot({ path: screenshots + "/pdf-editor-mobile.png" });
  }
});
await context.close();
await browser.close();
checks.push({
  name: "No document uploads or third-party processing requests",
  passed: externalRequests.length === 0,
  requests: externalRequests,
});
checks.push({
  name: "No browser runtime errors",
  passed: errors.length === 0,
  errors,
});
await writeFile(
  output + "/browser-results.json",
  JSON.stringify(checks, null, 2),
);
const failed = checks.filter((x) => !x.passed);
console.log(
  `PDF browser: ${checks.length - failed.length}/${checks.length} scenarios passed. Evidence: ${output}`,
);
if (failed.length) process.exitCode = 1;
