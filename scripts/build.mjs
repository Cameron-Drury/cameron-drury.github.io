import { writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { policies } from "./policies.mjs";
import { faqs } from "./support-data.mjs";

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
      "A different world for every mood. Explore, build, race and experiment in one offline collection for iPhone.",
  },
};
function header(active) {
  return `<a class="skip-link" href="#main">Skip to content</a><header class="header"><div class="wrap header-inner">${brand}<button class="menu-toggle" type="button" aria-expanded="false" aria-controls="site-nav">Menu</button><nav class="nav" id="site-nav" aria-label="Main navigation"><a href="/software/"${active === "software" ? ' aria-current="page"' : ""}>Software</a><a href="/#games"${active === "games" ? ' aria-current="true"' : ""}>Our games</a><a href="/#studio">The studio</a><a href="/support/"${active === "support" ? ' aria-current="true"' : ""}>Support</a><a class="nav-contact" href="mailto:${email}">Let’s talk <span aria-hidden="true">↗</span></a></nav></div></header>`;
}
function footer() {
  return `<footer class="footer"><div class="wrap"><div class="footer-top"><div>${brand}<p>Independent ideas.<br>Thoughtfully made in Australia.</p></div><div class="footer-nav"><div><b>Explore</b><a href="/software/">Software development</a><a href="/games/idle-ant-colony/">Idle Ant Colony</a><a href="/games/game-central/">Game Central</a><a href="/#studio">The studio</a></div><div><b>Good to know</b><a href="/support/">Product support</a><a href="/privacy/">Privacy policies</a><a href="mailto:${email}">Get in touch ↗</a></div></div></div><div class="footer-bottom"><span>© 2026 Drury Module Pty Ltd</span><button class="motion-toggle" data-motion type="button" aria-pressed="false">Pause motion</button><span>Software &amp; games. Made with care.</span></div></div></footer>`;
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
<html lang="en-AU"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="theme-color" content="#0c0a10"><meta name="description" content="${esc(description)}"><meta name="color-scheme" content="dark"><title>${esc(title)} | Drury Module</title><link rel="canonical" href="${canonical}"><meta property="og:type" content="website"><meta property="og:site_name" content="Drury Module"><meta property="og:title" content="${esc(title)} | Drury Module"><meta property="og:description" content="${esc(description)}"><meta property="og:url" content="${canonical}"><meta property="og:image" content="${origin}/assets/images/${social}"><meta property="og:image:alt" content="Drury Module — Software and games, thoughtfully made"><meta name="twitter:card" content="summary_large_image"><link rel="icon" href="/assets/images/favicon.svg" type="image/svg+xml"><link rel="stylesheet" href="/assets/css/site.css"><script>document.documentElement.classList.add('js')</script><script src="/assets/js/site.js" defer></script><script type="application/ld+json">${JSON.stringify({ "@context": "https://schema.org", "@type": "Organization", name: "Drury Module", legalName: "Drury Module Pty Ltd", url: origin, email, logo: origin + "/assets/images/favicon.svg" })}</script></head><body>${header(active)}<main id="main">${body}</main>${footer()}</body></html>\n`;
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
const softwareCapabilities = [
  {
    number: "01",
    title: "Web apps & websites",
    description:
      "Useful browser tools, responsive websites and clear interfaces that make it easier to get things done.",
    detail:
      "From a focused business website to a web application, we build around the task your visitors need to complete. Clear navigation, responsive layouts and useful features come first.",
    label: "Built for the browser",
    icon: '<rect x="4" y="6" width="32" height="27" rx="3"/><path d="M4 14h32M10 10h1m4 0h1M10 21h8m-8 6h17"/>',
  },
  {
    number: "02",
    title: "Mobile applications",
    description:
      "Focused app experiences with thoughtful interactions and features designed around everyday use.",
    detail:
      "Bring an idea to a screen people carry with them. We shape the flow, interface and behaviour together, with attention to how the app feels in someone’s hand.",
    label: "Made to go with you",
    icon: '<rect x="10" y="3" width="20" height="34" rx="4"/><path d="M16 8h8m-7 24h6M15 17h10m-10 5h7"/>',
  },
  {
    number: "03",
    title: "Custom tools & integrations",
    description:
      "Connect information, simplify repetitive tasks and create software that fits the way you work.",
    detail:
      "Some problems need a tool of their own. We can help turn a manual process into a useful workflow, connect services through APIs, or make information easier to work with.",
    label: "Built around your workflow",
    icon: '<rect x="3" y="4" width="12" height="12" rx="2"/><rect x="25" y="24" width="12" height="12" rx="2"/><path d="M15 10h10a6 6 0 0 1 6 6v8M9 16v8a6 6 0 0 0 6 6h10"/>',
  },
];
function softwareCards(detailed = false) {
  return `<div class="software-grid">${softwareCapabilities.map((item) => `<article class="software-card"><div class="software-card-top"><span class="mono">${item.number} / SOFTWARE</span><svg viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true">${item.icon}</svg></div><h3>${item.title}</h3><p>${detailed ? item.detail : item.description}</p><span class="software-card-label">${item.label}</span></article>`).join("")}</div>`;
}
function softwareSection() {
  return `<section class="section software-section" id="software"><div class="wrap"><div class="section-head"><div><div class="eyebrow">01 / Software development</div><h2>Good ideas.<br>Useful software.</h2></div><div class="section-aside"><p>Web, mobile and the tools in between. Thoughtfully built around real people and real tasks.</p><a class="text-link" href="/software/">Explore software development ${arrow}</a></div></div>${softwareCards()}</div></section>`;
}

await page(
  "/",
  "Software & games, thoughtfully made",
  "Drury Module is an independent Australian software and games studio. Explore web and mobile development, custom tools, Idle Ant Colony and Game Central.",
  `<section class="hero"><div class="wrap"><div class="hero-grid"><div class="hero-copy reveal"><div class="eyebrow">Software &amp; games · Australia</div><h1>Small studio.<br><em>Worlds</em> of<br>possibility.</h1><p>We build useful software and original games. From tools that make work easier to worlds worth exploring, we turn good ideas into things people love to use.</p><div class="actions">${button("Explore software", "/software/", true)}${button("Discover our games", "#games")}</div></div>${sculpture()}</div><div class="hero-bottom"><span>Software with purpose. Games with character.</span><div class="small-games">${image("idle-ant-colony.webp", "", 'width="24" height="24"')}${image("game-central.webp", "", 'width="24" height="24"')}<span><b>Original games.</b> From our studio.</span></div><span>Scroll to explore ↓</span></div></div></section>${softwareSection()}<section class="section wrap" id="games"><div class="section-head"><div><div class="eyebrow">02 / Our games</div><h2>Find your kind of play.</h2></div><p>A colony to grow. A collection to explore.<br>Something a little different, every time.</p></div><div class="game-grid">${gameCard("idle-ant-colony", 1)}${gameCard("game-central", 2)}</div></section><section class="section studio" id="studio"><div class="wrap"><div class="studio-layout"><div><div class="eyebrow">03 / The studio</div><p class="studio-note">INDEPENDENT BY DESIGN.<br>AUSTRALIAN AT HEART.</p></div><div><h2>Good things start<br>with <span>a little curiosity.</span></h2><p>Drury Module is the independent software and games studio of Australian developer Cameron Drury. We build across the web and mobile — creating practical tools, thoughtful digital products and original games with personalities of their own.</p><p style="margin-top:20px">Every project starts with the people who will use it. We care about the details, the feel of a good interaction, and making complicated things easier — whether you are getting something done or taking a moment to play.</p></div></div><div class="principles"><article class="principle"><b>01 — CHARACTER</b><h3>Products with a point of view.</h3><p>Purposeful interfaces, thoughtful details and a clear identity, carried through from the first interaction.</p></article><article class="principle"><b>02 — CURIOSITY</b><h3>A better way to do things.</h3><p>Question the familiar, explore a new approach and turn a promising idea into something useful or unexpected.</p></article><article class="principle"><b>03 — CARE</b><h3>Made by a person. For people.</h3><p>Clear information, a direct line to the developer, and support when you need a hand.</p></article></div></div></section><section class="section wrap support-band"><div><div class="eyebrow">04 / Here to help</div><h2>A human on<br>the other side.</h2><p>Have a software project in mind, a product question or a game that needs a hand? You can reach the person building it.</p></div><div class="support-links"><a href="/support/"><span><small>01</small>Get product support</span>${arrow}</a><a href="/privacy/"><span><small>02</small>Your privacy, explained</span>${arrow}</a><a href="mailto:${email}"><span><small>03</small>Discuss a software project</span>${arrow}</a></div></section>`,
);

await page(
  "/software/",
  "Software development",
  "Web applications, mobile apps, websites and custom tools from Drury Module, an independent Australian software and games studio.",
  `${breadcrumb("Software")}${titleBlock("Software development · Australia", "An idea is a start.<br>Let’s make it useful.", "We build websites, applications and custom tools that help people get things done. Thoughtful design and practical development, from the first conversation to the details that make it work.", `<div class="actions software-intro-actions">${button("Discuss a software project", softwareEnquiry, true)}${button("Meet the studio", "/#studio")}</div>`)}<section class="wrap software-detail"><div class="section-head"><div><div class="eyebrow">What we build</div><h2>Software that fits.</h2></div></div>${softwareCards(true)}</section><section class="section studio"><div class="wrap"><div class="studio-layout"><div><div class="eyebrow">How we approach it</div><p class="studio-note">CLEAR PURPOSE.<br>CONSIDERED EXECUTION.</p></div><div><h2>Start with the problem.<br><span>Build around the person.</span></h2><p>A good product starts with understanding what someone needs to do. We work through the essential flows, choose the right shape for the application and refine the details as the idea becomes real.</p></div></div><div class="principles"><article class="principle"><b>01 — UNDERSTAND</b><h3>Find the useful part.</h3><p>Who is it for? What should it help them do? A clear purpose gives the project a practical starting point.</p></article><article class="principle"><b>02 — BUILD</b><h3>Make the idea tangible.</h3><p>Bring the interface and functionality together, with room to test assumptions and refine the experience.</p></article><article class="principle"><b>03 — REFINE</b><h3>Care about the details.</h3><p>Check the real interactions, improve what feels awkward and make the important things easy to find.</p></article></div></div></section><section class="section wrap"><div class="band"><div><h2>What would you like to build?</h2><p>Tell us about the idea, who will use it and what a useful result would look like. We can start from there.</p></div>${button("Talk to Cameron", softwareEnquiry, true)}</div></section>`,
  "software",
);

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
      "The collection works offline, with artwork included in the app and progress saved on your iPhone. No account needed.",
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
        ["Platform", "iPhone · iOS 18+"],
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
    `${breadcrumb(game.name)}<div class="wrap product-hero"><div><div class="eyebrow">${game.type}</div><h1>${ant ? "Small colony.<br>Big ambition." : "Your next world<br>is one tap away."}</h1><p>${game.description}</p><div class="actions">${ant ? button("View on the App Store", store, true) : '<span class="pill">Coming soon to iPhone</span>'}${button("Player support", `/support/${slug}/`)}</div>${!ant ? '<p class="notice">Game Central is being prepared for the App Store. Explore the collection here and check back for its release.</p>' : '<p class="form-note">Free to download. Includes advertising and optional in-app purchases.</p>'}</div><div class="product-image ${ant ? "ant-image" : ""}">${image(game.icon, game.name + " app artwork", 'width="640" height="640" fetchpriority="high"')}<div class="product-caption">${game.name} / Drury Module</div></div></div><dl class="wrap fact-strip">${facts.map(([key, value]) => `<div><dt>${key}</dt><dd>${value}</dd></div>`).join("")}</dl><section class="section wrap"><div class="section-head"><div><div class="eyebrow">Made for your kind of play</div><h2>${ant ? "A little more. Every day." : "Stay curious. Keep playing."}</h2></div></div><div class="feature-grid">${features[slug].map(([title, desc], i) => `<article><span class="number">0${i + 1}</span><h3>${title}</h3><p>${desc}</p></article>`).join("")}</div></section>${worlds}<section class="wrap" style="padding-bottom:90px"><div class="band"><div><h2>Good to know before you play.</h2><p>Find answers, contact the developer and read how ${game.name} handles your information.</p></div><div class="actions">${button("Support", `/support/${slug}/`)}${button("Privacy", `/privacy/${slug}/`)}</div></div></section>`,
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
    )}<option>Software project</option><option${!slug ? " selected" : ""}>General enquiry</option></select></div><div class="field"><label for="topic">What can we help with?</label><select id="topic" name="topic"><option>Something is not working</option><option>Progress or saved games</option><option>Purchase help</option><option>Software project enquiry</option><option>Feedback or an idea</option><option>Privacy question</option><option>Something else</option></select></div><div class="field"><label for="device">Device / operating system (optional)</label><input id="device" name="device" placeholder="e.g. iPhone 16, iOS 18" maxlength="100"></div><div class="field"><label for="version">App / browser version (optional)</label><input id="version" name="version" placeholder="e.g. 1.2.2" maxlength="30"></div><div class="field full"><label for="message">Tell us what happened</label><textarea id="message" name="message" required minlength="10" maxlength="1800" placeholder="What were you doing? What did you expect to happen?"></textarea></div></div><p class="form-note">This opens a draft in your email app. Nothing is submitted through this website. Add any screenshots there, then send when you are ready. <a href="/privacy/#website">How we handle support messages</a>.</p><button class="button primary" type="submit">Prepare support email ${arrow}</button><p class="form-status" id="form-status" role="status" aria-live="polite"></p><a class="text-link" id="email-draft-link" hidden>Open the email draft again ${arrow}</a></fieldset><noscript><p class="form-fallback">The email builder needs JavaScript. You can email <a href="mailto:${email}">${email}</a> directly instead.</p></noscript></form>`;
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
