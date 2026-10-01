import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
const base = process.env.SITE_URL || "http://127.0.0.1:4173";
const output = await fs.mkdtemp(path.join(os.tmpdir(), "drury-module-qa-"));
const root = fileURLToPath(new URL("../", import.meta.url));
const pages = JSON.parse(
  await fs.readFile(root + "/scripts/pages.json", "utf8"),
);
const browser = await chromium.launch({
  ...(process.env.BROWSER_EXECUTABLE_PATH
    ? { executablePath: process.env.BROWSER_EXECUTABLE_PATH }
    : {}),
  headless: true,
});
const issues = [];
const tested = [];
for (const width of [1440, 390, 320]) {
  const context = await browser.newContext({
    viewport: { width, height: width === 1440 ? 1000 : 844 },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  page.on("pageerror", (error) => issues.push({ width, error: error.message }));
  for (const route of pages) {
    const failed = [];
    const responseListener = (response) => {
      if (response.status() >= 400) failed.push(response.url());
    };
    page.on("response", responseListener);
    await page.goto(base + route.path, { waitUntil: "networkidle" });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.evaluate(async () => {
      await Promise.all(
        [...document.images].map((img) => {
          img.loading = "eager";
          return img.decode().catch(() => {});
        }),
      );
    });
    const state = await page.evaluate(() => ({
      overflow: document.documentElement.scrollWidth > window.innerWidth,
      brokenImages: [...document.images]
        .filter((x) => !x.complete || !x.naturalWidth)
        .map((x) => x.src),
      h1: document.querySelectorAll("h1").length,
    }));
    if (
      state.overflow ||
      state.brokenImages.length ||
      state.h1 !== 1 ||
      failed.length
    )
      issues.push({ width, path: route.path, ...state, failed });
    if (width === 1440 || width === 390) {
      const a11y = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze();
      if (a11y.violations.length)
        issues.push({
          width,
          path: route.path,
          a11y: a11y.violations.map((v) => ({
            id: v.id,
            impact: v.impact,
            description: v.description,
            nodes: v.nodes.map((n) => n.target),
          })),
        });
    }
    tested.push(`${width} ${route.path}`);
    page.off("response", responseListener);
  }
  await page.goto(base, { waitUntil: "networkidle" });
  await page.evaluate(async () => {
    await Promise.all(
      [...document.images].map((img) => {
        img.loading = "eager";
        return img.decode().catch(() => {});
      }),
    );
  });
  await page.screenshot({
    path: `${output}/home-${width}.png`,
    fullPage: true,
  });
  if (width === 390) {
    await page.getByRole("button", { name: "Menu", exact: true }).click();
    if (
      (await page
        .getByRole("button", { name: "Close", exact: true })
        .getAttribute("aria-expanded")) !== "true"
    )
      issues.push("mobile menu failed");
    await page.keyboard.press("Escape");
    if (
      (await page
        .getByRole("button", { name: "Menu", exact: true })
        .getAttribute("aria-expanded")) !== "false"
    )
      issues.push("mobile menu escape failed");
  }
  await page.goto(base + "/support/game-central/", {
    waitUntil: "networkidle",
  });
  await page
    .getByLabel("Tell us what happened")
    .fill("The world freezes after opening it. Please help.");
  await page.getByRole("button", { name: "Prepare support email" }).click();
  const draft = await page.locator("#email-draft-link").getAttribute("href");
  if (
    !draft?.includes("Game%20Central") ||
    !draft.includes("The%20world%20freezes")
  )
    issues.push("support email fields missing");
  await page.locator(".faq-list summary").first().click();
  if (
    (await page.locator(".faq-list details").first().getAttribute("open")) ===
    null
  )
    issues.push("FAQ not open");
  await page.evaluate(() => {
    document.activeElement?.blur();
    window.scrollTo(0, 0);
  });
  await page.screenshot({
    path: `${output}/support-${width}.png`,
    fullPage: true,
  });
  await page.goto(base + "/games/game-central/", { waitUntil: "networkidle" });
  await page.evaluate(async () => {
    await Promise.all(
      [...document.images].map((img) => {
        img.loading = "eager";
        return img.decode().catch(() => {});
      }),
    );
  });
  await page.screenshot({
    path: `${output}/game-central-${width}.png`,
    fullPage: true,
  });
  await context.close();
}
const softwarePage = await browser.newPage();
await softwarePage.goto(base + "/support/");
await softwarePage
  .getByLabel("Software or game")
  .selectOption("Software project");
await softwarePage
  .getByLabel("What can we help with?")
  .selectOption("Software project enquiry");
await softwarePage
  .getByLabel("Tell us what happened")
  .fill("I would like a web application to manage project tasks.");
await softwarePage
  .getByRole("button", { name: "Prepare support email" })
  .click();
const softwareDraft = await softwarePage
  .locator("#email-draft-link")
  .getAttribute("href");
if (
  !softwareDraft?.includes("Software%20project") ||
  !softwareDraft.includes("web%20application")
)
  issues.push("software enquiry draft missing details");
await softwarePage.close();
const noJS = await browser.newContext({
  javaScriptEnabled: false,
  viewport: { width: 390, height: 844 },
});
const noPage = await noJS.newPage();
await noPage.goto(base);
if (
  !(await noPage
    .getByRole("navigation", { name: "Main navigation" })
    .isVisible())
)
  issues.push("no-js navigation missing");
await noPage.goto(base + "/support/");
if (!(await noPage.locator("noscript").isVisible()))
  issues.push("no-js contact missing");
if (
  !(await noPage
    .getByRole("button", { name: "Prepare support email" })
    .isDisabled())
)
  issues.push("no-js form must be disabled");
const motionPage = await browser.newPage({ reducedMotion: "reduce" });
await motionPage.goto(base);
if (
  !(await motionPage
    .getByRole("button", { name: "Reduced motion" })
    .isDisabled())
)
  issues.push("OS reduced motion not honoured");
await motionPage.emulateMedia({ reducedMotion: "no-preference" });
await motionPage.getByRole("button", { name: "Pause motion" }).click();
if (
  !(await motionPage
    .locator("html")
    .evaluate((x) => x.classList.contains("motion-off")))
)
  issues.push("Pause motion failed");
await motionPage.getByRole("button", { name: "Enable motion" }).click();
if (
  await motionPage
    .locator("html")
    .evaluate((x) => x.classList.contains("motion-off"))
)
  issues.push("Resume motion failed");
await browser.close();
console.log(JSON.stringify({ tested: tested.length, issues, output }, null, 2));
await fs.writeFile(
  path.join(output, "results.json"),
  JSON.stringify({ tested, issues }, null, 2),
);
process.exitCode = issues.length ? 1 : 0;
