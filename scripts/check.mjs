import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../", import.meta.url));
const pages = JSON.parse(
  await readFile(path.join(root, "scripts/pages.json"), "utf8"),
);
const issues = [];
const documents = new Map();
for (const page of pages)
  documents.set(page.path, await readFile(path.join(root, page.file), "utf8"));
for (const [route, html] of documents) {
  if ((html.match(/<h1[ >]/g) || []).length !== 1)
    issues.push(`${route}: expected one h1`);
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((x) => x[1]);
  if (ids.length !== new Set(ids).size) issues.push(`${route}: duplicate IDs`);
  for (const match of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
    const url = new URL(
      match[1].replaceAll("&amp;", "&"),
      `https://local.test${route}`,
    );
    if (url.origin !== "https://local.test") continue;
    // Only verify references produced by this build. Protected legacy pages are outside its graph.
    const target = url.pathname.endsWith("/")
      ? url.pathname.slice(1) + "index.html"
      : url.pathname.slice(1);
    if (target.toLowerCase().endsWith("kyna.html")) {
      issues.push(`${route}: prohibited protected-page reference`);
      continue;
    }
    try {
      await stat(path.join(root, target));
    } catch {
      issues.push(`${route}: missing ${target}`);
    }
    if (url.hash && documents.has(url.pathname)) {
      const source = documents.get(url.pathname);
      if (!source.includes(`id="${decodeURIComponent(url.hash.slice(1))}"`))
        issues.push(`${route}: missing anchor ${url.pathname}${url.hash}`);
    }
  }
  if (!html.includes('rel="canonical"'))
    issues.push(`${route}: missing canonical`);
  if (!html.includes('name="description"'))
    issues.push(`${route}: missing description`);
}
if (issues.length) {
  console.error(issues.join("\n"));
  process.exitCode = 1;
} else
  console.log(
    `Verified ${pages.length} pages: local links, assets, anchors, headings and metadata.`,
  );
