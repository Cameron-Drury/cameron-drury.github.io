import { recognize } from "./ocr.mjs";
import { saveDraft, loadDraft, clearDraft } from "./drafts.mjs";

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const escapeHTML = (value = "") =>
  String(value).replace(
    /[&<>"']/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        character
      ],
  );
const icons = {
  select: '<path d="m4 3 12 8-6 1-2 6Z"/>',
  text: '<path d="M4 5h16M12 5v15M8 20h8M4 5v3M20 5v3"/>',
  edit: '<path d="m4 17-1 4 4-1L20 7l-3-3Zm10-10 3 3M13 21h8"/>',
  image:
    '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8" cy="9" r="1.5"/><path d="m3 16 5-4 4 3 4-6 5 8"/>',
  highlight: '<path d="m6 15 9-11 5 4-9 11ZM6 15l-3 6h8M3 22h18"/>',
  underline: '<path d="M6 3v8a6 6 0 0 0 12 0V3M4 22h16"/>',
  strikeout: '<path d="M18 5c-5-5-13 0-10 4M7 18c5 5 13 0 10-4M3 12h18"/>',
  ink: '<path d="M3 18c9-20-2 6 5 2s5-14 8-10-1 8 5 6"/>',
  rectangle: '<rect x="4" y="5" width="16" height="14" rx="1"/>',
  ellipse: '<ellipse cx="12" cy="12" rx="9" ry="7"/>',
  arrow: '<path d="M4 20 20 4M10 4h10v10"/>',
  line: '<path d="M4 20 20 4"/>',
  note: '<path d="M4 4h16v12l-5 5H4ZM15 21v-5h5M8 8h8M8 12h6"/>',
  stamp: '<path d="M5 18h14v3H5ZM8 14V8a4 4 0 1 1 8 0v6M5 14h14v4H5"/>',
  signature: '<path d="M3 17c9-20 0 8 8-4s-2 14 6 3l4 1M3 22h18"/>',
  search: '<circle cx="10" cy="10" r="6"/><path d="m15 15 6 6"/>',
  page: '<path d="M6 3h9l5 5v13H6ZM15 3v6h5"/>',
  rotate: '<path d="M20 10a8 8 0 1 0-2 8M20 3v7h-7"/>',
  crop: '<path d="M7 2v15h15M2 7h15v15"/>',
  merge: '<path d="M5 3v5l7 5 7-5V3M12 13v8M8 17l4 4 4-4"/>',
  extract: '<path d="M14 3h7v7M21 3 11 13M18 13v8H3V6h8"/>',
  duplicate:
    '<rect x="8" y="8" width="12" height="13" rx="1"/><path d="M15 8V3H3v13h5"/>',
  trash: '<path d="M3 6h18M8 6V3h8v3M6 6l1 15h10l1-15M10 10v7M14 10v7"/>',
  redact:
    '<rect x="3" y="7" width="18" height="10" rx="1" fill="currentColor"/>',
  lock: '<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 1 1 8 0v3M12 14v3"/>',
  download: '<path d="M12 3v12M7 10l5 5 5-5M4 17v4h16v-4"/>',
  print: '<path d="M6 8V3h12v5M6 17H3V8h18v9h-3M6 14h12v7H6M17 11h1"/>',
  watermark: '<path d="m4 20 4-16 4 12 4-12 4 16M3 22h18"/>',
  numbers: '<path d="M5 3v18M14 3v18M2 9h18M2 15h18"/>',
  metadata: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7h.01"/>',
  ocr: '<path d="M3 8V3h5M16 3h5v5M21 16v5h-5M8 21H3v-5M7 16l4-8h2l4 8M9 13h6"/>',
  link: '<path d="m9 15 6-6M10 7l2-2a5 5 0 0 1 7 7l-2 2M14 17l-2 2a5 5 0 0 1-7-7l2-2"/>',
  form: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M6 8h5M6 12h12M6 16h8"/>',
};
const icon = (name) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] || icons.page}</svg>`;
const modes = {
  Read: [
    ["select", "Select"],
    ["search", "Find"],
    ["link", "Add link"],
  ],
  Edit: [
    ["replaceText", "Edit text", "edit"],
    ["editImages", "Edit images", "image"],
    ["text", "Add text"],
    ["image", "Add image"],
    ["ocr", "Recognise text", "ocr"],
  ],
  Annotate: [
    ["highlight", "Highlight"],
    ["underline", "Underline"],
    ["strikeout", "Strikeout"],
    ["ink", "Draw"],
    ["rectangle", "Rectangle"],
    ["ellipse", "Ellipse"],
    ["arrow", "Arrow"],
    ["note", "Note"],
    ["stamp", "Stamp"],
  ],
  Pages: [
    ["blank", "Insert page", "page"],
    ["merge", "Combine PDFs", "merge"],
    ["rotate", "Rotate"],
    ["crop", "Crop"],
    ["duplicate", "Duplicate"],
    ["extract", "Extract"],
    ["deletePages", "Delete", "trash"],
  ],
  "Fill & Sign": [
    ["form", "Fill forms"],
    ["signature", "Signature"],
    ["text", "Add text"],
    ["stamp", "Stamp"],
  ],
  Protect: [
    ["redact", "Mark redaction", "redact"],
    ["applyRedactions", "Apply redactions", "lock"],
    ["password", "Password", "lock"],
  ],
  Export: [
    ["save", "Save PDF", "download"],
    ["png", "Export image", "image"],
    ["exportText", "Export text", "text"],
    ["print", "Print"],
    ["watermark", "Watermark"],
    ["pageNumbers", "Page numbers", "numbers"],
    ["metadata", "Document details", "metadata"],
  ],
};
const hints = {
  select:
    "Drag text, images and marks to move them. Use the corner handles to resize.",
  replaceText:
    "Click a line to edit it. Drag the selected line or its handles to move or resize.",
  editImages:
    "Drag an image to move it. Use its handles to resize; hold Shift to keep its proportions.",
  text: "Click or drag on the page to add text.",
  image: "Drag on the page to place your image.",
  highlight: "Drag over a passage to highlight it.",
  underline: "Drag across the text to underline it.",
  strikeout: "Drag across the text to strike it out.",
  ink: "Draw directly on the page.",
  rectangle: "Drag to draw a rectangle.",
  ellipse: "Drag to draw an ellipse.",
  arrow: "Drag from the start of your arrow to its tip.",
  line: "Drag to draw a line.",
  note: "Click the page to leave a note.",
  stamp: "Click or drag to place a stamp.",
  signature: "Drag to place your signature.",
  crop: "Drag a rectangle around the area you want to keep.",
  redact: "Drag over content to mark it for permanent removal.",
  link: "Drag over the area you want to link.",
  form: "Click a highlighted form field to fill it.",
};
const state = {
  info: null,
  page: 0,
  scale: 1,
  mode: "Read",
  tool: "select",
  render: null,
  selection: null,
  name: "Untitled.pdf",
  busy: false,
  dirty: false,
  revision: 0,
  history: 0,
  redo: 0,
  query: "",
  matches: [],
  pendingImage: null,
  pendingSignature: null,
  options: {
    fontSize: 16,
    color: "#7356b2",
    opacity: 0.45,
    strokeWidth: 2,
    text: "",
    stamp: "APPROVED",
  },
  thumbnailURLs: [],
  pageURL: null,
  draftTimer: null,
  renderTicket: 0,
  thumbTicket: 0,
};
let worker,
  workerReady,
  requestID = 0,
  toastTimer,
  searchTimer,
  zoomTimer;
let formSavePromise = Promise.resolve();
let formCommitActive = false;
const idleWaiters = [];
const requests = new Map();
async function rpc(method, ...args) {
  if (!worker) {
    worker = new Worker("/assets/pdf-editor/worker.mjs", { type: "module" });
    workerReady = new Promise((resolve, reject) => {
      const bootTimeout = setTimeout(
        () =>
          reject(
            new Error(
              "The PDF engine took too long to start. Refresh the page and try again.",
            ),
          ),
        60000,
      );
      worker.onmessage = ({ data }) => {
        if (data.ready) {
          clearTimeout(bootTimeout);
          resolve();
          return;
        }
        const item = requests.get(data.id);
        if (!item) return;
        requests.delete(data.id);
        clearTimeout(item.timeout);
        data.error
          ? item.reject(new Error(data.error))
          : item.resolve(data.result);
      };
      worker.onerror = (event) => {
        clearTimeout(bootTimeout);
        const error = new Error(
          event.message ||
            "The PDF engine could not start. Refresh the page and try again.",
        );
        reject(error);
        for (const item of requests.values()) {
          clearTimeout(item.timeout);
          item.reject(error);
        }
        requests.clear();
      };
    });
  }
  await workerReady;
  return new Promise((resolve, reject) => {
    const id = ++requestID;
    const timeout = setTimeout(() => {
      requests.delete(id);
      reject(
        new Error(
          "This PDF operation took too long. Try a smaller document or refresh the editor.",
        ),
      );
    }, 180000);
    requests.set(id, { resolve, reject, timeout });
    worker.postMessage({ id, method, args });
  });
}
function toast(message, error = false, duration = 5000) {
  clearTimeout(toastTimer);
  $("#toast").textContent = message;
  $("#toast").classList.toggle("error", error);
  $("#toast").hidden = false;
  toastTimer = setTimeout(() => ($("#toast").hidden = true), duration);
}
function setBusy(value, label = "Working on your document…") {
  state.busy = value;
  $("#working-overlay").hidden = !value;
  $("#working-label").textContent = label;
  $("#document-state").textContent = value
    ? label
    : state.dirty
      ? "Edited on this device"
      : "Ready to edit";
  $("#save-button").disabled = value && !formCommitActive;
  $("#open-button").disabled = value && !formCommitActive;
  $("#sample-button").disabled = value;
  $("#blank-button").disabled = value;
  const welcomeStatus = $("#welcome-status");
  if (welcomeStatus) {
    welcomeStatus.hidden = !value;
    welcomeStatus.textContent = label;
  }
  $("#dropzone").setAttribute("aria-disabled", String(value));
  updateHistory();
  if (!value) idleWaiters.splice(0).forEach((resolve) => resolve());
}
function waitUntilIdle() {
  return state.busy
    ? new Promise((resolve) => idleWaiters.push(resolve))
    : Promise.resolve();
}
function countPages() {
  return state.info?.pageCount ?? state.info?.pages?.length ?? 0;
}
function normalRect(rect) {
  if (Array.isArray(rect)) return rect;
  if (rect && typeof rect === "object")
    return [
      rect.x ?? rect.x0 ?? 0,
      rect.y ?? rect.y0 ?? 0,
      rect.x1 ?? (rect.x ?? 0) + (rect.width ?? 0),
      rect.y1 ?? (rect.y ?? 0) + (rect.height ?? 0),
    ];
  return [0, 0, 595, 842];
}
function bounds() {
  return normalRect(state.render?.bounds || [0, 0, 595, 842]);
}
function hexColor(color) {
  if (typeof color === "string") return color;
  if (Array.isArray(color))
    return (
      "#" +
      color
        .slice(0, 3)
        .map((v) =>
          Math.round(Math.max(0, Math.min(1, v)) * 255)
            .toString(16)
            .padStart(2, "0"),
        )
        .join("")
    );
  return "#26262c";
}
function pageDimensions() {
  const b = bounds();
  return { width: b[2] - b[0], height: b[3] - b[1] };
}
function svgRect(rect, attributes = "") {
  const r = normalRect(rect);
  return `<rect x="${r[0]}" y="${r[1]}" width="${Math.max(0.1, r[2] - r[0])}" height="${Math.max(0.1, r[3] - r[1])}" ${attributes}/>`;
}
function displayBytes(size) {
  if (!Number.isFinite(size)) return "PDF document";
  return size > 1048576
    ? `${(size / 1048576).toFixed(1)} MB`
    : `${Math.round(size / 1024)} KB`;
}
function download(bytes, name, type = "application/pdf") {
  const url = URL.createObjectURL(new Blob([bytes], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
function fileStem() {
  return state.name.replace(/\.pdf$/i, "");
}
function updateHistory() {
  $("#undo-button").disabled =
    state.busy || !(state.info?.canUndo ?? state.history > 0);
  $("#redo-button").disabled =
    state.busy || !(state.info?.canRedo ?? state.redo > 0);
}
function setMode(mode) {
  state.mode = mode;
  state.selection = null;
  setTool(
    mode === "Edit"
      ? "replaceText"
      : mode === "Fill & Sign"
        ? "form"
        : "select",
  );
  renderToolbar();
}
function renderToolbar() {
  $("#modebar").innerHTML = Object.keys(modes)
    .map(
      (mode) =>
        `<button data-mode="${mode}" class="${state.mode === mode ? "active" : ""}" aria-pressed="${state.mode === mode}">${mode}</button>`,
    )
    .join("");
  $("#tool-buttons").innerHTML = modes[state.mode]
    .map(
      ([id, label, glyph]) =>
        `<button class="tool-button ${state.tool === id ? "active" : ""} ${id === "deletePages" ? "danger" : ""}" id="tool-${id}" data-tool="${id}" title="${label}" aria-pressed="${state.tool === id}">${icon(glyph || id)}<span>${label}</span></button>`,
    )
    .join("");
}
function setTool(tool) {
  state.tool = tool;
  state.selection = null;
  $("#tool-hint").textContent = hints[tool] || "Make this document your own.";
  $("#page-overlay").className.baseVal =
    `page-overlay ${tool === "select" ? "select-tool" : tool === "replaceText" ? "text-tool" : "annotation-tool"}`;
  renderToolbar();
  renderInspector();
  renderOverlay();
  if (matchMedia("(max-width:620px)").matches) $("#sidebar").hidden = true;
}
async function openFiles(files) {
  if (formCommitActive) await formSavePromise;
  if (state.busy) {
    toast("Your current PDF operation is still running.");
    return;
  }
  const pdfs = [...files].filter(
    (file) => /\.pdf$/i.test(file.name) || file.type === "application/pdf",
  );
  if (!pdfs.length) {
    toast("Choose a PDF document.", true);
    return;
  }
  if (state.dirty) {
    try {
      setBusy(true, "Saving your recovery draft…");
      clearTimeout(state.draftTimer);
      const bytes = await rpc("save", {});
      await saveDraft({ bytes, name: state.name, page: state.page });
      $("#draft-state").textContent = "Recovery draft saved";
    } catch {
      $("#draft-state").textContent = "Download a copy to keep your work";
      toast(
        "The recovery draft could not be saved. Download your current PDF before opening another document.",
        true,
      );
      return;
    } finally {
      setBusy(false);
    }
    if (
      !confirm(
        "Open another document? Your current work has been saved as a recovery draft in this browser.",
      )
    )
      return;
  }
  const opened = await openDocument(
    new Uint8Array(await pdfs[0].arrayBuffer()),
    pdfs[0].name,
  );
  if (!opened) return;
  for (const file of pdfs.slice(1)) await mergeFile(file);
}
async function mergeFile(file) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let password = "";
  for (;;) {
    try {
      return await mutate(
        { type: "merge", bytes, at: countPages(), password },
        `Combining ${file.name}…`,
        true,
      );
    } catch (error) {
      if (!/password|encrypt/i.test(error.message)) {
        toast(error.message, true);
        return false;
      }
      const response = await modal(
        "Combine a protected PDF",
        `<p>${password ? "That password did not unlock the file. Try again." : `${escapeHTML(file.name)} needs a password before it can be combined.`}</p><label class="field"><span>Document password</span><input id="merge-password" type="password" autocomplete="off" required autofocus></label>`,
        [{ label: "Unlock & combine", value: "submit", primary: true }],
      );
      if (response !== "submit") return false;
      password = $("#merge-password").value;
    }
  }
}
async function openDocument(bytes, name, password = "", restorePage = 0) {
  try {
    setBusy(true, "Opening your document…");
    const info = await rpc("open", bytes, password);
    if (info?.needsPassword) throw new Error("Document password required");
    state.info = info || (await rpc("info"));
    state.name = name;
    state.page = Math.min(restorePage, countPages() - 1);
    state.scale = 1;
    state.dirty = false;
    state.history = 0;
    state.redo = 0;
    state.revision++;
    state.query = "";
    state.matches = [];
    state.pendingImage = null;
    state.pendingSignature = null;
    $("#search-input").value = "";
    showEditor();
    setMode("Read");
    await renderPage(true);
    renderThumbnails();
    toast(`${name} is ready. Your document stays on this device.`);
    return true;
  } catch (error) {
    if (/password|encrypt/i.test(error.message)) {
      setBusy(false);
      const response = await modal(
        "Open a protected PDF",
        `<p>${password ? "That password did not open the document. Try again." : "This document needs its password before it can be opened."}</p><label class="field"><span>Document password</span><input id="pdf-password" type="password" autocomplete="off" required autofocus></label>`,
        [{ label: "Open document", value: "submit", primary: true }],
      );
      if (response === "submit")
        return openDocument(bytes, name, $("#pdf-password").value, restorePage);
    } else toast(error.message, true, 8000);
    return false;
  } finally {
    setBusy(false);
  }
}
function showEditor() {
  document.body.classList.add("document-open");
  $("#welcome").hidden = true;
  $("#editor").hidden = false;
  $("#save-button").hidden = false;
  $("#document-heading").hidden = false;
  $("#document-name").textContent = state.name;
  $("#sidebar").hidden = matchMedia("(max-width:620px)").matches;
  $("#inspector").hidden = matchMedia("(max-width:800px)").matches;
  updatePageNumbers();
  renderInspector();
}
function updatePageNumbers() {
  const count = countPages();
  $("#page-count").textContent = count;
  $("#total-pages").textContent = `/ ${count}`;
  $("#current-page").value = state.page + 1;
  $("#current-page").max = count;
  $("#previous-page").disabled = state.page <= 0;
  $("#next-page").disabled = state.page >= count - 1;
  $("#empty-page").hidden = count > 0;
  $("#page-stage").hidden = count === 0;
  renderBookmarks();
}
async function renderPage(fit = false, preserveSelection = false) {
  if (!countPages()) return;
  const ticket = ++state.renderTicket;
  if (!preserveSelection) state.selection = null;
  updatePageNumbers();
  const dimensions = pageDimensions(),
    quality = Math.max(
      0.2,
      Math.min(
        4,
        state.scale * devicePixelRatio,
        Math.sqrt(30000000 / (dimensions.width * dimensions.height)),
      ),
    );
  const data = await rpc("render", state.page, quality);
  if (ticket !== state.renderTicket) return;
  state.render = data;
  const url = URL.createObjectURL(new Blob([data.png], { type: "image/png" }));
  if (state.pageURL) URL.revokeObjectURL(state.pageURL);
  state.pageURL = url;
  $("#page-image").src = url;
  if (fit) fitPage();
  else layoutPage();
  renderOverlay();
  if (!preserveSelection) renderInspector();
  $$(".thumbnail").forEach((el) =>
    el.classList.toggle("active", Number(el.dataset.page) === state.page),
  );
}
function layoutPage() {
  const { width, height } = pageDimensions();
  $("#page-stage").style.width = `${width * state.scale}px`;
  $("#page-stage").style.height = `${height * state.scale}px`;
  $("#zoom-value").textContent = `${Math.round(state.scale * 100)}%`;
}
function fitPage() {
  const { width, height } = pageDimensions();
  const scroller = $("#page-scroll");
  state.scale = Math.min(
    (scroller.clientWidth - 64) / width,
    (scroller.clientHeight - 85) / height,
    1.4,
  );
  state.scale = Math.max(0.25, state.scale);
  layoutPage();
}
function setZoom(scale) {
  state.scale = Math.max(0.25, Math.min(4, scale));
  layoutPage();
  renderOverlay();
  clearTimeout(zoomTimer);
  zoomTimer = setTimeout(() => {
    if (!state.busy)
      renderPage(false, true).catch((error) => toast(error.message, true));
  }, 220);
}
async function navigate(page) {
  if (state.busy || !countPages()) return;
  state.page = Math.max(0, Math.min(countPages() - 1, page));
  $("#page-scroll").scrollTop = 0;
  try {
    await renderPage();
    if (matchMedia("(max-width:620px)").matches) $("#sidebar").hidden = true;
  } catch (error) {
    toast(error.message, true);
  }
}
async function renderThumbnails() {
  const ticket = ++state.thumbTicket;
  for (const url of state.thumbnailURLs) URL.revokeObjectURL(url);
  state.thumbnailURLs = [];
  $("#thumbnails").innerHTML = Array.from(
    { length: countPages() },
    (_, page) =>
      `<div class="thumbnail ${state.page === page ? "active" : ""}" data-page="${page}" draggable="true"><button class="thumbnail-frame" data-navigate="${page}" aria-label="Go to page ${page + 1}"><span class="spinner" style="width:15px;height:15px"></span></button><button class="thumbnail-menu" data-page-menu="${page}" aria-label="Actions for page ${page + 1}">⋯</button><span class="thumbnail-label">${page + 1}</span></div>`,
  ).join("");
  for (let page = 0; page < countPages(); page++) {
    if (ticket !== state.thumbTicket) return;
    try {
      const data = await rpc("render", page, 0.2);
      if (ticket !== state.thumbTicket) return;
      const url = URL.createObjectURL(
        new Blob([data.png], { type: "image/png" }),
      );
      state.thumbnailURLs.push(url);
      const frame = $(`[data-navigate="${page}"]`);
      if (frame) {
        frame.innerHTML = `<img src="${url}" alt="Page ${page + 1}">`;
        frame.style.minHeight = "0";
      }
    } catch {
      const frame = $(`[data-navigate="${page}"]`);
      if (frame) frame.textContent = `Page ${page + 1}`;
    }
  }
}
function renderOverlay() {
  if (!state.render) return;
  // A quality refresh must not replace a field while the user is typing.
  if (
    state.tool === "form" &&
    document.activeElement?.matches(".pdf-form-field")
  )
    return;
  const b = bounds();
  $("#page-overlay").setAttribute(
    "viewBox",
    `${b[0]} ${b[1]} ${b[2] - b[0]} ${b[3] - b[1]}`,
  );
  let html = "";
  if (state.tool === "editImages" || state.tool === "select")
    html += (state.render.imageBlocks || [])
      .map((block, index) =>
        svgRect(
          block.rect,
          `class="annotation-hit" data-image="${index}" role="button" tabindex="0" aria-label="Edit image ${index + 1}"`,
        ),
      )
      .join("");
  if (state.tool === "replaceText" || state.tool === "select")
    html += (state.render.textBlocks || [])
      .map((block, index) =>
        svgRect(
          block.rect,
          `class="text-hit" data-text="${index}" role="button" tabindex="0" aria-label="Edit ${escapeHTML(block.text)}"`,
        ),
      )
      .join("");
  if (state.tool === "select")
    html += (state.render.annotations || [])
      .map((annotation) =>
        svgRect(
          annotation.rect,
          `class="annotation-hit" data-annotation="${escapeHTML(annotation.id)}" role="button" tabindex="0" aria-label="Edit ${escapeHTML(annotation.type || "annotation")}"`,
        ),
      )
      .join("");
  if (state.query)
    for (const match of state.matches.filter(
      (item) => item.page === state.page,
    ))
      for (const rect of match.rects || [])
        html += svgRect(rect, 'class="search-match"');
  if (state.tool === "form")
    html += (state.render.widgets || [])
      .map((widget) => formWidget(widget))
      .join("");
  if (state.tool === "select")
    html += (state.render.links || [])
      .map((link) =>
        svgRect(
          link.rect,
          `class="annotation-hit" data-link="${escapeHTML(link.id)}" role="button" tabindex="0" aria-label="Inspect link"`,
        ),
      )
      .join("");
  if (state.selection?.rect)
    html += selectionControls(
      state.selection.rect,
      state.selection.kind !== "link",
    );
  $("#page-overlay").innerHTML = html;
}
function selectionControls(rect, resizable = true) {
  const r = normalRect(rect),
    size = (matchMedia("(pointer:coarse)").matches ? 12 : 8) / state.scale,
    stroke = 1 / state.scale;
  if (!resizable) return svgRect(r, 'class="selection-outline"');
  let html = svgRect(
    r,
    `class="selection-frame" data-transform="move" role="button" tabindex="0" aria-label="Move selected ${state.selection?.kind || "object"}" style="stroke-width:${stroke}"`,
  );
  const positions = {
    nw: [r[0], r[1]],
    n: [(r[0] + r[2]) / 2, r[1]],
    ne: [r[2], r[1]],
    e: [r[2], (r[1] + r[3]) / 2],
    se: [r[2], r[3]],
    s: [(r[0] + r[2]) / 2, r[3]],
    sw: [r[0], r[3]],
    w: [r[0], (r[1] + r[3]) / 2],
  };
  for (const [handle, [x, y]] of Object.entries(positions))
    html += `<rect x="${x - size / 2}" y="${y - size / 2}" width="${size}" height="${size}" rx="${1 / state.scale}" class="resize-handle resize-${handle}" data-resize="${handle}" role="button" tabindex="0" aria-label="Resize selected object from ${handle}" style="stroke-width:${stroke}"/>`;
  return `<g id="selection-controls">${html}</g>`;
}
function formWidget(widget) {
  const rect = normalRect(widget.rect),
    value = escapeHTML(widget.value || ""),
    type = String(widget.type || "").toLowerCase(),
    name = escapeHTML(widget.name),
    id = escapeHTML(widget.id),
    readonly = widget.readOnly;
  let control;
  if (/check|radio/.test(type))
    control = `<input type="${/radio/.test(type) ? "radio" : "checkbox"}" ${/radio/.test(type) ? `name="pdf-${name}"` : ""} class="pdf-form-field" data-widget="${id}" data-export-value="${escapeHTML(widget.exportValue || "Yes")}" ${(widget.checked ?? (widget.value && widget.value !== "Off")) ? "checked" : ""} ${readonly ? "disabled" : ""} aria-label="${name}" style="accent-color:#7356b2">`;
  else if (/choice|combo|list/.test(type) || widget.options?.length)
    control = `<select class="pdf-form-field" data-widget="${id}" ${readonly ? "disabled" : ""} aria-label="${name}">${(
      widget.options || []
    )
      .map((option, index) => {
        const label = Array.isArray(option) ? option.at(-1) : option,
          exportValue =
            widget.exportOptions?.[index] ??
            (Array.isArray(option) ? option[0] : option);
        return `<option value="${escapeHTML(exportValue)}" ${String(exportValue) === String(widget.value) ? "selected" : ""}>${escapeHTML(label)}</option>`;
      })
      .join("")}</select>`;
  else if (type === "signature")
    control = `<span class="pdf-form-field" style="display:block;font-size:9px">Certificate signature field</span>`;
  else if (widget.multiline)
    control = `<textarea class="pdf-form-field" data-widget="${id}" ${readonly ? "readonly" : ""} ${widget.maxLength ? `maxlength="${widget.maxLength}"` : ""} aria-label="${name}">${value}</textarea>`;
  else
    control = `<input class="pdf-form-field" data-widget="${id}" value="${value}" ${readonly ? "readonly" : ""} ${widget.maxLength ? `maxlength="${widget.maxLength}"` : ""} aria-label="${name}">`;
  return `<foreignObject x="${rect[0]}" y="${rect[1]}" width="${rect[2] - rect[0]}" height="${rect[3] - rect[1]}"><div xmlns="http://www.w3.org/1999/xhtml" style="width:100%;height:100%">${control}</div></foreignObject>`;
}
function inspectorField(label, id, type, value, extra = "") {
  return `<label class="field"><span>${label}</span><input id="${id}" type="${type}" value="${escapeHTML(value)}" ${extra}></label>`;
}
function colorControls() {
  return `<h3>Appearance</h3><div class="color-swatches">${["#7356b2", "#f3c945", "#63a887", "#e78479", "#26262c"].map((color) => `<button data-color="${color}" class="${state.options.color === color ? "active" : ""}" style="--swatch:${color}" aria-label="Use ${color}"></button>`).join("")}</div>${inspectorField("Custom colour", "option-color", "color", state.options.color)}`;
}
function renderInspector() {
  const selection = state.selection;
  let title = "Document",
    html = "";
  if (selection?.kind === "text") {
    title = "Edit text";
    const rect = normalRect(selection.rect),
      scan = Boolean(
        selection.invisible &&
          (state.render.imageBlocks || []).some((image) => {
            const r = normalRect(image.rect);
            return (
              r[0] < rect[2] &&
              r[2] > rect[0] &&
              r[1] < rect[3] &&
              r[3] > rect[1]
            );
          }),
      );
    html = `<p>Replace this line in the PDF. The original text is removed from the saved document.</p><label class="field"><span>Text</span><textarea id="replacement-text">${escapeHTML(selection.text)}</textarea></label><div class="field-row">${inspectorField("Size (pt)", "replacement-size", "number", Math.round(selection.fontSize || 12), 'min="4" max="200"')}${inspectorField("Colour", "replacement-color", "color", hexColor(selection.color))}</div><div class="field-row">${inspectorField("Text box width (pt)", "replacement-width", "number", Math.round(rect[2] - rect[0]), 'min="1"')}${inspectorField("Text box height (pt)", "replacement-height", "number", Math.round(rect[3] - rect[1]), 'min="1"')}</div>${scan ? '<label class="check-field"><input id="replace-scanned-pixels" type="checkbox" checked><span>Remove the scanned letters beneath this line before adding replacement text</span></label>' : ""}<button class="button primary" id="apply-text-edit">Replace text</button><p style="margin-top:13px">Replacement uses an embedded font. Enlarge the text box or reduce its font size for longer text. Complex layouts may change appearance.</p>`;
  } else if (selection?.kind === "image") {
    title = "Edit image";
    const rect = normalRect(selection.rect);
    html = `<p>Replace this image and set the replacement’s position. Removing an image preserves the page’s text.</p><div class="field-row">${inspectorField("Left (pt)", "image-left", "number", Math.round(rect[0]))}${inspectorField("Top (pt)", "image-top", "number", Math.round(rect[1]))}</div><div class="field-row">${inspectorField("Width (pt)", "image-width", "number", Math.round(rect[2] - rect[0]), 'min="1"')}${inspectorField("Height (pt)", "image-height", "number", Math.round(rect[3] - rect[1]), 'min="1"')}</div><button class="button primary" id="replace-existing-image">Choose replacement image</button><button class="button secondary" id="delete-existing-image">Remove image</button>`;
  } else if (selection?.kind === "annotation") {
    title = "Selected mark";
    html = `<p>${escapeHTML(selection.type || "Annotation")} · page ${state.page + 1}</p><label class="field"><span>Text / note</span><textarea id="annotation-text">${escapeHTML(selection.text || "")}</textarea></label>${inspectorField("Colour", "annotation-color", "color", hexColor(selection.color || state.options.color))}${inspectorField("Opacity", "annotation-opacity", "range", selection.opacity ?? 1, 'min="0.05" max="1" step="0.05"')}<button class="button primary" id="update-annotation">Update annotation</button><button class="button secondary" id="delete-annotation">Delete annotation</button>`;
  } else if (selection?.kind === "link") {
    title = "Selected link";
    html = `<p>${escapeHTML(selection.uri || "PDF link")}</p><button class="button secondary" id="visit-link">Open link ↗</button><button class="button secondary" id="delete-link">Remove link</button>`;
  } else if (
    [
      "text",
      "highlight",
      "underline",
      "strikeout",
      "ink",
      "rectangle",
      "ellipse",
      "arrow",
      "note",
      "stamp",
      "redact",
      "image",
      "signature",
      "link",
      "crop",
    ].includes(state.tool)
  ) {
    title = {
      text: "Add text",
      highlight: "Highlight",
      underline: "Underline",
      strikeout: "Strikeout",
      ink: "Draw",
      rectangle: "Rectangle",
      ellipse: "Ellipse",
      arrow: "Arrow",
      note: "Note",
      stamp: "Stamp",
      redact: "Redact",
      image: "Add image",
      signature: "Signature",
      link: "Add link",
      crop: "Crop page",
    }[state.tool];
    html = `<p>${hints[state.tool]}</p>`;
    if (["text", "note", "stamp"].includes(state.tool))
      html += `<label class="field"><span>${state.tool === "stamp" ? "Stamp wording" : state.tool === "note" ? "Note" : "Text"}</span><textarea id="option-text" placeholder="${state.tool === "note" ? "Write a note…" : "Type here…"}">${escapeHTML(state.tool === "stamp" ? state.options.stamp : state.options.text)}</textarea></label>`;
    if (state.tool === "text" || state.tool === "stamp")
      html += inspectorField(
        "Font size (pt)",
        "option-font-size",
        "number",
        state.options.fontSize,
        'min="4" max="200"',
      );
    if (!["crop", "image", "signature", "link", "redact"].includes(state.tool))
      html += colorControls();
    if (["highlight", "rectangle", "ellipse"].includes(state.tool))
      html += inspectorField(
        "Opacity",
        "option-opacity",
        "range",
        state.options.opacity,
        'min="0.1" max="1" step="0.05"',
      );
    if (["ink", "rectangle", "ellipse", "arrow"].includes(state.tool))
      html += inspectorField(
        "Line weight (pt)",
        "option-stroke-width",
        "number",
        state.options.strokeWidth,
        'min="0.5" max="20" step="0.5"',
      );
    if (state.tool === "image" || state.tool === "signature")
      html += `<p>${state.tool === "image" ? "Your image is ready." : "Your signature is ready."} Drag to choose its size on the page.</p><button id="choose-another-image" class="button secondary">Choose another ${state.tool === "image" ? "image" : "signature"}</button>`;
    if (state.tool === "redact")
      html += `<div class="warning-box">Marks are a preview. Apply redactions to permanently remove the covered text and images.</div><button id="inspector-apply-redactions" class="button danger">Apply all redactions</button>`;
    if (state.tool === "crop")
      html += `<p>Cropping changes the visible page area. It does not remove hidden content. Use redaction for sensitive information.</p>`;
  } else if (state.tool === "form") {
    title = "Fill forms";
    const widgets = state.render?.widgets || [];
    html = `<p>${widgets.length ? "The highlighted fields are editable. Values are saved into the PDF." : "This page has no existing form fields. Use Add text or Signature to complete it."}</p>${widgets.map((widget) => `<div class="document-detail"><span>${escapeHTML(widget.name)}</span><strong>${escapeHTML(widget.value || "Empty")}</strong></div>`).join("")}<button class="button secondary" data-inspector-tool="signature">Add signature</button><button class="button secondary" data-inspector-tool="text">Add text</button>`;
  } else if (state.tool === "editImages") {
    title = "Edit images";
    html = `<p>${state.render?.imageBlocks?.length ? "Click an image on the page to replace or remove it." : "This page has no embedded images to edit."}</p><button class="button secondary" data-inspector-tool="image">Add a new image</button>`;
  } else if (state.tool === "replaceText") {
    title = "Edit text";
    html = `<p>Click a line on the page to edit its actual text.</p><p>For scanned pages, recognise the text first. You can then search, select and edit the recognised text.</p><button id="inspector-ocr" class="button secondary">Recognise this page</button>`;
  } else {
    const metadata = state.info?.metadata || {},
      dimensions = pageDimensions();
    html = `<h3>At a glance</h3><div class="document-detail"><span>Pages</span><strong>${countPages()}</strong></div><div class="document-detail"><span>Current page</span><strong>${state.page + 1}</strong></div><div class="document-detail"><span>Page size</span><strong>${Math.round(dimensions.width)} × ${Math.round(dimensions.height)} pt</strong></div><div class="document-detail"><span>File size</span><strong>${displayBytes(state.info?.size ?? state.info?.byteLength)}</strong></div>${metadata.title ? `<div class="document-detail"><span>Title</span><strong>${escapeHTML(metadata.title)}</strong></div>` : ""}<div class="inspector-divider"></div><h3>Make it yours</h3><p>Read, edit and organise your document using the tabs above.</p><button class="button secondary" data-inspector-mode="Edit">Edit document text</button><button class="button secondary" data-inspector-mode="Annotate">Highlight & annotate</button><button class="button secondary" data-inspector-mode="Fill & Sign">Fill & sign</button><div class="inspector-divider"></div><h3>Your workspace</h3><p>A recovery draft is stored in this browser after you edit. Download a copy to keep a portable file.</p><button class="button secondary" id="clear-draft-button">Clear local recovery draft</button>`;
  }
  $("#inspector-title").textContent = title;
  $("#inspector-content").innerHTML = html;
}
async function mutate(
  op,
  label = "Updating your document…",
  throwOnError = false,
) {
  if (state.busy) return false;
  try {
    setBusy(true, label);
    const result = await rpc("mutate", op);
    state.info = result || (await rpc("info"));
    state.dirty = true;
    state.history++;
    state.redo = 0;
    state.revision++;
    state.page = Math.max(0, Math.min(state.page, countPages() - 1));
    state.selection = null;
    updatePageNumbers();
    await renderPage();
    renderThumbnails();
    scheduleDraft();
    if (state.query) await searchDocument(state.query);
    return true;
  } catch (error) {
    if (throwOnError) throw error;
    toast(error.message, true, 7000);
    return false;
  } finally {
    setBusy(false);
  }
}
function scheduleDraft() {
  clearTimeout(state.draftTimer);
  const revision = state.revision;
  $("#draft-state").textContent = "Saving local draft…";
  state.draftTimer = setTimeout(async () => {
    try {
      const bytes = await rpc("save", {});
      if (revision !== state.revision) return;
      await saveDraft({ bytes, name: state.name, page: state.page });
      $("#draft-state").textContent = "Recovery draft saved";
    } catch {
      $("#draft-state").textContent = "Download a copy to keep your work";
    }
  }, 1000);
}
async function historyAction(method) {
  if (state.busy) return;
  try {
    setBusy(
      true,
      method === "undo"
        ? "Undoing your last change…"
        : "Redoing your last change…",
    );
    state.info = (await rpc(method)) || (await rpc("info"));
    state.history = Math.max(0, state.history + (method === "undo" ? -1 : 1));
    state.redo = Math.max(0, state.redo + (method === "undo" ? 1 : -1));
    state.dirty = true;
    state.revision++;
    state.page = Math.min(state.page, countPages() - 1);
    await renderPage();
    renderThumbnails();
    scheduleDraft();
  } catch (error) {
    toast(error.message, true);
  } finally {
    setBusy(false);
  }
}
function modal(
  title,
  body,
  actions = [{ label: "Done", value: "submit", primary: true }],
  setup,
) {
  const dialog = $("#modal");
  if (dialog.open) dialog.close("cancel");
  $("#modal-title").textContent = title;
  $("#modal-body").innerHTML = body;
  $("#modal-actions").innerHTML =
    `<button class="button secondary" value="cancel" formnovalidate>Cancel</button>${actions.map((action) => `<button class="button ${action.danger ? "danger" : action.primary ? "primary" : "secondary"}" value="${action.value || "submit"}" id="${action.id || "modal-submit"}">${action.label}</button>`).join("")}`;
  dialog.showModal();
  if (setup) setup();
  return new Promise((resolve) =>
    dialog.addEventListener("close", () => resolve(dialog.returnValue), {
      once: true,
    }),
  );
}
async function searchDocument(query) {
  state.query = query;
  $("#search-results").innerHTML = query
    ? "<p>Searching…</p>"
    : "<p>Find a word or phrase in this document.</p>";
  if (!query) {
    state.matches = [];
    renderOverlay();
    return;
  }
  try {
    const results = await rpc("search", query);
    if (state.query !== query) return;
    state.matches = results || [];
    $("#search-results").innerHTML = results.length
      ? results
          .map(
            (result, index) =>
              `<button data-search-match="${index}">Page ${result.page + 1}<small>${result.rects?.length || 1} matching passage${result.rects?.length === 1 ? "" : "s"}</small></button>`,
          )
          .join("")
      : "<p>No matches. Scanned pages may need text recognition first.</p>";
    renderOverlay();
  } catch (error) {
    toast(error.message, true);
  }
}
function setSidebarView(view) {
  $("#search-panel").hidden = view !== "search";
  $("#thumbnails").hidden = view !== "pages";
  if ($("#bookmarks")) $("#bookmarks").hidden = view !== "bookmarks";
  for (const key of ["pages", "search", "bookmarks"])
    $(`#${key}-view-button`)?.classList.toggle("active", key === view);
}
function showSearch() {
  setSidebarView("search");
  $("#sidebar").hidden = false;
  $("#search-input").focus();
  if (!state.query)
    $("#search-results").innerHTML =
      "<p>Find a word or phrase in this document.</p>";
}
function showThumbnails() {
  setSidebarView("pages");
}
function renderBookmarks() {
  const panel = $("#bookmarks");
  if (!panel) return;
  const renderItems = (items) =>
    `<ol>${items.map((item) => `<li><button data-bookmark-page="${Number.isInteger(item.page) ? item.page : -1}" data-bookmark-uri="${escapeHTML(item.uri || "")}"><span>${escapeHTML(item.title || "Untitled bookmark")}</span>${item.page >= 0 && item.page < countPages() ? `<small>${item.page + 1}</small>` : ""}</button>${item.children?.length ? renderItems(item.children) : ""}</li>`).join("")}</ol>`;
  panel.innerHTML = state.info?.outline?.length
    ? renderItems(state.info.outline)
    : "<p>This document has no bookmarks. Use Pages or Find to move around.</p>";
}
async function navigateLink(uri, page) {
  if (Number.isInteger(page) && page >= 0 && page < countPages()) {
    await navigate(page);
    return;
  }
  if (/^(https?:\/\/|mailto:|tel:)/i.test(uri)) {
    window.open(uri, "_blank", "noopener");
    return;
  }
  if (uri.startsWith("#")) {
    try {
      const destination = await rpc("resolveLink", uri);
      if (Number.isInteger(destination) && destination >= 0) {
        await navigate(destination);
        return;
      }
    } catch {}
    const match = uri.match(/(?:^#|[&])page=(\d+)/);
    if (match) {
      await navigate(Number(match[1]) - 1);
      return;
    }
  }
  toast("This document link has no supported destination.", true);
}

async function activateTool(tool) {
  if (formCommitActive) await formSavePromise;
  if (state.busy) return;
  if (tool === "search") {
    showSearch();
    return;
  }
  if (tool === "image") {
    state.pendingImageReplacement = null;
    $("#image-input").click();
    return;
  }
  if (tool === "signature") {
    await signatureDialog();
    return;
  }
  if (tool === "ocr") {
    await ocrDialog();
    return;
  }
  if (tool === "blank") {
    await insertPageDialog();
    return;
  }
  if (tool === "merge") {
    $("#merge-input").click();
    return;
  }
  if (tool === "rotate") {
    await mutate(
      { type: "rotate", pages: [state.page], degrees: 90 },
      "Rotating this page…",
    );
    return;
  }
  if (tool === "duplicate") {
    await mutate(
      { type: "duplicatePages", pages: [state.page], at: state.page + 1 },
      "Duplicating this page…",
    );
    state.page++;
    await renderPage();
    return;
  }
  if (tool === "deletePages") {
    await deletePagesDialog();
    return;
  }
  if (tool === "extract") {
    await extractDialog();
    return;
  }
  if (tool === "applyRedactions") {
    await redactDialog();
    return;
  }
  if (tool === "save" || tool === "password") {
    await exportDialog(tool === "password");
    return;
  }
  if (tool === "png") {
    await exportPNG();
    return;
  }
  if (tool === "exportText") {
    await exportText();
    return;
  }
  if (tool === "print") {
    await printDocument();
    return;
  }
  if (tool === "watermark") {
    await watermarkDialog();
    return;
  }
  if (tool === "pageNumbers") {
    await pageNumbersDialog();
    return;
  }
  if (tool === "metadata") {
    await metadataDialog();
    return;
  }
  setTool(tool);
  if (!["select", "replaceText", "form"].includes(tool))
    $("#inspector").hidden = false;
}
function eventPoint(event) {
  const rect = $("#page-overlay").getBoundingClientRect(),
    b = bounds();
  return [
    b[0] + ((event.clientX - rect.left) / rect.width) * (b[2] - b[0]),
    b[1] + ((event.clientY - rect.top) / rect.height) * (b[3] - b[1]),
  ];
}
let gesture = null,
  transformGesture = null;
function startTransform(event, selection, handle = "move") {
  if (!["text", "image", "annotation"].includes(selection?.kind)) return false;
  state.selection = selection;
  renderInspector();
  renderOverlay();
  if (!matchMedia("(max-width:800px)").matches) $("#inspector").hidden = false;
  transformGesture = {
    selection: { ...selection },
    original: normalRect(selection.rect),
    target: normalRect(selection.rect),
    start: eventPoint(event),
    handle,
    moved: false,
    preview: captureSelectionPreview(selection.rect),
  };
  $("#page-overlay").setPointerCapture(event.pointerId);
  event.preventDefault();
  return true;
}
function captureSelectionPreview(rect) {
  try {
    const image = $("#page-image"),
      b = bounds(),
      r = normalRect(rect),
      sx = image.naturalWidth / (b[2] - b[0]),
      sy = image.naturalHeight / (b[3] - b[1]),
      canvas = document.createElement("canvas");
    if (!image.naturalWidth) return null;
    canvas.width = Math.max(1, Math.round((r[2] - r[0]) * sx));
    canvas.height = Math.max(1, Math.round((r[3] - r[1]) * sy));
    canvas
      .getContext("2d")
      .drawImage(
        image,
        (r[0] - b[0]) * sx,
        (r[1] - b[1]) * sy,
        (r[2] - r[0]) * sx,
        (r[3] - r[1]) * sy,
        0,
        0,
        canvas.width,
        canvas.height,
      );
    return canvas.toDataURL("image/png");
  } catch {
    return null;
  }
}
function moveTransform(event) {
  const g = transformGesture,
    p = eventPoint(event),
    dx = p[0] - g.start[0],
    dy = p[1] - g.start[1],
    r = g.original;
  let target = [...r];
  if (g.handle === "move")
    target = r.map((value, index) => value + (index % 2 ? dy : dx));
  else {
    if (g.handle.includes("w")) target[0] = Math.min(r[2] - 2, r[0] + dx);
    if (g.handle.includes("e")) target[2] = Math.max(r[0] + 2, r[2] + dx);
    if (g.handle.includes("n")) target[1] = Math.min(r[3] - 2, r[1] + dy);
    if (g.handle.includes("s")) target[3] = Math.max(r[1] + 2, r[3] + dy);
    if (event.shiftKey) {
      const ratio = (r[2] - r[0]) / (r[3] - r[1]),
        width = target[2] - target[0],
        height = target[3] - target[1];
      if (/e|w/.test(g.handle)) {
        const h = width / ratio;
        if (g.handle.includes("n")) target[1] = target[3] - h;
        else target[3] = target[1] + h;
      } else {
        const w = height * ratio;
        if (g.handle.includes("w")) target[0] = target[2] - w;
        else target[2] = target[0] + w;
      }
    }
  }
  g.target = target;
  g.moved = Math.abs(dx) * state.scale > 2 || Math.abs(dy) * state.scale > 2;
  if (!g.moved) return;
  const old = $("#selection-controls");
  if (old) old.style.display = "none";
  $("#transform-preview")?.remove();
  const image = g.preview
    ? `<image href="${g.preview}" x="${target[0]}" y="${target[1]}" width="${target[2] - target[0]}" height="${target[3] - target[1]}" preserveAspectRatio="none" opacity=".9"/>`
    : "";
  $("#page-overlay").insertAdjacentHTML(
    "beforeend",
    `<g id="transform-preview" pointer-events="none">${svgRect(r, 'fill="white" opacity=".88"')}${image}${svgRect(target, `class="selection-outline" style="stroke-width:${1 / state.scale}"`)}</g>`,
  );
  $("#tool-hint").textContent =
    `${g.handle === "move" ? "Moving" : "Resizing"} · ${Math.round(target[2] - target[0])} × ${Math.round(target[3] - target[1])} pt · release to apply`;
}
async function commitTransform(g) {
  if (!g.moved) {
    $("#inspector").hidden = false;
    renderOverlay();
    return;
  }
  const original = g.original,
    target = g.target,
    selection = g.selection;
  let op;
  if (selection.kind === "image")
    op = {
      type: "moveImage",
      page: state.page,
      id: selection.id,
      rect: original,
      targetRect: target,
    };
  else if (selection.kind === "annotation")
    op = {
      type: "transformAnnotation",
      page: state.page,
      id: selection.id,
      targetRect: target,
    };
  else {
    const horizontal = (target[2] - target[0]) / (original[2] - original[0]),
      vertical = (target[3] - target[1]) / (original[3] - original[1]),
      factor =
        g.handle === "move"
          ? 1
          : g.handle === "n" || g.handle === "s"
            ? vertical
            : g.handle === "e" || g.handle === "w"
              ? horizontal
              : Math.min(horizontal, vertical),
      fontSize = Math.max(4, (selection.fontSize || 12) * factor),
      baseline =
        target[1] +
        ((selection.origin?.[1] ??
          original[1] + (selection.fontSize || 12) * 0.85) -
          original[1]) *
          (g.handle === "move" ? 1 : factor);
    op = {
      type: "replaceText",
      page: state.page,
      id: selection.id,
      rect: original,
      targetRect: target,
      text: selection.text,
      fontSize,
      font: selection.font,
      color: selection.color,
      baseline,
      replaceImagePixels: Boolean(selection.invisible),
      clip: false,
      wrap: false,
    };
  }
  const successful = await mutate(
    op,
    g.handle === "move"
      ? "Moving selected content…"
      : "Resizing selected content…",
  );
  if (successful) {
    let next;
    if (selection.kind === "annotation")
      next = state.render.annotations.find(
        (item) => String(item.id) === String(selection.id),
      );
    else {
      const items =
        selection.kind === "image"
          ? state.render.imageBlocks
          : state.render.textBlocks;
      next = (items || [])
        .filter(
          (item) => selection.kind !== "text" || item.text === selection.text,
        )
        .sort(
          (a, b) => rectDistance(a.rect, target) - rectDistance(b.rect, target),
        )[0];
    }
    if (next) {
      state.selection = { ...next, kind: selection.kind };
      renderInspector();
      renderOverlay();
    }
  } else {
    state.selection = selection;
    renderInspector();
    renderOverlay();
  }
  $("#tool-hint").textContent =
    hints[state.tool] || "Select content to move or resize it.";
}
function rectDistance(a, b) {
  a = normalRect(a);
  b = normalRect(b);
  return a.reduce((sum, value, index) => sum + Math.abs(value - b[index]), 0);
}
$("#page-overlay").addEventListener("pointerdown", (event) => {
  if (state.busy || !state.render || event.target.closest("[data-widget]"))
    return;
  const handle = event.target.closest("[data-resize],[data-transform]");
  if (
    handle &&
    startTransform(event, state.selection, handle.dataset.resize || "move")
  )
    return;
  const textHit = event.target.closest("[data-text]"),
    annotationHit = event.target.closest("[data-annotation]"),
    linkHit = event.target.closest("[data-link]"),
    imageHit = event.target.closest("[data-image]");
  if (state.tool === "editImages") {
    if (imageHit)
      startTransform(event, {
        ...state.render.imageBlocks[Number(imageHit.dataset.image)],
        kind: "image",
      });
    return;
  }
  if (state.tool === "replaceText" && textHit) {
    startTransform(event, {
      ...state.render.textBlocks[Number(textHit.dataset.text)],
      kind: "text",
    });
    $("#inspector").hidden = false;
    return;
  }
  if (state.tool === "select") {
    if (annotationHit) {
      const annotation = state.render.annotations.find(
        (item) => String(item.id) === annotationHit.dataset.annotation,
      );
      startTransform(event, { ...annotation, kind: "annotation" });
    } else if (textHit)
      startTransform(event, {
        ...state.render.textBlocks[Number(textHit.dataset.text)],
        kind: "text",
      });
    else if (imageHit)
      startTransform(event, {
        ...state.render.imageBlocks[Number(imageHit.dataset.image)],
        kind: "image",
      });
    else if (linkHit) {
      const link = state.render.links.find(
        (item) => String(item.id) === linkHit.dataset.link,
      );
      state.selection = { ...link, kind: "link" };
      $("#inspector").hidden = false;
      renderInspector();
      renderOverlay();
    } else {
      state.selection = null;
      renderInspector();
      renderOverlay();
    }
    return;
  }
  if (state.tool === "form" || state.tool === "replaceText") return;
  const start = eventPoint(event);
  gesture = { start, end: start, points: [start], tool: state.tool };
  $("#page-overlay").setPointerCapture(event.pointerId);
  event.preventDefault();
});
$("#page-overlay").addEventListener("dblclick", (event) => {
  const text = event.target.closest("[data-text]");
  if (text && state.tool === "select") selectText(Number(text.dataset.text));
});
$("#page-overlay").addEventListener("keydown", (event) => {
  if (event.key !== "Enter" && event.key !== " ") return;
  const target = event.target.closest(
    "[data-text],[data-image],[data-annotation],[data-link]",
  );
  if (!target) return;
  event.preventDefault();
  event.stopPropagation();
  if (target.dataset.text !== undefined) {
    selectText(Number(target.dataset.text));
    return;
  }
  if (target.dataset.image !== undefined)
    state.selection = {
      ...state.render.imageBlocks[Number(target.dataset.image)],
      kind: "image",
    };
  if (target.dataset.annotation !== undefined)
    state.selection = {
      ...state.render.annotations.find(
        (item) => String(item.id) === target.dataset.annotation,
      ),
      kind: "annotation",
    };
  if (target.dataset.link !== undefined)
    state.selection = {
      ...state.render.links.find(
        (item) => String(item.id) === target.dataset.link,
      ),
      kind: "link",
    };
  $("#inspector").hidden = false;
  renderInspector();
  renderOverlay();
});
function selectText(index) {
  const block = state.render.textBlocks[index];
  if (!block) return;
  state.selection = { ...block, kind: "text", index };
  $("#inspector").hidden = false;
  renderInspector();
  renderOverlay();
  $("#replacement-text")?.focus();
}
$("#page-overlay").addEventListener("pointermove", (event) => {
  if (transformGesture) {
    moveTransform(event);
    return;
  }
  if (!gesture) return;
  gesture.end = eventPoint(event);
  gesture.points.push(gesture.end);
  let preview;
  if (gesture.tool === "ink")
    preview = `<polyline class="gesture-preview" points="${gesture.points.map((p) => p.join(",")).join(" ")}" style="fill:none;stroke:${state.options.color};stroke-width:${state.options.strokeWidth}"/>`;
  else if (gesture.tool === "arrow")
    preview = `<path class="gesture-preview" d="M${gesture.start.join(" ")} L${gesture.end.join(" ")}" style="fill:none"/>`;
  else
    preview = svgRect(
      gestureRect(),
      `class="gesture-preview" ${gesture.tool === "redact" ? 'style="fill:#30293585;stroke:#302935"' : ""}`,
    );
  $("#gesture-preview")?.remove();
  $("#page-overlay").insertAdjacentHTML(
    "beforeend",
    `<g id="gesture-preview">${preview}</g>`,
  );
});
function gestureRect() {
  return [
    Math.min(gesture.start[0], gesture.end[0]),
    Math.min(gesture.start[1], gesture.end[1]),
    Math.max(gesture.start[0], gesture.end[0]),
    Math.max(gesture.start[1], gesture.end[1]),
  ];
}
$("#page-overlay").addEventListener("pointerup", async (event) => {
  if (transformGesture) {
    const selected = transformGesture;
    transformGesture = null;
    try {
      $("#page-overlay").releasePointerCapture(event.pointerId);
    } catch {}
    $("#transform-preview")?.remove();
    await commitTransform(selected);
    return;
  }
  if (!gesture) return;
  const current = gesture,
    rect = gestureRect(),
    point = current.start;
  gesture = null;
  $("#gesture-preview")?.remove();
  try {
    $("#page-overlay").releasePointerCapture(event.pointerId);
  } catch {}
  const click = rect[2] - rect[0] < 4 && rect[3] - rect[1] < 4;
  let targetRect = click
    ? [
        point[0],
        point[1],
        point[0] + 180,
        point[1] + Math.max(28, state.options.fontSize * 1.6),
      ]
    : rect;
  if (current.tool === "crop") {
    if (click) return;
    const response = await modal(
      "Crop this page",
      `<p>Keep the selected ${Math.round(rect[2] - rect[0])} × ${Math.round(rect[3] - rect[1])} pt area on page ${state.page + 1}.</p><p class="modal-note">Cropping hides content outside this area. For permanent removal, use redaction.</p>`,
      [{ label: "Crop page", value: "submit", primary: true }],
    );
    if (response === "submit")
      await mutate(
        { type: "crop", page: state.page, rect },
        "Cropping this page…",
      );
    return;
  }
  if (current.tool === "link") {
    const response = await modal(
      "Add a link",
      `<p>The selected area will open this address.</p>${inspectorField("Web address", "link-uri", "url", "https://", "required")}`,
      [{ label: "Add link", value: "submit", primary: true }],
    );
    if (response === "submit") {
      const uri = $("#link-uri").value;
      if (!/^https?:\/\//i.test(uri)) {
        toast("Enter a full https:// or http:// web address.", true);
        return;
      }
      await mutate({ type: "link", page: state.page, rect: targetRect, uri });
    }
    return;
  }
  if (current.tool === "image" || current.tool === "signature") {
    const bytes =
      current.tool === "image" ? state.pendingImage : state.pendingSignature;
    if (!bytes) {
      toast("Choose an image or signature first.", true);
      return;
    }
    if (click) targetRect = [point[0], point[1], point[0] + 160, point[1] + 75];
    await mutate({
      type: current.tool,
      page: state.page,
      rect: targetRect,
      bytes,
    });
    return;
  }
  if (current.tool === "ink") {
    if (current.points.length < 2) return;
    await mutate({
      type: "ink",
      page: state.page,
      points: current.points,
      color: state.options.color,
      width: state.options.strokeWidth,
      strokeWidth: state.options.strokeWidth,
      opacity: 1,
    });
    return;
  }
  if (current.tool === "arrow") {
    if (click) return;
    await mutate({
      type: "arrow",
      page: state.page,
      rect,
      points: [current.start, current.end],
      color: state.options.color,
      width: state.options.strokeWidth,
      strokeWidth: state.options.strokeWidth,
    });
    return;
  }
  let text =
    current.tool === "stamp" ? state.options.stamp : state.options.text;
  if (["text", "note"].includes(current.tool) && !text.trim()) {
    const response = await modal(
      current.tool === "note" ? "Leave a note" : "Add text",
      `<label class="field"><span>${current.tool === "note" ? "Note" : "Text"}</span><textarea id="new-mark-text" autofocus required></textarea></label>`,
      [
        {
          label: current.tool === "note" ? "Add note" : "Add text",
          value: "submit",
          primary: true,
        },
      ],
    );
    if (response !== "submit") return;
    text = $("#new-mark-text").value;
    if (!text.trim()) return;
  }
  if (
    ["highlight", "underline", "strikeout", "redact"].includes(current.tool) &&
    click
  ) {
    toast("Drag across the content you want to mark.");
    return;
  }
  const op = {
    type: current.tool,
    page: state.page,
    rect: targetRect,
    text,
    fontSize: state.options.fontSize,
    color: state.options.color,
    opacity: ["highlight", "rectangle", "ellipse"].includes(current.tool)
      ? state.options.opacity
      : 1,
    width: state.options.strokeWidth,
    strokeWidth: state.options.strokeWidth,
  };
  if (["highlight", "underline", "strikeout"].includes(current.tool)) {
    const blocks = state.render.textBlocks.filter((block) => {
      const r = normalRect(block.rect);
      return (
        r[0] < rect[2] && r[2] > rect[0] && r[1] < rect[3] && r[3] > rect[1]
      );
    });
    if (blocks.length)
      op.rects = blocks.map((block) => {
        const r = normalRect(block.rect);
        return [Math.max(r[0], rect[0]), r[1], Math.min(r[2], rect[2]), r[3]];
      });
  }
  if (
    await mutate(
      op,
      current.tool === "redact"
        ? "Marking content for redaction…"
        : "Adding your mark…",
    )
  ) {
    if (current.tool === "redact")
      toast(
        "Redaction marked. Apply redactions to permanently remove the covered content.",
      );
  }
});
$("#page-overlay").addEventListener("pointercancel", () => {
  gesture = null;
  transformGesture = null;
  $("#gesture-preview")?.remove();
  $("#transform-preview")?.remove();
  renderOverlay();
});
$("#page-overlay").addEventListener("change", async (event) => {
  const field = event.target.closest("[data-widget]");
  if (!field) return;
  const value =
    field.type === "checkbox" || field.type === "radio"
      ? field.checked
        ? field.dataset.exportValue || "Yes"
        : "Off"
      : field.value;
  const operation = {
    type: "formValue",
    page: state.page,
    id: field.dataset.widget,
    value,
  };
  formSavePromise = formSavePromise
    .catch(() => {})
    .then(async () => {
      await waitUntilIdle();
      formCommitActive = true;
      try {
        await mutate(operation, "Saving form value…", true);
      } finally {
        formCommitActive = false;
      }
    });
  try {
    await formSavePromise;
  } catch (error) {
    toast(error.message, true);
  }
});

function parsePages(value) {
  const result = new Set();
  for (const part of value.split(",")) {
    const match = part.trim().match(/^(\d+)(?:\s*-\s*(\d+))?$/);
    if (!match)
      throw new Error("Use page numbers such as 1, 3–5 (with a regular dash).");
    const first = Number(match[1]),
      last = Number(match[2] || match[1]);
    if (first < 1 || last > countPages() || last < first)
      throw new Error(`Page numbers must be between 1 and ${countPages()}.`);
    for (let page = first; page <= last; page++) result.add(page - 1);
  }
  if (!result.size) throw new Error("Choose at least one page.");
  return [...result];
}
async function insertPageDialog() {
  const response = await modal(
    "Insert a blank page",
    `<div class="field-row"><label class="field"><span>Size</span><select id="blank-size"><option value="a4">A4 · 595 × 842 pt</option><option value="letter">US Letter · 612 × 792 pt</option><option value="custom">Custom</option></select></label>${inspectorField("Insert before page", "blank-at", "number", state.page + 2, `min="1" max="${countPages() + 1}"`)}</div><div class="field-row">${inspectorField("Width (pt)", "blank-width", "number", 595, 'min="72" max="14400"')}${inspectorField("Height (pt)", "blank-height", "number", 842, 'min="72" max="14400"')}</div>`,
    [{ label: "Insert page", value: "submit", primary: true }],
    () =>
      $("#blank-size").addEventListener("change", () => {
        const size = $("#blank-size").value;
        if (size !== "custom") {
          const dimensions = size === "a4" ? [595, 842] : [612, 792];
          $("#blank-width").value = dimensions[0];
          $("#blank-height").value = dimensions[1];
        }
      }),
  );
  if (response === "submit") {
    const at = Math.max(
      0,
      Math.min(countPages(), Number($("#blank-at").value) - 1),
    );
    await mutate(
      {
        type: "blankPage",
        at,
        width: Number($("#blank-width").value),
        height: Number($("#blank-height").value),
      },
      "Adding a blank page…",
    );
    state.page = at;
    await renderPage(true);
  }
}
async function deletePagesDialog(pages = [state.page]) {
  const response = await modal(
    "Delete pages",
    `<p>Choose the pages to remove. You can undo this while the document is open.</p>${inspectorField("Pages", "delete-page-range", "text", pages.map((page) => page + 1).join(", "), "required")}<p class="modal-note">Examples: 1, 3-5. Keep at least one page in the document.</p>`,
    [{ label: "Delete pages", value: "submit", danger: true }],
  );
  if (response === "submit")
    try {
      const selected = parsePages($("#delete-page-range").value);
      if (selected.length >= countPages())
        throw new Error("Keep at least one page in the document.");
      await mutate({ type: "deletePages", pages: selected }, "Removing pages…");
    } catch (error) {
      toast(error.message, true);
    }
}
async function extractDialog() {
  const response = await modal(
    "Extract pages",
    `<p>Save selected pages as a new PDF.</p>${inspectorField("Pages", "extract-page-range", "text", state.page + 1, "required")}${inspectorField("Filename", "extract-name", "text", `${fileStem()}-pages.pdf`, "required")}<p class="modal-note">Use 1, 3-5 to choose several pages. Your current document stays open.</p>`,
    [{ label: "Extract PDF", value: "submit", primary: true }],
  );
  if (response === "submit")
    try {
      setBusy(true, "Extracting pages…");
      const bytes = await rpc(
        "extract",
        parsePages($("#extract-page-range").value),
      );
      download(bytes, $("#extract-name").value);
      toast("Extracted pages downloaded.");
    } catch (error) {
      toast(error.message, true);
    } finally {
      setBusy(false);
    }
}
async function redactDialog() {
  const response = await modal(
    "Apply permanent redactions",
    `<div class="warning-box">This removes the text, images and other content beneath every marked redaction. The downloaded PDF will no longer contain that content.</div><p style="margin-top:18px">Document metadata, embedded files and active actions are also removed. Form fields, comments and links inside marked areas are deleted.</p><p>Review the marks first. Other copies of the original PDF are unaffected.</p><label class="check-field"><input id="redaction-confirm" type="checkbox" required><span>I reviewed the marks and want to permanently remove the covered content.</span></label>`,
    [{ label: "Apply redactions", value: "submit", danger: true }],
  );
  if (response === "submit" && $("#redaction-confirm").checked) {
    if (
      await mutate(
        { type: "applyRedactions", all: true },
        "Removing redacted content…",
      )
    ) {
      setTool("select");
      toast(
        "Redactions applied. Save a copy to download the protected document.",
      );
    }
  }
}
async function exportDialog(passwordFocus = false) {
  if (document.activeElement?.matches(".pdf-form-field"))
    document.activeElement.blur();
  try {
    await formSavePromise;
  } catch (error) {
    toast(`The last form value could not be saved: ${error.message}`, true);
    return;
  }
  const response = await modal(
    "Save a copy",
    `${inspectorField("Filename", "export-name", "text", state.name, "required")}<label class="check-field"><input id="export-compress" type="checkbox" checked><span>Compress PDF streams and remove unused objects</span></label><label class="check-field"><input id="export-flatten" type="checkbox"><span>Flatten annotations and filled form fields into the pages</span></label><label class="check-field"><input id="export-metadata" type="checkbox"><span>Remove document metadata</span></label>${state.info?.encrypted ? '<label class="check-field"><input id="export-keep-password" type="checkbox" checked><span>Keep the existing document password when no new password is entered</span></label>' : ""}${inspectorField(state.info?.encrypted ? "New password (optional)" : "Password (optional)", "export-password", "password", "", 'autocomplete="new-password"')}<p class="modal-note">Your PDF is generated on this device. Flattening makes marks part of the page. Compression savings depend on the original file.</p>`,
    [{ label: "Download PDF", value: "submit", primary: true }],
    () => {
      if (passwordFocus) $("#export-password").focus();
    },
  );
  if (response === "submit")
    try {
      setBusy(true, "Preparing your PDF…");
      const password = $("#export-password").value,
        preserveEncryption = Boolean($("#export-keep-password")?.checked);
      const options = {
        compress: $("#export-compress").checked,
        flatten: $("#export-flatten").checked,
        clearMetadata: $("#export-metadata").checked,
        preserveEncryption,
      };
      if (password || !preserveEncryption) options.password = password;
      const bytes = await rpc("save", options);
      let name = $("#export-name").value.trim() || state.name;
      if (!/\.pdf$/i.test(name)) name += ".pdf";
      download(bytes, name);
      toast("Your PDF copy has been downloaded.");
    } catch (error) {
      toast(error.message, true);
    } finally {
      setBusy(false);
    }
}
async function exportPNG() {
  try {
    setBusy(true, "Exporting page image…");
    const result = await rpc("render", state.page, 2);
    download(
      result.png,
      `${fileStem()}-page-${state.page + 1}.png`,
      "image/png",
    );
    toast("Page image downloaded at 144 DPI.");
  } catch (error) {
    toast(error.message, true);
  } finally {
    setBusy(false);
  }
}
async function exportText() {
  try {
    setBusy(true, "Collecting document text…");
    const parts = [];
    for (let page = 0; page < countPages(); page++) {
      const result = await rpc("render", page, 0.1);
      parts.push(
        `Page ${page + 1}\n${(result.textBlocks || []).map((block) => block.text).join("\n")}`,
      );
    }
    download(
      parts.join("\n\n"),
      `${fileStem()}.txt`,
      "text/plain;charset=utf-8",
    );
    toast(
      "Document text downloaded. Scanned pages need text recognition first.",
    );
  } catch (error) {
    toast(error.message, true);
  } finally {
    setBusy(false);
  }
}
async function printDocument() {
  try {
    setBusy(true, "Preparing to print…");
    const bytes = await rpc("save", { flatten: true, password: "" });
    const url = URL.createObjectURL(
      new Blob([bytes], { type: "application/pdf" }),
    );
    const frame = document.createElement("iframe");
    frame.style.cssText =
      "position:fixed;width:1px;height:1px;left:-100px;bottom:0";
    frame.src = url;
    document.body.append(frame);
    frame.onload = () => {
      setTimeout(() => {
        frame.contentWindow.focus();
        frame.contentWindow.print();
      }, 300);
    };
    setTimeout(() => {
      frame.remove();
      URL.revokeObjectURL(url);
    }, 120000);
    toast("Your browser’s print dialog will open.");
  } catch (error) {
    toast(error.message, true);
  } finally {
    setBusy(false);
  }
}
async function watermarkDialog() {
  const response = await modal(
    "Add a watermark",
    `${inspectorField("Wording", "watermark-text", "text", "DRAFT", "required")}<div class="field-row">${inspectorField("Font size (pt)", "watermark-size", "number", 48, 'min="8" max="200"')}${inspectorField("Angle (degrees)", "watermark-angle", "number", -35, 'min="-180" max="180"')}</div><div class="field-row">${inspectorField("Colour", "watermark-color", "color", "#7356b2")}${inspectorField("Opacity", "watermark-opacity", "number", 0.2, 'min="0.05" max="1" step="0.05"')}</div>${inspectorField("Pages", "watermark-pages", "text", `1-${countPages()}`)}`,
    [{ label: "Add watermark", value: "submit", primary: true }],
  );
  if (response === "submit")
    try {
      await mutate(
        {
          type: "watermark",
          text: $("#watermark-text").value,
          fontSize: Number($("#watermark-size").value),
          angle: Number($("#watermark-angle").value),
          color: $("#watermark-color").value,
          opacity: Number($("#watermark-opacity").value),
          pages: parsePages($("#watermark-pages").value),
        },
        "Adding watermark…",
      );
    } catch (error) {
      toast(error.message, true);
    }
}
async function pageNumbersDialog() {
  const response = await modal(
    "Add page numbers",
    `<div class="field-row">${inspectorField("Start at", "numbers-start", "number", 1, 'min="0" max="999999"')}<label class="field"><span>Position</span><select id="numbers-position"><option value="bottom-center">Bottom centre</option><option value="bottom-right">Bottom right</option><option value="bottom-left">Bottom left</option><option value="top-center">Top centre</option><option value="top-right">Top right</option><option value="top-left">Top left</option></select></label></div><div class="field-row">${inspectorField("Prefix", "numbers-prefix", "text", "")}${inspectorField("Suffix", "numbers-suffix", "text", "")}</div><div class="field-row">${inspectorField("Size (pt)", "numbers-size", "number", 11, 'min="4" max="80"')}${inspectorField("Colour", "numbers-color", "color", "#77767c")}</div>${inspectorField("Pages", "numbers-pages", "text", `1-${countPages()}`)}`,
    [{ label: "Add numbers", value: "submit", primary: true }],
  );
  if (response === "submit")
    try {
      await mutate(
        {
          type: "pageNumbers",
          pages: parsePages($("#numbers-pages").value),
          start: Number($("#numbers-start").value),
          position: $("#numbers-position").value,
          fontSize: Number($("#numbers-size").value),
          color: $("#numbers-color").value,
          prefix: $("#numbers-prefix").value,
          suffix: $("#numbers-suffix").value,
        },
        "Numbering pages…",
      );
    } catch (error) {
      toast(error.message, true);
    }
}
async function metadataDialog() {
  const metadata = state.info?.metadata || {};
  const response = await modal(
    "Document details",
    `${inspectorField("Title", "metadata-title", "text", metadata.title || "")}${inspectorField("Author", "metadata-author", "text", metadata.author || "")}${inspectorField("Subject", "metadata-subject", "text", metadata.subject || "")}${inspectorField("Keywords", "metadata-keywords", "text", metadata.keywords || "")}`,
    [{ label: "Save details", value: "submit", primary: true }],
  );
  if (response === "submit")
    await mutate(
      {
        type: "metadata",
        metadata: {
          title: $("#metadata-title").value,
          author: $("#metadata-author").value,
          subject: $("#metadata-subject").value,
          keywords: $("#metadata-keywords").value,
        },
      },
      "Updating document details…",
    );
}
async function ocrDialog() {
  const response = await modal(
    "Recognise text on this page",
    `<p>Recognise English text in the image on page ${state.page + 1}. The result becomes a searchable text layer in the PDF.</p><p class="modal-note">Recognition runs locally. The first use loads the included recognition engine and English language model. Review recognised text for mistakes before relying on it.</p>`,
    [{ label: "Recognise page", value: "submit", primary: true }],
  );
  if (response !== "submit") return;
  try {
    setBusy(true, "Preparing text recognition…");
    const rendered = await rpc("render", state.page, 2);
    const result = await recognize(
      rendered.png,
      rendered.bounds,
      (progress) => {
        $("#working-label").textContent =
          `${progress.status || "Recognising text"} ${Math.round((progress.progress || 0) * 100)}%`;
      },
    );
    setBusy(false);
    if (!result.lines.length) {
      toast("No readable text was found on this page.");
      return;
    }
    if (
      await mutate(
        { type: "ocr", page: state.page, lines: result.lines },
        "Adding searchable text…",
      )
    )
      toast(
        `Recognised ${result.lines.length} lines. Review the text for recognition errors.`,
      );
  } catch (error) {
    toast(error.message, true, 8000);
  } finally {
    setBusy(false);
  }
}

async function signatureDialog() {
  let signatureMode = "draw",
    imageBytes = null,
    drawn = false;
  const response = await modal(
    "Add your signature",
    `<div class="modal-tabs"><button type="button" data-signature-tab="draw" class="active">Draw</button><button type="button" data-signature-tab="type">Type</button><button type="button" data-signature-tab="import">Import image</button></div><div id="signature-draw"><canvas id="signature-canvas" class="signature-canvas" width="900" height="320" aria-label="Draw your signature"></canvas><button type="button" class="text-button" id="signature-clear" style="margin-top:10px">Clear signature</button></div><div id="signature-type" hidden>${inspectorField("Your name", "signature-name", "text", "", 'placeholder="Type your name"')}<canvas id="signature-typed-preview" class="signature-canvas" width="900" height="250"></canvas></div><div id="signature-import" hidden><label class="field"><span>Choose a signature image</span><input id="signature-file" type="file" accept="image/*"></label><img id="signature-image-preview" class="signature-preview" alt="Imported signature preview" hidden></div><p style="margin-top:16px;font-size:10px">Your signature is added as a visible image. This is not a certificate based digital signature.</p>`,
    [{ label: "Use signature", value: "submit", primary: true }],
    () => {
      const canvas = $("#signature-canvas"),
        ctx = canvas.getContext("2d");
      ctx.strokeStyle = "#26262c";
      ctx.lineWidth = 4;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      let drawing = false;
      const point = (event) => {
        const r = canvas.getBoundingClientRect();
        return [
          ((event.clientX - r.left) * canvas.width) / r.width,
          ((event.clientY - r.top) * canvas.height) / r.height,
        ];
      };
      canvas.addEventListener("pointerdown", (event) => {
        drawing = true;
        canvas.setPointerCapture(event.pointerId);
        ctx.beginPath();
        ctx.moveTo(...point(event));
        event.preventDefault();
      });
      canvas.addEventListener("pointermove", (event) => {
        if (!drawing) return;
        ctx.lineTo(...point(event));
        ctx.stroke();
        drawn = true;
      });
      canvas.addEventListener("pointerup", () => (drawing = false));
      canvas.addEventListener("pointercancel", () => (drawing = false));
      $("#signature-clear").addEventListener("click", () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        drawn = false;
      });
      $$("[data-signature-tab]").forEach((button) =>
        button.addEventListener("click", () => {
          signatureMode = button.dataset.signatureTab;
          $$("[data-signature-tab]").forEach((tab) =>
            tab.classList.toggle("active", tab === button),
          );
          for (const name of ["draw", "type", "import"])
            $(`#signature-${name}`).hidden = name !== signatureMode;
        }),
      );
      $("#signature-name").addEventListener("input", () => {
        const preview = $("#signature-typed-preview"),
          context = preview.getContext("2d");
        context.clearRect(0, 0, preview.width, preview.height);
        context.font = "italic 100px Georgia, serif";
        context.fillStyle = "#26262c";
        const text = $("#signature-name").value;
        const width = context.measureText(text).width;
        const scale = Math.min(1, 820 / Math.max(1, width));
        context.save();
        context.translate(30, 150);
        context.scale(scale, scale);
        context.fillText(text, 0, 0);
        context.restore();
      });
      $("#signature-file").addEventListener("change", async (event) => {
        const file = event.target.files[0];
        if (!file) return;
        imageBytes = await normaliseImage(file);
        $("#signature-image-preview").src = URL.createObjectURL(
          new Blob([imageBytes], { type: "image/png" }),
        );
        $("#signature-image-preview").hidden = false;
      });
    },
  );
  if (response !== "submit") return;
  let bytes;
  if (signatureMode === "draw") {
    if (!drawn) {
      toast("Draw your signature first.");
      return;
    }
    bytes = await canvasBytes($("#signature-canvas"));
  } else if (signatureMode === "type") {
    if (!$("#signature-name").value.trim()) {
      toast("Type your name first.");
      return;
    }
    bytes = await canvasBytes($("#signature-typed-preview"));
  } else {
    if (!imageBytes) {
      toast("Choose a signature image first.");
      return;
    }
    bytes = imageBytes;
  }
  state.pendingSignature = bytes;
  setTool("signature");
  $("#inspector").hidden = false;
  toast("Drag on the page to place your signature.");
}
function canvasBytes(canvas) {
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      async (blob) =>
        blob
          ? resolve(new Uint8Array(await blob.arrayBuffer()))
          : reject(new Error("The signature image could not be created.")),
      "image/png",
    ),
  );
}
async function normaliseImage(file) {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  const ratio = Math.min(1, 4096 / Math.max(bitmap.width, bitmap.height));
  canvas.width = Math.round(bitmap.width * ratio);
  canvas.height = Math.round(bitmap.height * ratio);
  canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvasBytes(canvas);
}
async function pageMenu(page) {
  const response = await modal(
    `Page ${page + 1}`,
    `<div class="page-grid-options"><button type="button" data-page-action="rotate">↻ Rotate right</button><button type="button" data-page-action="duplicate">▣ Duplicate</button><button type="button" data-page-action="before">← Move earlier</button><button type="button" data-page-action="after">→ Move later</button><button type="button" data-page-action="extract">↗ Extract PDF</button><button type="button" class="danger" data-page-action="delete">× Delete page</button></div>`,
    [],
    () =>
      $$("[data-page-action]").forEach((button) =>
        button.addEventListener("click", () =>
          $("#modal").close(button.dataset.pageAction),
        ),
      ),
  );
  if (response === "rotate")
    await mutate({ type: "rotate", pages: [page], degrees: 90 });
  if (response === "duplicate")
    await mutate({ type: "duplicatePages", pages: [page], at: page + 1 });
  if (response === "delete") await deletePagesDialog([page]);
  if (response === "extract") {
    state.page = page;
    await extractDialog();
  }
  if (response === "before" || response === "after") {
    const target = page + (response === "before" ? -1 : 1);
    if (target < 0 || target >= countPages()) {
      toast("This page is already at the end of that direction.");
      return;
    }
    const order = Array.from({ length: countPages() }, (_, index) => index);
    [order[page], order[target]] = [order[target], order[page]];
    state.page = target;
    await mutate({ type: "reorderPages", order });
  }
}

