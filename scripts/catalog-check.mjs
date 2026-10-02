import { chromium } from "playwright";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const base = process.env.SITE_URL || "http://127.0.0.1:4173";
const output =
  process.env.CATALOG_OUTPUT ||
  fileURLToPath(new URL("../../catalog-qa/", import.meta.url));
const installedChrome =
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const executablePath =
  process.env.BROWSER_EXECUTABLE_PATH ||
  ((await fs.stat(installedChrome).catch(() => null))
    ? installedChrome
    : undefined);
const browser = await chromium.launch({ headless: true, executablePath });
const issues = [];
const tested = [];
await fs.mkdir(output, { recursive: true });
try {
  for (const [width, expectedColumns] of [
    [320, 1],
    [390, 1],
    [1024, 3],
    [1440, 4],
    [1920, 6],
  ]) {
    const context = await browser.newContext({
      viewport: { width, height: width < 600 ? 844 : 1000 },
      reducedMotion: "reduce",
      deviceScaleFactor: 1,
    });
    const page = await context.newPage();
    page.on("pageerror", (error) => issues.push(`${width}: ${error.message}`));
    await page.goto(base + "/", { waitUntil: "networkidle" });
    if (width < 761) {
      await page.getByRole("button", { name: "Menu", exact: true }).click();
    }
    await page
      .getByRole("navigation", { name: "Main navigation" })
      .getByRole("link", { name: "Software", exact: true })
      .click();
    await page.waitForURL(base + "/software/");
    await page.waitForFunction(
      () => !document.querySelector("#software-search").disabled,
    );
    const cards = page.locator("#software-grid [data-software-card]");
    if ((await cards.count()) !== 1)
      issues.push(`${width}: expected exactly one real app`);
    const editorLink = cards.getByRole("link", {
      name: "Open PDF Editor",
      exact: false,
    });
    if ((await editorLink.getAttribute("href")) !== "/software/pdf-editor/") {
      issues.push(`${width}: PDF Editor link must use its actual app route`);
    }
    if (
      !(await page
        .getByRole("heading", { level: 1, name: /Cam’s Free Software/ })
        .isVisible())
    ) {
      issues.push(`${width}: catalog branding missing`);
    }
    const search = page.getByRole("searchbox", {
      name: "Search free software",
    });
    await search.fill("pdf");
    if (!(await cards.first().isVisible()))
      issues.push(`${width}: PDF search failed`);
    await search.fill("unavailable-example-tool");
    if (await cards.first().isVisible())
      issues.push(`${width}: unmatched app was not hidden`);
    if (
      !(await page
        .getByRole("heading", { name: "No tools found." })
        .isVisible())
    ) {
      issues.push(`${width}: empty result state missing`);
    }
    await page.getByRole("button", { name: /Clear filters/ }).click();
    if (
      !(await cards.first().isVisible()) ||
      (await search.inputValue()) !== ""
    ) {
      issues.push(`${width}: reset failed to restore the real app`);
    }
    await page
      .getByLabel("Software category", { exact: true })
      .selectOption("Documents");
    if (!(await cards.first().isVisible()))
      issues.push(`${width}: Documents category failed`);
    await page
      .getByLabel("Software category", { exact: true })
      .selectOption("all");
    if (width === 1440 || width === 390) {
      await search.blur();
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({
        path: path.join(
          output,
          `catalog-${width === 1440 ? "desktop" : "mobile"}.png`,
        ),
        fullPage: true,
      });
    }
    // Temporary DOM copies prove that the real layout handles a full catalog.
    // They are removed before navigation; no fake apps are written to site files.
    const layout = await page.evaluate(() => {
      const grid = document.querySelector("#software-grid");
      const original = grid.querySelector("[data-software-card]");
      for (let i = 0; i < 17; i += 1) {
        const clone = original.cloneNode(true);
        clone.dataset.layoutProbe = "true";
        grid.append(clone);
      }
      const rects = [...grid.querySelectorAll("[data-software-card]")].map(
        (card) => card.getBoundingClientRect(),
      );
      const columns = new Set(rects.map((rect) => Math.round(rect.left))).size;
      const overflow = document.documentElement.scrollWidth > window.innerWidth;
      const overlap = rects.some((a, index) =>
        rects
          .slice(index + 1)
          .some(
            (b) =>
              a.left < b.right - 1 &&
              a.right > b.left + 1 &&
              a.top < b.bottom - 1 &&
              a.bottom > b.top + 1,
          ),
      );
      grid
        .querySelectorAll("[data-layout-probe]")
        .forEach((card) => card.remove());
      return { columns, overflow, overlap };
    });
    if (layout.columns !== expectedColumns) {
      issues.push(
        `${width}: expected ${expectedColumns} catalog columns, got ${layout.columns}`,
      );
    }
    if (layout.columns > 6 || layout.overflow || layout.overlap) {
      issues.push(`${width}: invalid catalog layout ${JSON.stringify(layout)}`);
    }
    await editorLink.click();
    await page.waitForURL(base + "/software/pdf-editor/");
    const editor = await page.locator("h1").textContent();
    if (!editor?.includes("PDF"))
      issues.push(`${width}: editor route did not load a PDF app`);
    tested.push({ width, actualApps: 1, layout });
    await context.close();
  }
} finally {
  await browser.close();
}
const result = { tested, issues, output };
console.log(JSON.stringify(result, null, 2));
await fs.writeFile(
  path.join(output, "catalog-check.json"),
  JSON.stringify(result, null, 2) + "\n",
);
if (issues.length) process.exitCode = 1;
