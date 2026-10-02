import { writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { policies } from "./policies.mjs";
import { faqs } from "./support-data.mjs";
import { pdfAppTemplate } from "./pdf-app-template.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const origin = "https://cameron-drury.github.io";
const email = "camerondrurytas@gmail.com";
const store = "https://apps.apple.com/au/app/idle-ant-colony/id6755945955";
const esc = (value) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
const arrow = '<span class="arrow" aria-hidden="true">↗</span>';
const mark =
  '<svg viewBox="0 0 40 44" fill="none" aria-hidden="true"><path d="M20 1 38 11 20 21 2 11 20 1Z" fill="currentColor"/><path d="m2 17 18 10 18-10v9L20 36 2 26v-9Z" fill="currentColor" opacity=".65"/><path d="m2 31 18 10 18-10v3L20 44 2 34v-3Z" fill="currentColor" opacity=".35"/></svg>';
const brand = `<a class="brand" href="/" aria-label="Drury Module home">${mark}<span class="brand-name">drury<span>module.</span></span></a>`;
const button = (label, href, primary = false) =>
  `<a class="button${primary ? " primary" : ""}" href="${href}">${label}${arrow}</a>`;
const image = (name, alt, extra = "") =>
  `<img src="/assets/images/${name}" alt="${esc(alt)}" ${extra}>`;
const games = {
  "idle-ant-colony": {
    name: "Idle Ant Colony",
    type: "Idle · Simulation",
    status: "On the App Store",
    icon: "idle-ant-colony.webp",
    description:
      "Small beginnings. An entire empire. Build a thriving ant colony, collect honeydew and keep the good things growing.",
  },
  "game-central": {
    name: "Game Central",
    type: "Adventure · Collection",
    status: "Coming soon",
    icon: "game-central.webp",
    description:
      "A different world for every mood. Explore, build, race and experiment in 12 offline games for iPhone and iPad.",
  },
};
function header(active) {
  return `<a class="skip-link" href="#main">Skip to content</a><header class="header"><div class="wrap header-inner">${brand}<button class="menu-toggle" type="button" aria-expanded="false" aria-controls="site-nav">Menu</button><nav class="nav" id="site-nav" aria-label="Main navigation"><a href="/software/"${active === "software" ? ' aria-current="page"' : ""}>Software</a><a href="/#games"${active === "games" ? ' aria-current="true"' : ""}>Our games</a><a href="/#studio">The studio</a><a href="/support/"${active === "support" ? ' aria-current="true"' : ""}>Support</a><a class="nav-contact" href="mailto:${email}">Let’s talk <span aria-hidden="true">↗</span></a></nav></div></header>`;
}
function footer() {
  return `<footer class="footer"><div class="wrap"><div class="footer-top"><div>${brand}<p>Independent ideas.<br>Thoughtfully made in Australia.</p></div><div class="footer-nav"><div><b>Explore</b><a href="/software/">Cam’s Free Software</a><a href="/games/idle-ant-colony/">Idle Ant Colony</a><a href="/games/game-central/">Game Central</a><a href="/#studio">The studio</a></div><div><b>Good to know</b><a href="/support/">Product support</a><a href="/privacy/">Privacy policies</a><a href="mailto:${email}">Get in touch ↗</a></div></div></div><div class="footer-bottom"><span>© 2026 Drury Module Pty Ltd</span><button class="motion-toggle" data-motion type="button" aria-pressed="false">Pause motion</button><span>Software &amp; games. Made with care.</span></div></div></footer>`;
}
const pages = [];
async function page(
  path,
  title,
  description,
  body,
  active = "",
  social = "social.png",
) {
  const canonical = origin + path;
  const html = `<!doctype html>
<html lang="en-AU"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="theme-color" content="#0c0a10"><meta name="description" content="${esc(description)}"><meta name="color-scheme" content="dark"><title>${esc(title)} | Drury Module</title><link rel="canonical" href="${canonical}"><meta property="og:type" content="website"><meta property="og:site_name" content="Drury Module"><meta property="og:title" content="${esc(title)} | Drury Module"><meta property="og:description" content="${esc(description)}"><meta property="og:url" content="${canonical}"><meta property="og:image" content="${origin}/assets/images/${social}"><meta property="og:image:alt" content="Drury Module — Software and games, thoughtfully made"><meta name="twitter:card" content="summary_large_image"><link rel="icon" href="/assets/images/favicon.svg" type="image/svg+xml"><link rel="stylesheet" href="/assets/css/site.css"><script>document.documentElement.classList.add('js')</script><script src="/assets/js/site.js" defer></script>${path === "/software/" ? '<script src="/assets/js/catalog.js" defer></script>' : ""}<script type="application/ld+json">${JSON.stringify({ "@context": "https://schema.org", "@type": "Organization", name: "Drury Module", legalName: "Drury Module Pty Ltd", url: origin, email, logo: origin + "/assets/images/favicon.svg" })}</script></head><body>${header(active)}<main id="main">${body}</main>${footer()}</body></html>\n`;
  const file = path === "/404.html" ? "404.html" : path.slice(1) + "index.html";
  await mkdir(new URL("./", new URL(file, "file://" + root)), {
    recursive: true,
  });
  await writeFile(root + file, html);
  pages.push({ path, file });
}
const breadcrumb = (label, parent) =>
  `<div class="wrap breadcrumbs"><a href="/">Home</a><span aria-hidden="true">/</span>${parent ? `<a href="${parent.href}">${parent.label}</a><span aria-hidden="true">/</span>` : ""}<span>${label}</span></div>`;
const titleBlock = (kicker, title, description, extra = "") =>
  `<div class="wrap page-intro"><div class="eyebrow">${kicker}</div><h1>${title}</h1><p>${description}</p>${extra}</div>`;
function sculpture() {
  const slabs = [332, 256, 180, 104]
    .map(
      (y, i) =>
        `<g><path d="M130 ${y + 92} 320 ${y + 200} 510 ${y + 92}v27L320 ${y + 227} 130 ${y + 119}Z" fill="url(#edge${i % 2})" stroke="#d8bbff" stroke-opacity=".2"/><path d="M320 ${y - 16} 510 ${y + 92} 320 ${y + 200} 130 ${y + 92}Z" fill="url(#surface)" stroke="#dbc4ff" stroke-opacity="${0.16 + i * 0.15}"/><path d="m158 ${y + 92} 162-92 162 92-162 92Z" fill="#0b0712" fill-opacity=".55" stroke="#c1a2f1" stroke-opacity=".25"/><path d="m320 ${y + 200} 0 27" stroke="#e0c3ff" stroke-opacity=".5"/>${i === 3 ? `<path d="m320 ${y + 12} 67 38-67 38-67-38Z" fill="#c9a7fa"/><path d="m242 ${y + 57} 67 38-67 38-67-38Z" fill="#7a53ab"/><path d="m398 ${y + 57} 67 38-67 38-67-38Z" fill="#9469cd"/><path d="m320 ${y + 102} 67 38-67 38-67-38Z" fill="#b18adb"/>` : ""}</g>`,
    )
    .join("");
  return `<div class="hero-art" aria-hidden="true"><span class="art-coordinate top">DM — OBJECT 001</span><svg viewBox="0 0 640 650" fill="none"><defs><linearGradient id="surface" x1="130" y1="0" x2="510" y2="600" gradientUnits="userSpaceOnUse"><stop stop-color="#a477db"/><stop offset=".46" stop-color="#3e255e"/><stop offset="1" stop-color="#20172e"/></linearGradient><linearGradient id="edge0"><stop stop-color="#21132f"/><stop offset=".5" stop-color="#5d3a82"/><stop offset="1" stop-color="#1a0f2a"/></linearGradient><linearGradient id="edge1"><stop stop-color="#342044"/><stop offset=".5" stop-color="#8c61b9"/><stop offset="1" stop-color="#302040"/></linearGradient><radialGradient id="glow"><stop stop-color="#9f65de" stop-opacity=".32"/><stop offset="1" stop-color="#9f65de" stop-opacity="0"/></radialGradient></defs><ellipse cx="325" cy="495" rx="290" ry="150" fill="url(#glow)"/><ellipse cx="320" cy="325" rx="300" ry="196" transform="rotate(-34 320 325)" stroke="#ac87d6" stroke-opacity=".18"/><ellipse cx="320" cy="325" rx="263" ry="264" stroke="#ac87d6" stroke-opacity=".06"/><path d="M320 15v607M36 326h568" stroke="#ac87d6" stroke-opacity=".13" stroke-dasharray="3 9"/><g class="module-stack">${slabs}</g><circle class="orbit-point" cx="83" cy="423" r="4" fill="#dbc1ff"/><circle cx="550" cy="206" r="3" fill="#9b71ce"/><path d="M72 108h28m-14-14v28M542 538h28m-14-14v28" stroke="#aa8bcc" stroke-opacity=".5"/></svg><span class="art-caption">Little pieces. Bigger possibilities.</span><span class="art-coordinate bottom">DESIGNED TO FIT TOGETHER.</span></div>`;
}
function gameCard(slug, index) {
  const game = games[slug];
  const art =
    slug === "idle-ant-colony"
      ? `<div class="game-art ant"><span class="art-meta">A little world. A lot of possibility.</span>${image(game.icon, "Idle Ant Colony artwork", 'class="game-icon" width="640" height="640" loading="lazy"')}<span class="art-meta bottom"><span>Build. Grow. Repeat.</span><span>01 / DM</span></span></div>`
      : `<div class="game-art central"><div class="central-tiles" aria-hidden="true">${["pocket-expedition", "sand-lab", "deep-signal", "night-archive", "last-light", "wildhaven"].map((x) => image(x + ".webp", "", 'width="300" height="300" loading="lazy"')).join("")}</div><div class="central-title" aria-hidden="true">game<br>central.<small>One app. Many worlds.</small></div><span class="art-meta bottom"><span>A pocket-sized collection</span><span>02 / DM</span></span></div>`;
  return `<article class="game-card">${art}<div class="game-body"><div class="game-topline"><span class="mono muted">${game.type}</span><span class="pill ${index === 1 ? "live" : ""}">${game.status}</span></div><h3><a href="/games/${slug}/">${game.name}</a></h3><p>${game.description}</p><div class="game-links"><a class="text-link" href="/games/${slug}/">Explore the game ${arrow}</a><a class="quiet-link" href="/support/${slug}/">Game support</a></div></div></article>`;
}
const softwareEnquiry = `mailto:${email}?subject=Drury%20Module%20software%20project&amp;body=Hi%20Cameron%2C%0A%0AI%20would%20like%20to%20build%3A%0A%0AWho%20it%20is%20for%3A%0A%0AWhat%20it%20should%20help%20them%20do%3A%0A%0A`;
const freeSoftware = [
  {
    name: "Cam’s PDF Editor",
    category: "Documents",
    href: "/software/pdf-editor/",
    description:
      "Edit, annotate, sign and organise PDFs. A complete workspace for your documents, right in your browser.",
    keywords:
      "pdf document editor text annotate highlight sign signature forms merge split rotate redact ocr",
    capabilities: ["Edit & annotate", "Sign & fill", "Organise pages"],
  },
];
function pdfArtwork() {
  return `<div class="app-artwork pdf-artwork" aria-hidden="true"><span class="app-art-label">PDF / EVERYDAY ESSENTIAL</span><div class="pdf-document"><div class="pdf-document-top"><span class="pdf-doc-dot"></span><span>the good stuff.</span></div><div class="pdf-document-heading">Make it<br><em>yours.</em></div><div class="pdf-document-line wide"></div><div class="pdf-document-line"></div><div class="pdf-document-note">a little clearer.</div><svg class="pdf-signature" viewBox="0 0 200 55" fill="none"><path d="M8 34c13-27 30-31 30-18 0 16-27 30-15 9 8-14 18-8 12 4 9-15 24-14 18 0 8-9 14-6 16 1 8-20 25-26 25-10 0 16-19 19-12 8 6-9 13-1 22-1 6 0 13-8 17-4 6 5 13-4 22-1 11 3 22-4 34-3M23 47c50-11 103-10 163-5" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg><span class="pdf-page-corner"></span></div><span class="pdf-art-badge"><svg viewBox="0 0 24 24" fill="none"><path d="m5 17 1-4L16 3l5 5-10 10-4 1-2-2ZM14 5l5 5M5 21h15" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg></span></div>`;
}
function freeSoftwareCard(app) {
  return `<article class="app-card" data-software-card data-category="${esc(app.category)}" data-search="${esc(app.name + " " + app.description + " " + app.keywords)}"><a class="app-art-link" href="${app.href}" aria-label="Open ${esc(app.name)}">${pdfArtwork()}</a><div class="app-card-body"><div class="app-card-meta"><span>${app.category}</span><span class="free-badge">Free</span></div><h3><a href="${app.href}">${app.name}</a></h3><p>${app.description}</p><ul class="app-capabilities">${app.capabilities.map((item) => `<li>${item}</li>`).join("")}</ul><a class="app-open" href="${app.href}">Open PDF Editor <span aria-hidden="true">↗</span></a></div></article>`;
}
function softwareSection() {
  return `<section class="section software-section" id="software"><div class="wrap"><div class="section-head"><div><div class="eyebrow">01 / Cam’s Free Software</div><h2>Useful tools.<br>Yours to use.</h2></div><div class="section-aside"><p>A growing collection of free browser apps by Cameron Drury. Open a tool and get things done.</p><a class="text-link" href="/software/">Browse free software ${arrow}</a></div></div><div class="free-software-grid home-app-grid">${freeSoftware.map(freeSoftwareCard).join("")}</div></div></section>`;
}

await page(
  "/",
  "Software & games, thoughtfully made",
  "Drury Module is an independent Australian software and games studio. Explore Cam’s Free Software, free browser tools, Idle Ant Colony and Game Central.",
  `<section class="hero"><div class="wrap"><div class="hero-grid"><div class="hero-copy reveal"><div class="eyebrow">Software &amp; games · Australia</div><h1>Small studio.<br><em>Worlds</em> of<br>possibility.</h1><p>We build useful software and original games. From tools that make work easier to worlds worth exploring, we turn good ideas into things people love to use.</p><div class="actions">${button("Browse free software", "/software/", true)}${button("Discover our games", "#games")}</div></div>${sculpture()}</div><div class="hero-bottom"><span>Software with purpose. Games with character.</span><div class="small-games">${image("idle-ant-colony.webp", "", 'width="24" height="24"')}${image("game-central.webp", "", 'width="24" height="24"')}<span><b>Original games.</b> From our studio.</span></div><span>Scroll to explore ↓</span></div></div></section>${softwareSection()}<section class="section wrap" id="games"><div class="section-head"><div><div class="eyebrow">02 / Our games</div><h2>Find your kind of play.</h2></div><p>A colony to grow. A collection to explore.<br>Something a little different, every time.</p></div><div class="game-grid">${gameCard("idle-ant-colony", 1)}${gameCard("game-central", 2)}</div></section><section class="section studio" id="studio"><div class="wrap"><div class="studio-layout"><div><div class="eyebrow">03 / The studio</div><p class="studio-note">INDEPENDENT BY DESIGN.<br>AUSTRALIAN AT HEART.</p></div><div><h2>Good things start<br>with <span>a little curiosity.</span></h2><p>Drury Module is the independent software and games studio of Australian developer Cameron Drury. We build across the web and mobile — creating practical tools, thoughtful digital products and original games with personalities of their own.</p><p style="margin-top:20px">Every project starts with the people who will use it. We care about the details, the feel of a good interaction, and making complicated things easier — whether you are getting something done or taking a moment to play.</p></div></div><div class="principles"><article class="principle"><b>01 — CHARACTER</b><h3>Products with a point of view.</h3><p>Purposeful interfaces, thoughtful details and a clear identity, carried through from the first interaction.</p></article><article class="principle"><b>02 — CURIOSITY</b><h3>A better way to do things.</h3><p>Question the familiar, explore a new approach and turn a promising idea into something useful or unexpected.</p></article><article class="principle"><b>03 — CARE</b><h3>Made by a person. For people.</h3><p>Clear information, a direct line to the developer, and support when you need a hand.</p></article></div></div></section><section class="section wrap support-band"><div><div class="eyebrow">04 / Here to help</div><h2>A human on<br>the other side.</h2><p>Have a software project in mind, a product question or a game that needs a hand? You can reach the person building it.</p></div><div class="support-links"><a href="/support/"><span><small>01</small>Get product support</span>${arrow}</a><a href="/privacy/"><span><small>02</small>Your privacy, explained</span>${arrow}</a><a href="mailto:${email}"><span><small>03</small>Discuss a software project</span>${arrow}</a></div></section>`,
);

await page(
  "/software/",
  "Cam’s Free Software",
  "Free browser apps by Cameron Drury. Edit, annotate, sign and organise documents with Cam’s PDF Editor. No account or subscription needed.",
  `${breadcrumb("Free software")}<section class="wrap catalog-hero"><div class="catalog-intro"><div class="eyebrow">A collection by Drury Module</div><h1>Cam’s Free<br><em>Software.</em></h1><p>Good software should be easy to reach. These are the tools I’m building to help you get things done, freely.</p><div class="catalog-promises"><span><svg viewBox="0 0 20 20" aria-hidden="true" fill="none"><path d="m4 10 4 4 8-8" stroke="currentColor" stroke-width="1.7"/></svg>Free to use</span><span><svg viewBox="0 0 20 20" aria-hidden="true" fill="none"><path d="m4 10 4 4 8-8" stroke="currentColor" stroke-width="1.7"/></svg>No account needed</span><span><svg viewBox="0 0 20 20" aria-hidden="true" fill="none"><path d="m4 10 4 4 8-8" stroke="currentColor" stroke-width="1.7"/></svg>Made for your browser</span></div></div><aside class="catalog-note"><span class="mono">A note from Cam</span><p>One useful tool at a time.</p><span>I’m starting with a PDF editor, and growing the collection from here. Have an idea for something useful?</span><a href="mailto:${email}?subject=Cam%E2%80%99s%20Free%20Software%20idea">Tell me about it ${arrow}</a></aside></section><section class="wrap catalog-section" aria-labelledby="catalog-heading"><div class="catalog-toolbar"><div><h2 id="catalog-heading">The software</h2><p id="catalog-count" role="status" aria-live="polite">1 free app, ready to use</p></div><form class="catalog-controls" role="search" aria-label="Find free software"><label class="catalog-search" for="software-search"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="10" cy="10" r="6.5" stroke="currentColor" stroke-width="1.6"/><path d="m15 15 5 5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg><span class="visually-hidden">Search free software</span><input id="software-search" type="search" placeholder="Find a tool…" autocomplete="off" maxlength="100" disabled></label><div class="catalog-category"><label class="visually-hidden" for="software-category">Software category</label><select id="software-category" disabled><option value="all">All software</option><option value="Documents">Documents</option></select></div></form></div><div class="free-software-grid" id="software-grid">${freeSoftware.map(freeSoftwareCard).join("")}</div><div class="catalog-empty" id="catalog-empty" hidden><h3>No tools found.</h3><p>Try a different search or show all software.</p><button type="button" id="catalog-reset">Clear filters ${arrow}</button></div><noscript><p class="catalog-noscript">All available software is listed above. Search and filters need JavaScript.</p></noscript></section><section class="wrap free-software-values"><article><span class="values-mark" aria-hidden="true">01</span><h2>Open it. Get to work.</h2><p>Use these apps from your browser. There’s no signup, subscription or download to begin.</p></article><article><span class="values-mark" aria-hidden="true">02</span><h2>Your files stay with you.</h2><p>The PDF editor processes your documents on your device. Your PDFs are never uploaded to a server.</p></article><article><span class="values-mark" aria-hidden="true">03</span><h2>Made by Cam.</h2><p>I’m an independent developer in Australia. Feedback helps me make these tools better.</p><a href="/support/">Get in touch ${arrow}</a></article></section><section class="wrap catalog-studio-link"><p>Need software built for your business? Drury Module also creates websites, mobile apps and custom tools.</p><a class="text-link" href="${softwareEnquiry}">Discuss a project ${arrow}</a></section>`,
  "software",
);

const pdfFile = "software/pdf-editor/index.html";
await mkdir(root + "software/pdf-editor", { recursive: true });
await writeFile(root + pdfFile, pdfAppTemplate());
pages.push({ path: "/software/pdf-editor/", file: pdfFile });

const features = {
  "idle-ant-colony": [
    [
      "Start small. Think colony.",
      "Tap to collect honeydew, recruit workers and put your resources into upgrades that help your colony grow.",
    ],
    [
      "Make progress at your pace.",
      "Your ants keep working while you are away. Come back, collect idle earnings and decide what to build next.",
    ],
    [
      "A fresh start. A bigger future.",
      "Prestige to earn Queens and permanent bonuses. Choose themes and cosmetic styles to make the colony your own.",
    ],
  ],
  "game-central": [
    [
      "Follow your mood.",
      "Go from a quiet experiment to an expedition, a factory or a spaceship command deck. Pick a world and get straight into it.",
    ],
    [
      "Take your worlds with you.",
      "The collection works offline, with artwork included in the app and progress saved on your device. Play natively on iPhone and iPad. No account needed.",
    ],
    [
      "Keep your favourites close.",
      "Pin up to six games at the top of your collection. Return to the hub whenever you are ready for something different.",
    ],
  ],
};
for (const [slug, game] of Object.entries(games)) {
  const ant = slug === "idle-ant-colony";
  const facts = ant
    ? [
        ["Platform", "iPhone & iPad"],
        ["Genre", "Idle simulation"],
        ["Availability", "On the App Store"],
        ["Extras", "Ads & in-app purchases"],
      ]
    : [
        ["Platform", "iPhone & iPad · iOS/iPadOS 18+"],
        ["Collection", "12 original worlds"],
        ["Connection", "Play offline"],
        ["Availability", "Coming soon"],
      ];
  const worlds = ant
    ? ""
    : `<section class="section wrap"><div class="section-head"><div><div class="eyebrow">A look inside</div><h2>One collection.<br>Entirely different worlds.</h2></div><p>Adventure, strategy and a little escape. Meet three worlds from the collection.</p></div><div class="world-grid">${[
        [
          "wildhaven",
          "Wildhaven",
          "Find your footing on a wild coast. Gather, craft, build a camp and explore a world beyond the shoreline.",
        ],
        [
          "last-light",
          "Last Light",
          "Carry a living archive across space. Command your crew, manage power and make each decision count.",
        ],
        [
          "night-archive",
          "Night Archive",
          "Slip through a museum after dark. Study patrols, recover an artifact and find your way back out.",
        ],
      ]
        .map(
          ([asset, title, desc]) =>
            `<article class="world-card">${image(asset + ".webp", title + " promotional artwork", 'width="640" height="360" loading="lazy"')}<div><h3>${title}</h3><p>${desc}</p></div></article>`,
        )
        .join(
          "",
        )}</div><p class="world-caption">Promotional artwork from Game Central. The collection is in development; content may change before release.</p></section>`;
  await page(
    `/games/${slug}/`,
    game.name,
    game.description,
    `${breadcrumb(game.name)}<div class="wrap product-hero"><div><div class="eyebrow">${game.type}</div><h1>${ant ? "Small colony.<br>Big ambition." : "Your next world<br>is one tap away."}</h1><p>${game.description}</p><div class="actions">${ant ? button("View on the App Store", store, true) : '<span class="pill">Coming soon to iPhone &amp; iPad</span>'}${button("Player support", `/support/${slug}/`)}</div>${!ant ? '<p class="notice">Game Central is being prepared for the App Store. Explore the collection here and check back for its release.</p>' : '<p class="form-note">Free to download. Includes advertising and optional in-app purchases.</p>'}</div><div class="product-image ${ant ? "ant-image" : ""}">${image(game.icon, game.name + " app artwork", 'width="640" height="640" fetchpriority="high"')}<div class="product-caption">${game.name} / Drury Module</div></div></div><dl class="wrap fact-strip">${facts.map(([key, value]) => `<div><dt>${key}</dt><dd>${value}</dd></div>`).join("")}</dl><section class="section wrap"><div class="section-head"><div><div class="eyebrow">Made for your kind of play</div><h2>${ant ? "A little more. Every day." : "Stay curious. Keep playing."}</h2></div></div><div class="feature-grid">${features[slug].map(([title, desc], i) => `<article><span class="number">0${i + 1}</span><h3>${title}</h3><p>${desc}</p></article>`).join("")}</div></section>${worlds}<section class="wrap" style="padding-bottom:90px"><div class="band"><div><h2>Good to know before you play.</h2><p>Find answers, contact the developer and read how ${game.name} handles your information.</p></div><div class="actions">${button("Support", `/support/${slug}/`)}${button("Privacy", `/privacy/${slug}/`)}</div></div></section>`,
    "games",
  );
}
function faqList(slug) {
  const items = slug ? [...faqs[slug], ...faqs.general] : faqs.general;
  return `<section class="faq-section"><div class="wrap faq-layout"><div><div class="eyebrow">A little help</div><h2>Common<br>questions.</h2></div><div class="faq-list">${items.map((f) => `<details><summary>${f.question}</summary><div>${f.answer}</div></details>`).join("")}</div></div></section>`;
}
function supportForm(slug) {
  return `<form id="support-form"><fieldset id="support-fields" disabled><div class="form-grid"><div class="field"><label for="game">Software or game</label><select id="game" name="game">${Object.entries(
    games,
  )
    .map(
      ([id, g]) =>
        `<option value="${g.name}"${id === slug ? " selected" : ""}>${g.name}</option>`,
    )
    .join(
      "",
    )}<option>Cam’s PDF Editor</option><option>Software project</option><option${!slug ? " selected" : ""}>General enquiry</option></select></div><div class="field"><label for="topic">What can we help with?</label><select id="topic" name="topic"><option>Something is not working</option><option>Progress or saved games</option><option>Purchase help</option><option>Software project enquiry</option><option>Feedback or an idea</option><option>Privacy question</option><option>Something else</option></select></div><div class="field"><label for="device">Device / operating system (optional)</label><input id="device" name="device" placeholder="e.g. iPhone 16, iOS 18" maxlength="100"></div><div class="field"><label for="version">App / browser version (optional)</label><input id="version" name="version" placeholder="e.g. 1.2.2" maxlength="30"></div><div class="field full"><label for="message">Tell us what happened</label><textarea id="message" name="message" required minlength="10" maxlength="1800" placeholder="What were you doing? What did you expect to happen?"></textarea></div></div><p class="form-note">This opens a draft in your email app. Nothing is submitted through this website. Add any screenshots there, then send when you are ready. <a href="/privacy/#website">How we handle support messages</a>.</p><button class="button primary" type="submit">Prepare support email ${arrow}</button><p class="form-status" id="form-status" role="status" aria-live="polite"></p><a class="text-link" id="email-draft-link" hidden>Open the email draft again ${arrow}</a></fieldset><noscript><p class="form-fallback">The email builder needs JavaScript. You can email <a href="mailto:${email}">${email}</a> directly instead.</p></noscript></form>`;
}
for (const slug of [null, ...Object.keys(games)]) {
  const name = slug ? games[slug].name : "Product";
  const picker = `<nav class="support-picker" aria-label="Choose support page"><a href="/support/"${!slug ? ' aria-current="page"' : ""}>All support</a>${Object.entries(
    games,
  )
    .map(
      ([id, g]) =>
        `<a href="/support/${id}/"${id === slug ? ' aria-current="page"' : ""}>${g.name}</a>`,
    )
    .join("")}</nav>`;
  await page(
    slug ? `/support/${slug}/` : "/support/",
    `${name} support`,
    slug
      ? `Contact Drury Module for ${name} support, saved-game help, technical issues, purchases and feedback.`
      : "Contact Drury Module about software projects, product support, technical issues and game help.",
    `${breadcrumb("Support", slug ? { label: name, href: `/games/${slug}/` } : null)}${titleBlock(slug ? "Player support" : "Product support & enquiries", slug ? `${name}<br>support.` : "Let’s get things<br>working.", "Questions, bugs or a good idea — this is your direct line to Drury Module.", picker)}<div class="wrap support-layout"><aside class="contact-panel"><h2>A real person.<br>A direct line.</h2><p>Support is handled by Cameron, the developer behind Drury Module. Email us with the details and we’ll help you work through it.</p><a class="email-link" href="mailto:${email}">${email}</a><p>For support, include the product, device and steps that led to the problem. For a software project, tell us what you want to build and who will use it. For Game Central, include the world you were playing.</p><p class="notice">Missing progress? Contact us before deleting the app or resetting your game. Saves are stored on your device.</p>${slug ? `<a class="text-link" href="/privacy/${slug}/">${name} privacy ${arrow}</a>` : '<a class="text-link" href="/privacy/">Read our privacy policies ↗</a>'}</aside>${supportForm(slug)}</div>${faqList(slug)}`,
    "support",
  );
}
function policyBody(policy) {
  return policy.sections
    .map(
      (s, i) =>
        `<section id="section-${i + 1}"><h2>${s.title}</h2>${s.body}</section>`,
    )
    .join("");
}
await page(
  "/privacy/",
  "Privacy, explained",
  "Read the Drury Module website, Game Central and Idle Ant Colony privacy policies, including local saves, advertising, purchases and support.",
  `${breadcrumb("Privacy")}${titleBlock("Your privacy", "Clear information.<br>No guessing.", "Each game works differently. Choose its policy to see what stays on your device and which services it uses.")}<div class="wrap policy-grid">${Object.entries(
    games,
  )
    .map(
      ([slug, g]) =>
        `<article class="policy-card"><span class="eyebrow">App privacy</span><h2>${g.name}</h2><p>${slug === "game-central" ? "Local saves, no account and no advertising SDK. Learn about gameplay data, device backups and support." : "Local colony progress, Google AdMob advertising and optional Apple purchases. See how these services handle data."}</p><a class="text-link" href="/privacy/${slug}/">Read the policy ${arrow}</a></article>`,
    )
    .join(
      "",
    )}</div><div class="wrap policy-layout" id="website"><aside class="policy-nav"><div class="eyebrow">Website privacy</div>${policies.website.sections.map((s, i) => `<a href="#section-${i + 1}">${s.title}</a>`).join("")}</aside><article class="policy-body"><section><div class="eyebrow">Updated 1 October 2026</div><h2 style="margin-top:22px">This website.</h2><p>${policies.website.intro}</p></section>${policyBody(policies.website)}</article></div>`,
);
for (const slug of Object.keys(games)) {
  const p = policies[slug];
  await page(
    `/privacy/${slug}/`,
    `${games[slug].name} privacy policy`,
    p.intro,
    `${breadcrumb("Privacy policy", { label: games[slug].name, href: `/games/${slug}/` })}${titleBlock("Privacy policy · Updated 1 October 2026", `${games[slug].name}.<br>Your information.`, p.intro)}<div class="wrap policy-layout"><aside class="policy-nav"><div class="eyebrow">On this page</div>${p.sections.map((s, i) => `<a href="#section-${i + 1}">${s.title}</a>`).join("")}<a href="/privacy/">All privacy policies ↗</a></aside><article class="policy-body">${policyBody(p)}<a class="text-link" href="/support/${slug}/">Contact ${games[slug].name} support ${arrow}</a></article></div>`,
  );
}
await page(
  "/404.html",
  "Page not found",
  "Find your way back to Drury Module software, games and support.",
  '<div class="not-found"><div class="mono muted">404 / A wrong turn</div><h1>A world we<br>haven’t built yet.</h1><p>This page could not be found. Let’s get you somewhere good.</p><div class="actions">' +
    button("Back to the studio", "/", true) +
    button("Get support", "/support/") +
    "</div></div>",
);
await writeFile(
  root + "sitemap.xml",
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${pages
    .filter((p) => p.path !== "/404.html")
    .map((p) => `<url><loc>${origin + p.path}</loc></url>`)
    .join("")}</urlset>\n`,
);
await writeFile(
  root + "robots.txt",
  `User-agent: *\nAllow: /\nSitemap: ${origin}/sitemap.xml\n`,
);
await writeFile(
  root + "scripts/pages.json",
  JSON.stringify(pages, null, 2) + "\n",
);
console.log(
  `Built ${pages.length} pages. Only explicit Drury Module output paths were written.`,
);