async function privacyDialog() {
  await modal(
    "Your files, on your device",
    `<p>PDF editing, text recognition and export run in this browser. The editor does not upload your documents to a server.</p><p>When you edit, a recovery draft is saved in this browser’s local database. Anyone using the same browser profile may be able to restore it. You can clear that draft in the Document panel.</p><p>The site downloads its PDF and recognition libraries when needed. Browser storage can be cleared by your browser; download a copy for a lasting backup.</p><p>The editor uses MuPDF under the AGPL license. <a class="quiet-link" style="margin-top:0;color:#7356b2" href="/assets/pdf-editor/SOURCES.md" target="_blank" rel="noopener">Read the source and license ↗</a></p>`,
    [{ label: "Got it", value: "submit", primary: true }],
  );
}
async function helpDialog() {
  await modal(
    "A little help",
    `<p>Pick a tab to edit text, annotate, organise pages or fill a form. In Read mode, drag text, images or annotations to move them. The eight handles resize the selected content. Hold Shift while resizing to keep its proportions.</p><p>Click selected text to edit its contents in the inspector. You can also double click a line, or choose Edit text. Bookmarks, thumbnails and Find help you move around longer documents.</p><div class="shortcut-grid"><span>Open PDF</span><kbd>⌘ / Ctrl O</kbd><span>Save a copy</span><kbd>⌘ / Ctrl S</kbd><span>Find in document</span><kbd>⌘ / Ctrl F</kbd><span>Undo</span><kbd>⌘ / Ctrl Z</kbd><span>Redo</span><kbd>⇧ ⌘ / Ctrl Z</kbd><span>Nudge selected content by 1 pt</span><kbd>Arrow keys</kbd><span>Nudge selected content by 10 pt</span><kbd>Shift + arrows</kbd><span>Previous / next page (no selection)</span><kbd>← / →</kbd><span>Return to select tool</span><kbd>Esc</kbd><span>Delete selected mark</span><kbd>Delete</kbd></div><p style="margin-top:23px">Text editing replaces complete lines. It may use a different embedded font. For scanned pages, use Recognise text. Review edited and redacted PDFs before sharing.</p><button type="button" id="help-privacy" class="text-button">How your files are handled ↗</button>`,
    [{ label: "Back to document", value: "submit", primary: true }],
    () =>
      $("#help-privacy").addEventListener("click", () => {
        $("#modal").close();
        privacyDialog();
      }),
  );
}

