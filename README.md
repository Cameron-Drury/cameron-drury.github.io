# Drury Module website

Static GitHub Pages site for Drury Module’s software development and games, including Idle Ant Colony and Game Central. The build generates 11 HTML pages, a sitemap, robots.txt and a page manifest. Generated HTML is committed to the repository; GitHub Pages serves it directly.

GitHub Pages publishes this site from the repository’s `main` branch and root directory. Verify the deployment and public pages after pushing a new revision; local previews do not publish changes.

## Local development

Requires Node.js, npm and Python 3. Install the browser test dependencies and Chromium once:

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

Open [the local preview](http://127.0.0.1:4173). `npm run check` validates the generated pages’ local links, assets, anchors, headings and metadata. Run browser checks in a separate terminal while the preview is running:

```sh
npm run test:browser
```

To use an installed Chrome instead of downloading Chromium on macOS:

```sh
BROWSER_EXECUTABLE_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" npm run test:browser
```

## Where to edit

- `scripts/build.mjs`: page templates, product copy, navigation, contact address and App Store links.
- `scripts/policies.mjs`: privacy policy content.
- `scripts/support-data.mjs`: support FAQs.
- `assets/css/site.css` and `assets/js/site.js`: styling, animation, navigation and the email draft builder.
- `assets/images/`: local artwork and social images.

Rebuild after content changes. Avoid editing generated HTML directly, as the next build replaces it. Support forms only prepare a draft in the visitor’s email app; there is no form submission server.

The dedicated software development page is `/software/`; the homepage introduces both software and games. Software enquiries can use the project email link or select “Software project” in the support form.

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