$("#open-button").addEventListener("click", () => $("#file-input").click());
$("#dropzone").addEventListener("click", () => $("#file-input").click());
$("#dropzone").addEventListener("keydown", (event) => {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    $("#file-input").click();
  }
});
$("#file-input").addEventListener("change", (event) => {
  openFiles(event.target.files);
  event.target.value = "";
});
$("#dropzone").addEventListener("dragover", (event) => {
  event.preventDefault();
  $("#dropzone").classList.add("drag-over");
});
$("#dropzone").addEventListener("dragleave", () =>
  $("#dropzone").classList.remove("drag-over"),
);
$("#dropzone").addEventListener("drop", (event) => {
  event.preventDefault();
  $("#dropzone").classList.remove("drag-over");
  openFiles(event.dataTransfer.files);
});
$("#workspace").addEventListener("dragover", (event) => event.preventDefault());
$("#workspace").addEventListener("drop", (event) => {
  if (event.dataTransfer.files.length) {
    event.preventDefault();
    openFiles(event.dataTransfer.files);
  }
});
$("#sample-button").addEventListener("click", async () => {
  try {
    $("#sample-button").disabled = true;
    const response = await fetch("/assets/pdf-editor/sample.pdf");
    if (!response.ok)
      throw new Error("The sample document could not be loaded.");
    await openDocument(
      new Uint8Array(await response.arrayBuffer()),
      "Welcome to Cam’s PDF Editor.pdf",
    );
  } catch (error) {
    toast(error.message, true);
  } finally {
    $("#sample-button").disabled = false;
  }
});
$("#blank-button").addEventListener("click", async () => {
  try {
    setBusy(true, "Creating a fresh document…");
    state.info = await rpc("create", 595, 842);
    state.name = "Untitled.pdf";
    state.page = 0;
    state.dirty = false;
    state.history = 0;
    state.redo = 0;
    state.revision++;
    showEditor();
    setMode("Edit");
    await renderPage(true);
    renderThumbnails();
  } catch (error) {
    toast(error.message, true);
  } finally {
    setBusy(false);
  }
});
$("#save-button").addEventListener("click", () => exportDialog());
$("#help-button").addEventListener("click", helpDialog);
$("#privacy-button").addEventListener("click", privacyDialog);
$("#modebar").addEventListener("click", (event) => {
  const button = event.target.closest("[data-mode]");
  if (button) setMode(button.dataset.mode);
});
$("#tool-buttons").addEventListener("click", (event) => {
  const button = event.target.closest("[data-tool]");
  if (button) activateTool(button.dataset.tool);
});
$("#undo-button").addEventListener("click", () => historyAction("undo"));
$("#redo-button").addEventListener("click", () => historyAction("redo"));
$("#previous-page").addEventListener("click", () => navigate(state.page - 1));
$("#next-page").addEventListener("click", () => navigate(state.page + 1));
$("#current-page").addEventListener("change", (event) =>
  navigate(Number(event.target.value) - 1),
);
$("#fit-button").addEventListener("click", () => {
  fitPage();
  setZoom(state.scale);
});
$("#zoom-value").addEventListener("click", () => {
  fitPage();
  setZoom(state.scale);
});
$("#zoom-in").addEventListener("click", () => setZoom(state.scale + 0.15));
$("#zoom-out").addEventListener("click", () => setZoom(state.scale - 0.15));
$("#sidebar-toggle").addEventListener(
  "click",
  () => ($("#sidebar").hidden = !$("#sidebar").hidden),
);
$("#inspector-toggle").addEventListener(
  "click",
  () => ($("#inspector").hidden = !$("#inspector").hidden),
);
$("#inspector-close").addEventListener(
  "click",
  () => ($("#inspector").hidden = true),
);
$("#add-page-button").addEventListener("click", insertPageDialog);
$("#pages-view-button").addEventListener("click", showThumbnails);
$("#search-view-button").addEventListener("click", showSearch);
$("#search-input").addEventListener("input", (event) => {
  clearTimeout(searchTimer);
  const query = event.target.value;
  searchTimer = setTimeout(() => searchDocument(query), 250);
});
$("#search-results").addEventListener("click", (event) => {
  const button = event.target.closest("[data-search-match]");
  if (button) navigate(state.matches[Number(button.dataset.searchMatch)].page);
});
$("#bookmarks-view-button")?.addEventListener("click", () =>
  setSidebarView("bookmarks"),
);
$("#bookmarks")?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-bookmark-page]");
  if (button)
    navigateLink(
      button.dataset.bookmarkUri,
      Number(button.dataset.bookmarkPage),
    );
});
$("#image-input").addEventListener("change", async (event) => {
  const file = event.target.files[0];
  if (!file) return;
  try {
    const bytes = await normaliseImage(file);
    if (state.pendingImageReplacement) {
      const pending = state.pendingImageReplacement;
      state.pendingImageReplacement = null;
      await mutate(
        {
          type: "replaceImage",
          page: pending.page,
          id: pending.id,
          rect: pending.rect,
          targetRect: pending.targetRect,
          bytes,
        },
        "Replacing image…",
      );
    } else {
      state.pendingImage = bytes;
      setTool("image");
      $("#inspector").hidden = false;
      toast("Drag on the page to place your image.");
    }
  } catch (error) {
    toast(error.message, true);
  }
  event.target.value = "";
});
$("#merge-input").addEventListener("change", async (event) => {
  for (const file of event.target.files) await mergeFile(file);
  event.target.value = "";
});
$("#image-input").addEventListener(
  "cancel",
  () => (state.pendingImageReplacement = null),
);
$("#thumbnails").addEventListener("click", (event) => {
  const menu = event.target.closest("[data-page-menu]");
  if (menu) {
    pageMenu(Number(menu.dataset.pageMenu));
    return;
  }
  const navigateButton = event.target.closest("[data-navigate]");
  if (navigateButton) navigate(Number(navigateButton.dataset.navigate));
});
let draggedPage = null;
$("#thumbnails").addEventListener("dragstart", (event) => {
  const thumbnail = event.target.closest("[data-page]");
  if (!thumbnail) return;
  draggedPage = Number(thumbnail.dataset.page);
  event.dataTransfer.setData("text/plain", String(draggedPage));
  event.dataTransfer.effectAllowed = "move";
  thumbnail.classList.add("dragging");
});
$("#thumbnails").addEventListener("dragover", (event) => {
  const thumbnail = event.target.closest("[data-page]");
  if (!thumbnail) return;
  event.preventDefault();
  $$(".thumbnail").forEach((el) => el.classList.remove("drop-target"));
  thumbnail.classList.add("drop-target");
});
$("#thumbnails").addEventListener("dragend", () => {
  $$(".thumbnail").forEach((el) =>
    el.classList.remove("dragging", "drop-target"),
  );
  draggedPage = null;
});
$("#thumbnails").addEventListener("drop", async (event) => {
  const target = event.target.closest("[data-page]");
  if (!target || draggedPage === null) return;
  event.preventDefault();
  const at = Number(target.dataset.page),
    order = Array.from({ length: countPages() }, (_, index) => index),
    [page] = order.splice(draggedPage, 1);
  order.splice(at, 0, page);
  state.page = at;
  draggedPage = null;
  await mutate({ type: "reorderPages", order }, "Reordering pages…");
});
$("#inspector-content").addEventListener("input", (event) => {
  const id = event.target.id,
    value = event.target.value;
  if (id === "option-text")
    state.options[state.tool === "stamp" ? "stamp" : "text"] = value;
  if (id === "option-color") state.options.color = value;
  if (id === "option-font-size") state.options.fontSize = Number(value);
  if (id === "option-opacity") state.options.opacity = Number(value);
  if (id === "option-stroke-width") state.options.strokeWidth = Number(value);
});
$("#inspector-content").addEventListener("click", async (event) => {
  const target = event.target.closest("button");
  if (!target) return;
  if (target.dataset.color) {
    state.options.color = target.dataset.color;
    renderInspector();
    return;
  }
  if (target.dataset.inspectorMode) {
    setMode(target.dataset.inspectorMode);
    return;
  }
  if (target.dataset.inspectorTool) {
    await activateTool(target.dataset.inspectorTool);
    return;
  }
  if (target.id === "apply-text-edit") {
    const selection = state.selection;
    if (!selection) return;
    const rect = normalRect(selection.rect),
      targetRect = [
        rect[0],
        rect[1],
        rect[0] + Number($("#replacement-width").value),
        rect[1] + Number($("#replacement-height").value),
      ];
    if (
      await mutate(
        {
          type: "replaceText",
          page: state.page,
          id: selection.id,
          rect: selection.rect,
          targetRect,
          text: $("#replacement-text").value,
          fontSize: Number($("#replacement-size").value),
          color: $("#replacement-color").value,
          font: selection.font,
          baseline: selection.origin?.[1],
          replaceImagePixels: Boolean($("#replace-scanned-pixels")?.checked),
        },
        "Replacing document text…",
      )
    )
      toast("Text replaced in the document.");
  }
  if (target.id === "replace-existing-image") {
    const left = Number($("#image-left").value),
      top = Number($("#image-top").value),
      width = Number($("#image-width").value),
      height = Number($("#image-height").value);
    if (width <= 0 || height <= 0) {
      toast("Image width and height must be greater than zero.", true);
      return;
    }
    state.pendingImageReplacement = {
      page: state.page,
      id: state.selection.id,
      rect: state.selection.rect,
      targetRect: [left, top, left + width, top + height],
    };
    $("#image-input").click();
  }
  if (target.id === "delete-existing-image")
    await mutate(
      {
        type: "deleteImage",
        page: state.page,
        id: state.selection.id,
        rect: state.selection.rect,
      },
      "Removing image…",
    );
  if (target.id === "update-annotation") {
    await mutate(
      {
        type: "editAnnotation",
        page: state.page,
        id: state.selection.id,
        text: $("#annotation-text").value,
        color: $("#annotation-color").value,
        opacity: Number($("#annotation-opacity").value),
      },
      "Updating annotation…",
    );
  }
  if (target.id === "delete-annotation") {
    await mutate(
      { type: "deleteAnnotation", page: state.page, id: state.selection.id },
      "Removing annotation…",
    );
  }
  if (target.id === "delete-link") {
    await mutate(
      { type: "deleteLink", page: state.page, id: state.selection.id },
      "Removing link…",
    );
  }
  if (target.id === "visit-link") await navigateLink(state.selection.uri || "");
  if (target.id === "choose-another-image") {
    if (state.tool === "signature") signatureDialog();
    else $("#image-input").click();
  }
  if (target.id === "inspector-apply-redactions") redactDialog();
  if (target.id === "inspector-ocr") ocrDialog();
  if (target.id === "clear-draft-button") {
    await clearDraft();
    $("#draft-state").textContent = "Local recovery draft cleared";
    toast("The local recovery draft has been cleared.");
  }
});
document.addEventListener("keydown", (event) => {
  const editing = /INPUT|TEXTAREA|SELECT/.test(event.target.tagName),
    command = event.metaKey || event.ctrlKey;
  if ($("#modal").open) return;
  if (command && event.key.toLowerCase() === "o") {
    event.preventDefault();
    $("#file-input").click();
    return;
  }
  if (!state.info) return;
  if (command && event.key.toLowerCase() === "s") {
    event.preventDefault();
    exportDialog();
    return;
  }
  if (command && event.key.toLowerCase() === "f") {
    event.preventDefault();
    showSearch();
    return;
  }
  if (command && event.key.toLowerCase() === "z" && !editing) {
    event.preventDefault();
    historyAction(event.shiftKey ? "redo" : "undo");
    return;
  }
  if (command && event.key.toLowerCase() === "y" && !editing) {
    event.preventDefault();
    historyAction("redo");
    return;
  }
  if (editing) return;
  if (
    /^Arrow/.test(event.key) &&
    ["text", "image", "annotation"].includes(state.selection?.kind)
  ) {
    event.preventDefault();
    const delta = event.shiftKey ? 10 : 1,
      dx =
        event.key === "ArrowLeft"
          ? -delta
          : event.key === "ArrowRight"
            ? delta
            : 0,
      dy =
        event.key === "ArrowUp"
          ? -delta
          : event.key === "ArrowDown"
            ? delta
            : 0,
      original = normalRect(state.selection.rect);
    commitTransform({
      selection: { ...state.selection },
      original,
      target: original.map((value, index) => value + (index % 2 ? dy : dx)),
      handle: "move",
      moved: true,
    });
    return;
  }
  if (event.key === "ArrowLeft") navigate(state.page - 1);
  if (event.key === "ArrowRight") navigate(state.page + 1);
  if (event.key === "Escape") setTool("select");
  if (
    (event.key === "Delete" || event.key === "Backspace") &&
    state.selection?.kind === "annotation"
  ) {
    event.preventDefault();
    mutate({
      type: "deleteAnnotation",
      page: state.page,
      id: state.selection.id,
    });
  }
});
loadDraft()
  .then((draft) => {
    if (!draft) return;
    $("#restore-button").hidden = false;
    $("#restore-button").addEventListener("click", () =>
      openDocument(draft.bytes, draft.name, "", draft.page || 0),
    );
  })
  .catch(() => {});
window.addEventListener("beforeunload", (event) => {
  if (state.dirty && $("#draft-state").textContent === "Saving local draft…") {
    event.preventDefault();
    event.returnValue = "";
  }
});
renderToolbar();
