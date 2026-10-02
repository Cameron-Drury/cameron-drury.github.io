import * as mupdf from "../vendor/mupdf.js";

// All public coordinates use MuPDF's displayed page coordinates: points, origin
// at the top left. Each content insertion compensates for crop and rotation.
let document = null;
let authenticated = false;
let revision = 0;
let resourcesSerial = 0;
let sessionPassword = "";
let sessionEncrypted = false;
const META = {
  title: "info:Title",
  author: "info:Author",
  subject: "info:Subject",
  keywords: "info:Keywords",
};
const ANNOT_TYPES = {
  highlight: "Highlight",
  underline: "Underline",
  strikeout: "StrikeOut",
  ink: "Ink",
  rectangle: "Square",
  ellipse: "Circle",
  line: "Line",
  arrow: "Line",
  note: "Text",
  stamp: "Stamp",
  redact: "Redact",
  freeText: "FreeText",
};
const SAVE_DEFAULTS = {
  garbage: 4,
  compress: true,
  "compress-images": true,
  "compress-fonts": true,
  clean: true,
  incremental: false,
  encrypt: "none",
};

function requireDocument() {
  if (!document) throw new Error("Open a PDF first.");
  if (!authenticated)
    throw new Error("This PDF needs its password before it can be opened.");
  return document;
}
function byteArray(value) {
  if (value instanceof Uint8Array) return value;
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (ArrayBuffer.isView(value))
    return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  if (Array.isArray(value)) return Uint8Array.from(value);
  throw new Error("PDF or image data must be bytes.");
}
function finite(value, fallback, name = "Value") {
  const number = value === undefined ? fallback : Number(value);
  if (!Number.isFinite(number))
    throw new Error(`${name} must be a finite number.`);
  return number;
}
function index(value, count = requireDocument().countPages()) {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0 || n >= count)
    throw new Error("That page does not exist.");
  return n;
}
function insertion(value, count = requireDocument().countPages()) {
  const n = value === undefined ? count : Number(value);
  if (!Number.isInteger(n) || n < 0 || n > count)
    throw new Error("The insertion position is outside this PDF.");
  return n;
}
function pages(value, fallback) {
  const d = requireDocument();
  const list =
    value === undefined
      ? fallback === undefined
        ? Array.from({ length: d.countPages() }, (_, i) => i)
        : [fallback]
      : value;
  if (!Array.isArray(list) || !list.length)
    throw new Error("Choose at least one page.");
  return [...new Set(list.map((i) => index(i)))];
}
function rect(value) {
  if (
    !Array.isArray(value) ||
    value.length !== 4 ||
    value.some((n) => !Number.isFinite(Number(n)))
  )
    throw new Error("Choose a valid rectangle on the page.");
  const r = value.map(Number);
  const out = [
    Math.min(r[0], r[2]),
    Math.min(r[1], r[3]),
    Math.max(r[0], r[2]),
    Math.max(r[1], r[3]),
  ];
  if (out[2] - out[0] < 0.1 || out[3] - out[1] < 0.1)
    throw new Error("The rectangle is too small.");
  return out;
}
function point(value) {
  if (
    !Array.isArray(value) ||
    value.length !== 2 ||
    value.some((n) => !Number.isFinite(Number(n)))
  )
    throw new Error("A drawing point is invalid.");
  return value.map(Number);
}
function color(value = "#20262b") {
  if (typeof value === "string" && /^#[a-f\d]{6}$/i.test(value))
    return [1, 3, 5].map((i) => parseInt(value.slice(i, i + 2), 16) / 255);
  if (
    Array.isArray(value) &&
    [1, 3, 4].includes(value.length) &&
    value.every((n) => Number.isFinite(n) && n >= 0 && n <= 1)
  )
    return value;
  throw new Error("Use an RGB colour such as #20262b.");
}
function rgb(value) {
  if (value.length === 1) return [value[0], value[0], value[0]];
  if (value.length === 4)
    return value.slice(0, 3).map((n) => 1 - Math.min(1, n + value[3]));
  return value;
}
function opacity(value = 1) {
  return Math.max(0, Math.min(1, finite(value, 1, "Opacity")));
}
function number(value) {
  return Number(value.toFixed(5)).toString();
}
function matrix(value) {
  return value.map(number).join(" ");
}
function hexColor(value) {
  return value.length
    ? "#" +
        rgb(value)
          .map((n) =>
            Math.round(n * 255)
              .toString(16)
              .padStart(2, "0"),
          )
          .join("")
    : "#20262b";
}
function safe(call, fallback = null) {
  try {
    return call();
  } catch {
    return fallback;
  }
}
function copyDictionary(source, d = requireDocument()) {
  const result = d.newDictionary();
  if (source?.isDictionary())
    source.forEach((value, key) => result.put(key, value));
  return result;
}
function objectId(obj) {
  return String(obj.asIndirect());
}
function withPage(pageIndex, fn) {
  const page = requireDocument().loadPage(index(pageIndex));
  try {
    return fn(page);
  } finally {
    page.destroy();
  }
}
function annotationInfo(annotation) {
  const type = annotation.getType();
  const result = {
    id: objectId(annotation.getObject()),
    type,
    rect: annotation.getBounds(),
    text: annotation.getContents(),
    color: safe(
      () =>
        hexColor(
          type === "FreeText"
            ? annotation.getDefaultAppearance().color
            : annotation.getColor(),
        ),
      "#20262b",
    ),
    opacity: safe(() => annotation.getOpacity(), 1),
    author: safe(() => annotation.getAuthor(), ""),
  };
  if (annotation.hasQuadPoints())
    result.rects = annotation.getQuadPoints().map(quadRect);
  if (annotation.hasInkList()) result.strokes = annotation.getInkList();
  if (type === "FreeText")
    result.fontSize = safe(() => annotation.getDefaultAppearance().size, 12);
  if (type === "Stamp")
    result.fontSize =
      annotation.getObject().get("CamsStampFontSize").asNumber() || 16;
  return result;
}
function widgetInfo(widget) {
  const appearance = widget.getObject().get("AS");
  const exportValues = [];
  const normal = widget.getObject().get("AP", "N");
  if ((widget.isCheckbox() || widget.isRadioButton()) && normal.isDictionary())
    normal.forEach((value, key) => {
      if (key !== "Off") exportValues.push(key);
    });
  return {
    id: objectId(widget.getObject()),
    name: widget.getName(),
    type: widget.getFieldType(),
    value: widget.getValue(),
    rect: widget.getBounds(),
    options: widget.isChoice() ? widget.getOptions() : [],
    exportOptions: widget.isChoice() ? widget.getOptions(true) : [],
    readOnly: widget.isReadOnly(),
    multiline: widget.isMultiline(),
    maxLength: widget.isText() ? widget.getMaxLen() : 0,
    checked:
      widget.isCheckbox() || widget.isRadioButton()
        ? appearance.isName() && appearance.asName() !== "Off"
        : undefined,
    exportValue: exportValues[0] || "Yes",
  };
}
function quadRect(q) {
  return [
    Math.min(q[0], q[2], q[4], q[6]),
    Math.min(q[1], q[3], q[5], q[7]),
    Math.max(q[0], q[2], q[4], q[6]),
    Math.max(q[1], q[3], q[5], q[7]),
  ];
}
function rectQuad(r) {
  return [r[0], r[1], r[2], r[1], r[0], r[3], r[2], r[3]];
}
function textLines(page) {
  const display = page.toDisplayList(false);
  const structured = display.toStructuredText({ "preserve-whitespace": true });
  const lines = [];
  let line;
  try {
    structured.walk({
      beginLine(bounds) {
        line = {
          text: "",
          rect: bounds,
          fontSize: 12,
          font: "Helvetica",
          color: "#20262b",
          chars: [],
        };
      },
      onChar(character, origin, font, size, quad, paint) {
        if (!line) {
          font.destroy();
          return;
        }
        line.text += character;
        line.chars.push({ text: character, rect: quadRect(quad), origin });
        if (!line.origin) {
          line.fontSize = size;
          line.font = font.getName();
          line.color = hexColor(paint);
          line.origin = origin;
        }
        font.destroy();
      },
      endLine() {
        if (line && line.text.trim()) lines.push(line);
        line = null;
      },
    });
    const hidden = [],
      visible = [];
    const device = new mupdf.Device({
      ignoreText(text, transform) {
        try {
          hidden.push(text.getBounds(null, transform));
        } finally {
          text.destroy();
        }
      },
      fillText(text, transform, space) {
        try {
          visible.push(text.getBounds(null, transform));
        } finally {
          text.destroy();
          space.destroy();
        }
      },
      strokeText(text, stroke, transform, space) {
        try {
          visible.push(text.getBounds(stroke, transform));
        } finally {
          text.destroy();
          stroke.destroy();
          space.destroy();
        }
      },
    });
    try {
      page.runPageContents(device, mupdf.Matrix.identity);
      device.close();
    } finally {
      device.destroy();
    }
    for (const item of lines)
      item.invisible =
        hidden.some((r) => intersects(r, item.rect)) &&
        !visible.some((r) => intersects(r, item.rect));
    const records = page.getObject().get("CamsOCR");
    if (records.isArray())
      records.forEach((record) => {
        if (!record.isDictionary()) return;
        const recorded = record.get("Rect").asJS();
        if (
          !Array.isArray(recorded) ||
          recorded.length !== 4 ||
          recorded.some((n) => !Number.isFinite(n))
        )
          return;
        const sourceRect = mupdf.Rect.transform(recorded, page.getTransform());
        const sourceText = record.get("Text").asString().trim();
        const candidates = lines.filter(
          (item) => item.invisible && item.text.trim() === sourceText,
        );
        const item = candidates.sort(
          (a, b) =>
            Math.abs(a.rect[1] - sourceRect[1]) -
            Math.abs(b.rect[1] - sourceRect[1]),
        )[0];
        if (item) {
          item.sourceRect = sourceRect;
          item.rect = sourceRect;
          item.ocr = true;
        }
      });
    lines.forEach((item, n) => {
      item.id = String(n);
    });
    return lines;
  } finally {
    structured.destroy();
    display.destroy();
  }
}
function imageBlocks(page) {
  const display = page.toDisplayList(false);
  const structured = display.toStructuredText({ "preserve-images": true });
  const result = [];
  try {
    structured.walk({
      onImageBlock(bounds, transform, image) {
        result.push({
          id: String(result.length),
          rect: bounds,
          width: image.getWidth(),
          height: image.getHeight(),
          transform,
        });
        image.destroy();
      },
    });
    return result;
  } finally {
    structured.destroy();
    display.destroy();
  }
}
function outlineInfo(items) {
  return (items || []).map((item) => ({
    title: item.title || "Untitled bookmark",
    page: item.page ?? safe(() => document.resolveLink(item.uri), 0),
    uri: item.uri || "",
    children: outlineInfo(item.down),
  }));
}
export function open(bytes, password = "") {
  const input = byteArray(bytes);
  if (!input.byteLength) throw new Error("The PDF file is empty.");
  let candidate = null;
  const previous = {
    document,
    authenticated,
    revision,
    resourcesSerial,
    sessionPassword,
    sessionEncrypted,
  };
  try {
    candidate = new mupdf.PDFDocument(input);
    if (
      candidate.needsPassword() &&
      !candidate.authenticatePassword(String(password))
    ) {
      candidate.destroy();
      return {
        needsPassword: true,
        pageCount: 0,
        metadata: {},
        outline: [],
        canUndo: false,
        canRedo: false,
      };
    }
    if (!candidate.countPages()) throw new Error("This PDF contains no pages.");
    candidate.disableJS();
    candidate.enableJournal();
    document = candidate;
    authenticated = true;
    revision = 0;
    resourcesSerial = 0;
    sessionEncrypted =
      !!candidate.getMetaData("encryption") &&
      candidate.getMetaData("encryption") !== "None";
    sessionPassword = sessionEncrypted ? String(password) : "";
    const result = info();
    if (previous.document) previous.document.destroy();
    mupdf.emptyStore();
    return result;
  } catch (error) {
    if (candidate) candidate.destroy();
    ({
      document,
      authenticated,
      revision,
      resourcesSerial,
      sessionPassword,
      sessionEncrypted,
    } = previous);
    throw new Error(`Unable to open this PDF: ${error.message}`);
  }
}
export function create(width = 595.28, height = 841.89) {
  width = finite(width, 595.28, "Page width");
  height = finite(height, 841.89, "Page height");
  if (width < 10 || height < 10 || width > 14400 || height > 14400)
    throw new Error("Page dimensions must be between 10 and 14,400 points.");
  close();
  document = new mupdf.PDFDocument();
  authenticated = true;
  document.insertPage(0, document.addPage([0, 0, width, height], 0, {}, ""));
  document.disableJS();
  document.enableJournal();
  return info();
}
export function close() {
  if (document) document.destroy();
  document = null;
  authenticated = false;
  revision = 0;
  resourcesSerial = 0;
  sessionPassword = "";
  sessionEncrypted = false;
  mupdf.emptyStore();
  return { closed: true };
}
export function info() {
  const d = requireDocument();
  return {
    pageCount: d.countPages(),
    metadata: Object.fromEntries(
      Object.entries(META).map(([key, native]) => [
        key,
        d.getMetaData(native) || "",
      ]),
    ),
    outline: outlineInfo(d.loadOutline()),
    canUndo: d.canUndo(),
    canRedo: d.canRedo(),
    needsPassword: false,
    revision,
    encrypted: sessionEncrypted,
    permissions: Object.fromEntries(
      ["print", "copy", "edit", "annotate", "form", "assemble"].map((key) => [
        key,
        d.hasPermission(key),
      ]),
    ),
  };
}
export function render(pageIndex, scale = 1) {
  const zoom = finite(scale, 1, "Zoom");
  if (zoom <= 0 || zoom > 8)
    throw new Error("Zoom must be between 0 and 800%.");
  return withPage(pageIndex, (page) => {
    const bounds = page.getBounds();
    if (
      (bounds[2] - bounds[0]) * (bounds[3] - bounds[1]) * zoom * zoom >
      36_000_000
    )
      throw new Error("This page is too large at that zoom. Try a lower zoom.");
    page.update();
    const pixmap = page.toPixmap(
      mupdf.Matrix.scale(zoom, zoom),
      mupdf.ColorSpace.DeviceRGB,
      false,
      true,
    );
    try {
      const annotations = page.getAnnotations();
      const widgets = page.getWidgets();
      const links = page.getLinks();
      try {
        return {
          page: pageIndex,
          png: new Uint8Array(pixmap.asPNG()),
          width: pixmap.getWidth(),
          height: pixmap.getHeight(),
          bounds,
          textBlocks: textLines(page),
          imageBlocks: imageBlocks(page),
          annotations: annotations.map(annotationInfo),
          widgets: widgets.map(widgetInfo),
          links: links.map((link, i) => ({
            id: String(i),
            rect: link.getBounds(),
            uri: link.getURI(),
            external: link.isExternal(),
          })),
          rotation: page.getObject().getInheritable("Rotate").asNumber() || 0,
        };
      } finally {
        annotations.forEach((a) => a.destroy());
        widgets.forEach((w) => w.destroy());
        links.forEach((l) => l.destroy());
      }
    } finally {
      pixmap.destroy();
    }
  });
}
export function search(query) {
  const d = requireDocument();
  const text = String(query || "").trim();
  if (!text) return [];
  const results = [];
  for (let i = 0; i < d.countPages(); i++)
    withPage(i, (page) => {
      const hits = page.search(text);
      if (hits.length)
        results.push({
          page: i,
          rects: hits.flatMap((hit) => hit.map(quadRect)),
          hits: hits.map((hit) => hit.map(quadRect)),
        });
    });
  return results;
}
export function extractText(pageIndices) {
  if (!requireDocument().hasPermission("copy"))
    throw new Error(
      "This PDF does not permit copying text. Open it with its owner password to export its text.",
    );
  return pages(pageIndices).map((i) =>
    withPage(i, (page) => {
      const text = page.toStructuredText();
      try {
        return { page: i, text: text.asText() };
      } finally {
        text.destroy();
      }
    }),
  );
}
// Isolate the old content's graphics state before adding our content. Resource
// dictionaries are copied so edits never change a sibling's inherited resources.
function appendContent(page, contents, additions = {}) {
  const d = requireDocument();
  const object = page.getObject();
  const resources = copyDictionary(object.getInheritable("Resources"));
  for (const [category, entries] of Object.entries(additions)) {
    const sub = copyDictionary(resources.get(category));
    for (const [key, value] of Object.entries(entries)) sub.put(key, value);
    resources.put(category, sub);
  }
  object.put("Resources", resources);
  const old = object.get("Contents");
  const streams = d.newArray();
  streams.push(d.addStream("q\n", {}));
  if (old.isArray()) old.forEach((value) => streams.push(value));
  else if (!old.isNull()) streams.push(old);
  streams.push(d.addStream("\nQ\n", {}));
  const inverse = mupdf.Matrix.invert(page.getTransform());
  streams.push(d.addStream(`q\n${matrix(inverse)} cm\n${contents}\nQ\n`, {}));
  object.put("Contents", streams);
}
function baseFont(name = "Helvetica") {
  const allowed = [
    "Helvetica",
    "Helvetica-Bold",
    "Helvetica-Oblique",
    "Helvetica-BoldOblique",
    "Times-Roman",
    "Times-Bold",
    "Times-Italic",
    "Times-BoldItalic",
    "Courier",
    "Courier-Bold",
    "Courier-Oblique",
    "Courier-BoldOblique",
  ];
  const normalized = String(name).replace(/^[A-Z]{6}\+/, "");
  const actual = allowed.includes(normalized)
    ? normalized
    : /courier|mono/i.test(normalized)
      ? "Courier"
      : /times|serif/i.test(normalized)
        ? "Times-Roman"
        : /bold/i.test(normalized)
          ? "Helvetica-Bold"
          : "Helvetica";
  return new mupdf.Font(actual);
}
function matchingFont(page, bounds, text, requestedName) {
  const display = page.toDisplayList(false);
  const structured = display.toStructuredText();
  let matches = false,
    result = null;
  try {
    structured.walk({
      beginLine(lineBounds) {
        matches = bounds.every((n, i) => Math.abs(n - lineBounds[i]) < 1);
      },
      onChar(character, origin, font) {
        try {
          if (
            matches &&
            !result &&
            (!requestedName || requestedName === font.getName()) &&
            [...text]
              .filter((c) => !/\s/.test(c))
              .every((c) => font.encodeCharacter(c.codePointAt(0)))
          )
            result = new mupdf.Font(font.pointer);
        } finally {
          font.destroy();
        }
      },
    });
    return result;
  } finally {
    structured.destroy();
    display.destroy();
  }
}
function textContent(page, options) {
  const d = requireDocument();
  const r = rect(options.rect);
  const size = finite(options.fontSize, 16, "Font size");
  if (size < 1 || size > 500)
    throw new Error("Font size must be between 1 and 500 points.");
  const value = String(options.text ?? "").replace(/\r\n?/g, "\n");
  if (!value.trim()) throw new Error("Enter some text first.");
  const font = options.nativeFont || baseFont(options.font);
  const fonts = { base: font };
  const additions = { Font: {}, ExtGState: {} };
  const encoded = [];
  const unique = `Cams${++resourcesSerial}_${d.countObjects()}`;
  const getGlyph = (character) => {
    let glyph = font.encodeCharacter(character.codePointAt(0));
    let selected = font;
    let key = "base";
    if (!glyph && !/\s/.test(character)) {
      if (!fonts.cjk) fonts.cjk = new mupdf.Font("zh-Hans");
      glyph = fonts.cjk.encodeCharacter(character.codePointAt(0));
      selected = fonts.cjk;
      key = "cjk";
    }
    if (!glyph && !/\s/.test(character))
      throw new Error(
        `The font cannot display “${character}”. Choose different text or insert it as an image.`,
      );
    if (!additions.Font[`${unique}_${key}`])
      additions.Font[`${unique}_${key}`] = d.addFont(selected);
    return { glyph, font: selected, key: `${unique}_${key}` };
  };
  const available = r[2] - r[0];
  let x = r[0];
  let y =
    options.baseline === undefined
      ? r[1] + size * 0.85
      : finite(options.baseline, r[1] + size);
  const lineHeight = size * 1.25;
  let lineStart = true;
  try {
    for (const character of value) {
      if (character === "\n") {
        x = r[0];
        y += lineHeight;
        lineStart = true;
        continue;
      }
      const item = getGlyph(character === "\t" ? " " : character);
      const advance = item.font.advanceGlyph(item.glyph) * size;
      if (options.wrap !== false && !lineStart && x + advance > r[2]) {
        x = r[0];
        y += lineHeight;
      }
      if (options.clip !== false && y > r[3] + size * 0.2)
        throw new Error(
          "The text does not fit in that box. Enlarge the box or reduce its font size.",
        );
      encoded.push(
        `BT /${item.key} ${number(size)} Tf ${options.invisible ? "3" : "0"} Tr 1 0 0 -1 ${number(x)} ${number(y)} Tm <${item.glyph.toString(16).padStart(4, "0")}> Tj ET`,
      );
      x += advance;
      lineStart = false;
    }
    const paint = rgb(color(options.color));
    const gsName = `${unique}_GS`;
    additions.ExtGState[gsName] = d.addObject({
      Type: "ExtGState",
      ca: opacity(options.opacity),
      CA: opacity(options.opacity),
    });
    const angle = (finite(options.angle, 0) * Math.PI) / 180;
    const a = Math.cos(angle),
      b = Math.sin(angle),
      cx = (r[0] + r[2]) / 2,
      cy = (r[1] + r[3]) / 2;
    const rotation = [a, b, -b, a, cx - a * cx + b * cy, cy - b * cx - a * cy];
    appendContent(
      page,
      `/${gsName} gs\n${matrix(rotation)} cm\n${paint.map(number).join(" ")} rg\n${encoded.join("\n")}`,
      additions,
    );
  } finally {
    Object.values(fonts).forEach((f) => f.destroy());
  }
}
function addImage(page, options) {
  const r = rect(options.rect);
  const image = new mupdf.Image(
    byteArray(options.bytes ?? options.image ?? options.png),
  );
  try {
    const key = `CamsImage${++resourcesSerial}_${document.countObjects()}`;
    appendContent(
      page,
      `${number(r[2] - r[0])} 0 0 ${number(-(r[3] - r[1]))} ${number(r[0])} ${number(r[3])} cm\n/${key} Do`,
      { XObject: { [key]: document.addImage(image) } },
    );
  } finally {
    image.destroy();
  }
}
function transformExistingImage(page, op, removedLine = null) {
  const original = rect(op.rect);
  const target =
    op.type === "deleteImage" ? original : rect(op.targetRect || original);
  const replacement =
    op.type === "replaceImage"
      ? new mupdf.Image(byteArray(op.bytes ?? op.image))
      : null;
  const buffer = new mupdf.Buffer();
  const writer = new mupdf.DocumentWriter(buffer, "pdf", { compress: true });
  const output = writer.beginPage(page.getBounds());
  let changed = false;
  let imageOrdinal = -1;
  const callbacks = {};
  const forward = [
    "fillPath",
    "strokePath",
    "clipPath",
    "clipStrokePath",
    "fillText",
    "strokeText",
    "clipText",
    "clipStrokeText",
    "ignoreText",
    "fillShade",
    "popClip",
    "beginMask",
    "endMask",
    "beginGroup",
    "endGroup",
    "beginTile",
    "endTile",
    "beginLayer",
    "endLayer",
  ];
  for (const name of forward)
    callbacks[name] = (...args) => {
      try {
        return output[name](...args);
      } finally {
        for (const value of args)
          if (value && typeof value.destroy === "function") value.destroy();
      }
    };
  const mapped = (transform) => {
    const sx = (target[2] - target[0]) / (original[2] - original[0]);
    const sy = (target[3] - target[1]) / (original[3] - original[1]);
    return [
      transform[0] * sx,
      transform[1] * sy,
      transform[2] * sx,
      transform[3] * sy,
      (transform[4] - original[0]) * sx + target[0],
      (transform[5] - original[1]) * sy + target[1],
    ];
  };
  const matches = (transform, ordinal = imageOrdinal) =>
    !removedLine &&
    !changed &&
    (op.id === undefined || Number(op.id) === ordinal) &&
    mupdf.Rect.transform([0, 0, 1, 1], transform).every(
      (n, i) => Math.abs(n - original[i]) < 1,
    );
  const paintMask = (image, transform, paint, alpha) => {
    const source = image.toPixmap();
    const painted = new mupdf.Pixmap(
      mupdf.ColorSpace.DeviceRGB,
      [0, 0, source.getWidth(), source.getHeight()],
      true,
    );
    try {
      const pixels = source.getPixels(),
        targetPixels = painted.getPixels(),
        components = source.getNumberOfComponents();
      const c = rgb(paint);
      for (let i = 0; i < source.getWidth() * source.getHeight(); i++) {
        const coverage = pixels[i * components + components - 1];
        for (let channel = 0; channel < 3; channel++)
          targetPixels[i * 4 + channel] = Math.round(c[channel] * coverage);
        targetPixels[i * 4 + 3] = coverage;
      }
      const colored = new mupdf.Image(painted);
      try {
        output.fillImage(colored, transform, alpha);
      } finally {
        colored.destroy();
      }
    } finally {
      source.destroy();
      painted.destroy();
    }
  };
  callbacks.clipImageMask = (image, transform) => {
    try {
      const chosen = matches(transform, imageOrdinal + 1);
      if (chosen && ["deleteImage", "replaceImage"].includes(op.type)) {
        const path = new mupdf.Path();
        try {
          const bounds = page.getBounds();
          path.rect(...bounds);
          output.clipPath(path, false, mupdf.Matrix.identity);
        } finally {
          path.destroy();
        }
      } else {
        const placement = chosen ? mapped(transform) : transform;
        // The PDF writer cannot clip by an image directly. Its soft mask API
        // represents the same alpha coverage and keeps the native clip stack.
        output.beginMask(
          mupdf.Rect.transform([0, 0, 1, 1], placement),
          false,
          mupdf.ColorSpace.DeviceGray,
          [0],
        );
        paintMask(image, placement, [1, 1, 1], 1);
        // Keep the writer's cached CTM equal to the outer stream's CTM when
        // endMask rejoins it; otherwise the next image loses its placement.
        const empty = new mupdf.Path();
        try {
          output.fillPath(
            empty,
            false,
            mupdf.Matrix.identity,
            mupdf.ColorSpace.DeviceGray,
            [0],
            0,
          );
        } finally {
          empty.destroy();
        }
        output.endMask();
      }
    } finally {
      image.destroy();
    }
  };
  callbacks.beginTile = (...args) => {
    throw new Error(
      "This page uses a tiled pattern that cannot be preserved during this edit. The document was left unchanged.",
    );
  };
  callbacks.fillImage = (image, transform, alpha) => {
    imageOrdinal++;
    try {
      if (matches(transform)) {
        changed = true;
        if (op.type !== "deleteImage")
          output.fillImage(replacement || image, mapped(transform), alpha);
      } else output.fillImage(image, transform, alpha);
    } finally {
      image.destroy();
    }
  };
  callbacks.fillImageMask = (image, transform, space, paint, alpha) => {
    imageOrdinal++;
    try {
      if (matches(transform)) {
        changed = true;
        if (replacement)
          output.fillImage(replacement, mapped(transform), alpha);
        else if (op.type !== "deleteImage")
          paintMask(image, mapped(transform), paint, alpha);
      } else paintMask(image, transform, paint, alpha);
    } finally {
      image.destroy();
      space.destroy();
    }
  };
  if (removedLine) {
    const positions = removedLine.chars
      .filter((c) => c.origin)
      .map((c) => c.origin);
    for (const name of [
      "fillText",
      "strokeText",
      "clipText",
      "clipStrokeText",
      "ignoreText",
    ])
      callbacks[name] = (...args) => {
        const source = args[0],
          transform =
            args[name === "strokeText" || name === "clipStrokeText" ? 2 : 1];
        const filtered = new mupdf.Text();
        let kept = 0;
        try {
          source.walk({
            showGlyph(font, trm, glyph, unicode, wmode) {
              const p = [
                trm[4] * transform[0] + trm[5] * transform[2] + transform[4],
                trm[4] * transform[1] + trm[5] * transform[3] + transform[5],
              ];
              if (
                positions.some(
                  (origin) =>
                    Math.abs(origin[0] - p[0]) < 0.25 &&
                    Math.abs(origin[1] - p[1]) < 0.25,
                )
              )
                changed = true;
              else {
                filtered.showGlyph(font, trm, glyph, unicode, wmode);
                kept++;
              }
            },
          });
          if (kept) output[name](filtered, ...args.slice(1));
          // Text clipping pushes a clip even when the selected text was its only
          // content. Keep the native stack balanced with an empty clip in that case.
          else if (name === "clipText" || name === "clipStrokeText")
            output[name](filtered, ...args.slice(1));
        } finally {
          filtered.destroy();
          for (const value of args)
            if (value && typeof value.destroy === "function") value.destroy();
        }
      };
  }
  const device = new mupdf.Device(callbacks);
  try {
    page.runPageContents(device, mupdf.Matrix.identity);
    device.close();
    writer.endPage();
    writer.close();
    if (!changed)
      throw new Error(
        removedLine
          ? "That text could not be found. Select the line again before editing it."
          : "That image could not be found. Select it again before moving it.",
      );
    const rewritten = new mupdf.PDFDocument(buffer);
    const rewrittenPage = rewritten.loadPage(0);
    const graft = document.newGraftMap();
    try {
      const mapping = mupdf.Matrix.concat(
        rewrittenPage.getTransform(),
        mupdf.Matrix.invert(page.getTransform()),
      );
      const contents = new mupdf.Buffer();
      try {
        contents.write(`q\n${matrix(mapping)} cm\n`);
        const streams = rewrittenPage.getObject().get("Contents");
        const copyStream = (stream) => {
          const data = stream.readStream();
          try {
            contents.writeBuffer(data);
            contents.write("\n");
          } finally {
            data.destroy();
          }
        };
        if (streams.isArray()) streams.forEach(copyStream);
        else copyStream(streams);
        contents.write("\nQ\n");
        page
          .getObject()
          .put(
            "Resources",
            graft.graftObject(
              rewrittenPage.getObject().getInheritable("Resources"),
            ),
          );
        page.getObject().put("Contents", document.addStream(contents, {}));
      } finally {
        contents.destroy();
      }
    } finally {
      graft.destroy();
      rewrittenPage.destroy();
      rewritten.destroy();
    }
  } finally {
    device.destroy();
    output.destroy();
    writer.destroy();
    buffer.destroy();
    if (replacement) replacement.destroy();
  }
}
function transformAnnotation(annotation, targetRect) {
  const from = annotation.getBounds();
  const to = rect(targetRect);
  const sx = (to[2] - to[0]) / Math.max(0.1, from[2] - from[0]);
  const sy = (to[3] - to[1]) / Math.max(0.1, from[3] - from[1]);
  const move = (p) => [
    to[0] + (p[0] - from[0]) * sx,
    to[1] + (p[1] - from[1]) * sy,
  ];
  const scale = (Math.abs(sx) + Math.abs(sy)) / 2;
  if (annotation.hasInkList())
    annotation.setInkList(
      annotation.getInkList().map((stroke) => stroke.map(move)),
    );
  else if (annotation.hasQuadPoints() && annotation.getQuadPoints().length)
    annotation.setQuadPoints(
      annotation
        .getQuadPoints()
        .map((quad) =>
          Array.from({ length: 4 }, (_, i) =>
            move([quad[i * 2], quad[i * 2 + 1]]),
          ).flat(),
        ),
    );
  else if (annotation.hasLine()) {
    const points = annotation.getLine().map(move);
    annotation.setLine(points[0], points[1]);
  } else if (annotation.hasVertices() && annotation.getVertices().length)
    annotation.setVertices(annotation.getVertices().map(move));
  else annotation.setRect(to);
  if (annotation.hasBorder())
    annotation.setBorderWidth(
      Math.max(0.1, annotation.getBorderWidth() * scale),
    );
  if (annotation.getType() === "FreeText") {
    const old = annotation.getDefaultAppearance();
    annotation.setDefaultAppearance(old.font, old.size * scale, old.color);
  }
  annotation.setModificationDate(new Date());
  if (annotation.getType() === "Stamp")
    stampAppearance(
      annotation,
      {
        text: annotation.getContents(),
        fontSize:
          (annotation.getObject().get("CamsStampFontSize").asNumber() || 16) *
          scale,
      },
      annotation.getRect(),
      annotation.getColor(),
    );
  else annotation.update();
}
function stampAppearance(annotation, op, r, paint) {
  const wording = String(op.stamp || op.text || "APPROVED").trim();
  if (!wording) throw new Error("Enter stamp wording first.");
  annotation.setIcon("Approved");
  annotation.setContents(wording);
  annotation.update();
  const font = baseFont("Helvetica-Bold");
  try {
    const width = r[2] - r[0],
      height = r[3] - r[1];
    let advance = 0;
    const glyphs = [];
    for (const character of wording) {
      const gid = font.encodeCharacter(character.codePointAt(0));
      if (!gid && !/\s/.test(character))
        throw new Error(`The stamp font cannot display “${character}”.`);
      glyphs.push(gid.toString(16).padStart(4, "0"));
      advance += font.advanceGlyph(gid);
    }
    const size = Math.max(
      1,
      Math.min(
        finite(op.fontSize, 16),
        height * 0.55,
        (width - 12) / Math.max(advance, 0.1),
      ),
    );
    const x = (width - advance * size) / 2,
      y = (height - size) / 2 + size * 0.2;
    const c = rgb(paint).map(number).join(" ");
    const appearance = document.addStream(
      `q ${c} RG 1.5 w 1 1 ${number(width - 2)} ${number(height - 2)} re S ${c} rg BT /StampFont ${number(size)} Tf 1 0 0 1 ${number(x)} ${number(y)} Tm <${glyphs.join("")}> Tj ET Q`,
      {
        Type: "XObject",
        Subtype: "Form",
        BBox: [0, 0, width, height],
        Matrix: mupdf.Matrix.identity,
        Resources: { Font: { StampFont: document.addFont(font) } },
      },
    );
    annotation.getObject().put("AP", { N: appearance });
    annotation.getObject().put("CamsStampFontSize", size);
  } finally {
    font.destroy();
  }
}
function createAnnotation(page, op) {
  const type = ANNOT_TYPES[op.type];
  if (!type) throw new Error(`Unknown annotation: ${op.type}.`);
  const annotation = page.createAnnotation(type);
  try {
    annotation.setFlags(mupdf.PDFAnnotation.IS_PRINT);
    annotation.setAuthor(String(op.author || "Cam’s Free Software"));
    annotation.setCreationDate(new Date());
    annotation.setModificationDate(new Date());
    const paint = color(
      op.color ??
        (["highlight"].includes(op.type)
          ? "#ffe066"
          : op.type === "redact"
            ? "#000000"
            : "#2968be"),
    );
    annotation.setColor(paint);
    annotation.setOpacity(opacity(op.opacity));
    if (op.text !== undefined) annotation.setContents(String(op.text));
    if (["highlight", "underline", "strikeout"].includes(op.type)) {
      const rects = (op.rects || [op.rect]).map(rect);
      annotation.setQuadPoints(rects.map(rectQuad));
    } else if (op.type === "ink") {
      const strokes = (op.strokes || [op.points]).map((stroke) => {
        if (!Array.isArray(stroke) || stroke.length < 2)
          throw new Error("Draw a line with at least two points.");
        return stroke.map(point);
      });
      annotation.setInkList(strokes);
      annotation.setBorderWidth(
        Math.max(0.1, finite(op.width ?? op.lineWidth, 2)),
      );
    } else if (op.type === "line" || op.type === "arrow") {
      const endpoints =
        op.points ||
        (op.rect
          ? [
              [op.rect[0], op.rect[1]],
              [op.rect[2], op.rect[3]],
            ]
          : null);
      if (!endpoints || endpoints.length < 2)
        throw new Error("Choose the start and end of the line.");
      annotation.setLine(
        point(endpoints[0]),
        point(endpoints[endpoints.length - 1]),
      );
      annotation.setBorderWidth(
        Math.max(0.1, finite(op.width ?? op.lineWidth, 2)),
      );
      if (op.type === "arrow")
        annotation.setLineEndingStyles("None", "ClosedArrow");
    } else {
      const r = rect(op.rect);
      annotation.setRect(r);
      if (op.type === "note") {
        annotation.setIcon("Comment");
        annotation.setIsOpen(false);
      }
      if (["rectangle", "ellipse"].includes(op.type)) {
        annotation.setBorderWidth(
          Math.max(0.1, finite(op.width ?? op.lineWidth, 2)),
        );
        if (op.fill) annotation.setInteriorColor(color(op.fill));
      }
      if (op.type === "redact") annotation.getObject().put("IC", [0, 0, 0]);
      if (op.type === "stamp") stampAppearance(annotation, op, r, paint);
      if (op.type === "freeText") {
        annotation.setColor([]);
        annotation.setDefaultAppearance("Helv", finite(op.fontSize, 16), paint);
      }
    }
    if (op.type !== "stamp") annotation.update();
    return annotationInfo(annotation);
  } finally {
    annotation.destroy();
  }
}
function findAnnotation(page, id, widgets = false) {
  const list = widgets ? page.getWidgets() : page.getAnnotations();
  const selected = list.find((a) => objectId(a.getObject()) === String(id));
  if (!selected) {
    list.forEach((a) => a.destroy());
    throw new Error("That annotation or field no longer exists.");
  }
  return { selected, release: () => list.forEach((a) => a.destroy()) };
}
function setFormValue(page, op) {
  const list = page.getWidgets();
  try {
    const widget = list.find(
      (w) =>
        (op.id !== undefined && objectId(w.getObject()) === String(op.id)) ||
        (op.name !== undefined && w.getName() === op.name),
    );
    if (!widget) throw new Error("That form field no longer exists.");
    if (widget.isReadOnly())
      throw new Error("This PDF marks that field as read only.");
    if (widget.isText()) {
      const value = String(op.value ?? "");
      if (widget.getMaxLen() && value.length > widget.getMaxLen())
        throw new Error(`This field allows ${widget.getMaxLen()} characters.`);
      if (!widget.setTextValue(value))
        throw new Error("The PDF rejected this field value.");
    } else if (widget.isChoice()) {
      if (!widget.setChoiceValue(String(op.value ?? "")))
        throw new Error("Choose a value accepted by this form field.");
    } else if (widget.isCheckbox() || widget.isRadioButton()) {
      const on = !["Off", "", "false", "0"].includes(String(op.value));
      const current =
        widget.getObject().get("AS").asName() !== "Off" &&
        !!widget.getObject().get("AS").asName();
      if (on !== current) widget.toggle();
    } else if (widget.getFieldType() === "signature")
      throw new Error(
        "This is a certificate signature field. Use the visual signature tool to place a handwritten signature.",
      );
    else throw new Error("This field type cannot be filled.");
    widget.update();
  } finally {
    list.forEach((w) => w.destroy());
  }
}
function intersects(a, b) {
  return a[0] < b[2] && a[2] > b[0] && a[1] < b[3] && a[3] > b[1];
}
function removeFormField(widget) {
  const d = requireDocument();
  const removed = new Set();
  let field = widget.getObject();
  // A widget may be a child of a field. Remove that field's sibling widgets too:
  // otherwise its shared value and appearance would still expose the redaction.
  while (!field.get("FT").isName() && !field.get("Parent").isNull())
    field = field.get("Parent");
  const collect = (object) => {
    removed.add(objectId(object));
    const kids = object.get("Kids");
    if (kids.isArray()) kids.forEach(collect);
    object.delete("V");
    object.delete("DV");
    object.delete("AP");
  };
  collect(field);
  const prune = (array) => {
    if (!array.isArray()) return;
    for (let i = array.length - 1; i >= 0; i--) {
      const candidate = array.get(i);
      if (removed.has(objectId(candidate))) array.delete(i);
      else {
        const kids = candidate.get("Kids");
        if (kids.isArray()) {
          prune(kids);
          if (!kids.length) array.delete(i);
        }
      }
    }
  };
  prune(d.getTrailer().get("Root", "AcroForm", "Fields"));
  for (let i = 0; i < d.countPages(); i++) {
    const annotations = d.findPage(i).get("Annots");
    if (annotations.isArray())
      for (let j = annotations.length - 1; j >= 0; j--)
        if (removed.has(objectId(annotations.get(j)))) annotations.delete(j);
  }
}
function removeIntersectingExtras(page, regions) {
  const annotations = page.getAnnotations();
  const widgets = page.getWidgets();
  const links = page.getLinks();
  try {
    for (const annotation of annotations)
      if (
        annotation.getType() !== "Redact" &&
        regions.some((r) => intersects(r, annotation.getBounds()))
      ) {
        // Detach an affected attachment from the document's attachment list too.
        const filespec = annotation.getObject().get("FS");
        if (!filespec.isNull())
          for (const [name, reference] of Object.entries(
            document.getEmbeddedFiles(),
          ))
            if (objectId(reference) === objectId(filespec))
              document.deleteEmbeddedFile(name);
        page.deleteAnnotation(annotation);
      }
    for (const widget of widgets)
      if (regions.some((r) => intersects(r, widget.getBounds())))
        removeFormField(widget);
    for (const link of links)
      if (regions.some((r) => intersects(r, link.getBounds())))
        page.deleteLink(link);
  } finally {
    widgets.forEach((w) => w.destroy());
    links.forEach((l) => l.destroy());
  }
}
function selectedRedactions(page, ids) {
  const annotations = page.getAnnotations();
  try {
    const targets = annotations.filter(
      (a) =>
        a.getType() === "Redact" &&
        (!ids || ids.map(String).includes(objectId(a.getObject()))),
    );
    if (!targets.length) return 0;
    const regions = targets.flatMap((a) =>
      a.hasQuadPoints() && a.getQuadPoints().length
        ? a.getQuadPoints().map(quadRect)
        : [a.getRect()],
    );
    removeOCRRecords(page, regions);
    removeIntersectingExtras(page, regions);
    // Redact images by pixels and remove touched vector art, plus text. The
    // caller's downloaded full rewrite later discards all unreferenced bytes.
    for (const annotation of targets) annotation.applyRedaction(1, 2, 2, 0);
    return targets.length;
  } finally {
    annotations.forEach((a) => a.destroy());
  }
}
function removeOCRRecords(page, regions) {
  const records = page.getObject().get("CamsOCR");
  if (!records.isArray()) return;
  for (let i = records.length - 1; i >= 0; i--) {
    const record = records.get(i);
    const bounds = mupdf.Rect.transform(
      record.get("Rect").asJS(),
      page.getTransform(),
    );
    if (regions.some((region) => intersects(region, bounds))) records.delete(i);
  }
  if (!records.length) page.getObject().delete("CamsOCR");
}
function rasterBackground(page, bounds) {
  const pixmap = page.toPixmap(
    mupdf.Matrix.identity,
    mupdf.ColorSpace.DeviceRGB,
    false,
    false,
  );
  try {
    const samples = new Map();
    const pixels = pixmap.getPixels();
    const stride = pixmap.getStride();
    const components = pixmap.getNumberOfComponents();
    const take = (x, y) => {
      x = Math.max(
        0,
        Math.min(pixmap.getWidth() - 1, Math.round(x - pixmap.getX())),
      );
      y = Math.max(
        0,
        Math.min(pixmap.getHeight() - 1, Math.round(y - pixmap.getY())),
      );
      const at = y * stride + x * components;
      const sample = [pixels[at], pixels[at + 1], pixels[at + 2]];
      const key = sample.map((n) => n >> 4).join(",");
      const bucket = samples.get(key) || { count: 0, sum: [0, 0, 0] };
      bucket.count++;
      sample.forEach((n, i) => {
        bucket.sum[i] += n;
      });
      samples.set(key, bucket);
    };
    for (let i = 0; i <= 16; i++) {
      const x = bounds[0] + ((bounds[2] - bounds[0]) * i) / 16,
        y = bounds[1] + ((bounds[3] - bounds[1]) * i) / 16;
      take(x, bounds[1]);
      take(x, bounds[3]);
      take(bounds[0], y);
      take(bounds[2], y);
    }
    const dominant = [...samples.values()].sort((a, b) => b.count - a.count)[0];
    return dominant.sum.map((n) => n / dominant.count / 255);
  } finally {
    pixmap.destroy();
  }
}
function stripMetadata(d) {
  const trailer = d.getTrailer();
  trailer.delete("Info");
  const root = trailer.get("Root");
  root.delete("Metadata");
  for (let i = 0; i < d.countPages(); i++) d.findPage(i).delete("Metadata");
}
function sanitizeRedactedDocument(d) {
  stripMetadata(d);
  const root = d.getTrailer().get("Root");
  for (const key of ["OpenAction", "AA", "AF", "Collection", "PieceInfo"])
    root.delete(key);
  const names = root.get("Names");
  if (names.isDictionary()) {
    names.delete("JavaScript");
    names.delete("EmbeddedFiles");
  }
  const form = root.get("AcroForm");
  if (form.isDictionary()) form.delete("XFA");
  for (let i = 0; i < d.countPages(); i++) {
    const page = d.loadPage(i);
    try {
      for (const key of ["AA", "AF", "PieceInfo"]) page.getObject().delete(key);
      const annots = page.getObject().get("Annots");
      if (annots.isArray())
        for (let j = annots.length - 1; j >= 0; j--) {
          const object = annots.get(j);
          const type = object.get("Subtype").asName();
          if (
            [
              "FileAttachment",
              "RichMedia",
              "Sound",
              "Movie",
              "Screen",
              "3D",
            ].includes(type)
          ) {
            annots.delete(j);
            continue;
          }
          object.delete("AA");
          object.delete("AF");
          object.delete("FS");
          const action = object.get("A");
          if (
            !action.isNull() &&
            !["URI", "GoTo"].includes(action.get("S").asName())
          )
            object.delete("A");
        }
    } finally {
      page.destroy();
    }
  }
  const cleanFields = (array) => {
    if (!array.isArray()) return;
    array.forEach((field) => {
      field.delete("AA");
      field.delete("A");
      cleanFields(field.get("Kids"));
    });
  };
  cleanFields(root.get("AcroForm", "Fields"));
}
function writeBytes(d, options) {
  const buffer = d.saveToBuffer(options);
  try {
    return new Uint8Array(buffer.asUint8Array());
  } finally {
    buffer.destroy();
  }
}
function copyForOutput() {
  return new mupdf.PDFDocument(
    writeBytes(requireDocument(), {
      garbage: 0,
      incremental: false,
      encrypt: "none",
    }),
  );
}
function formObject(d) {
  const root = d.getTrailer().get("Root");
  let form = root.get("AcroForm");
  if (!form.isDictionary()) {
    form = d.newDictionary();
    root.put("AcroForm", form);
  }
  if (!form.get("Fields").isArray()) form.put("Fields", d.newArray());
  return form;
}
function existingFieldNames() {
  const result = new Set();
  for (let i = 0; i < document.countPages(); i++)
    withPage(i, (page) => {
      const widgets = page.getWidgets();
      try {
        for (const widget of widgets) result.add(widget.getName());
      } finally {
        widgets.forEach((w) => w.destroy());
      }
    });
  return result;
}
function uniqueFieldName(base, names) {
  let name = base || "field",
    suffix = 2;
  while (names.has(name)) name = `${base || "field"}_${suffix++}`;
  names.add(name);
  return name;
}
function graftPagesWithExtras(source, selected, at, duplicate = false) {
  const d = requireDocument();
  const map = d.newGraftMap();
  const names = existingFieldNames();
  const groupedFields = new Map();
  const remapping = new Map(selected.map((old, n) => [old, at + n]));
  let omittedLinks = 0;
  try {
    for (let n = 0; n < selected.length; n++)
      map.graftPage(at + n, source, selected[n]);
    for (let n = 0; n < selected.length; n++) {
      const srcPage = source.loadPage(selected[n]);
      const target = d.loadPage(at + n);
      const widgets = srcPage.getWidgets();
      const links = srcPage.getLinks();
      try {
        const ocr = srcPage.getObject().get("CamsOCR");
        if (ocr.isArray())
          target.getObject().put("CamsOCR", map.graftObject(ocr));
        const widgetById = new Map(
          widgets.map((w) => [objectId(w.getObject()), w]),
        );
        const srcAnnots = srcPage.getObject().get("Annots");
        const targetAnnots = d.newArray();
        if (srcAnnots.isArray())
          srcAnnots.forEach((original) => {
            const subtype = original.get("Subtype").asName();
            // Links are recreated below so their page destinations are remapped.
            if (subtype === "Link" || subtype === "Popup") return;
            const widget = widgetById.get(objectId(original));
            const sanitized = source.newDictionary();
            const omit = new Set([
              "P",
              "Parent",
              "Popup",
              "IRT",
              "StructParent",
            ]);
            if (widget)
              [
                "Kids",
                "T",
                "FT",
                "Ff",
                "V",
                "DV",
                "DA",
                "DR",
                "Q",
                "MaxLen",
                "Opt",
                "AA",
              ].forEach((key) => omit.add(key));
            original.forEach((value, key) => {
              if (!omit.has(key)) sanitized.put(key, value);
            });
            const copied = d.addObject(map.graftObject(sanitized));
            copied.put("P", target.getObject());
            if (widget) {
              const sourceName = widget.getName();
              let parent = groupedFields.get(sourceName);
              if (!parent) {
                const field = d.newDictionary();
                field.put("T", d.newString(uniqueFieldName(sourceName, names)));
                field.put("Kids", d.newArray());
                for (const key of [
                  "FT",
                  "Ff",
                  "V",
                  "DV",
                  "DA",
                  "DR",
                  "Q",
                  "MaxLen",
                  "Opt",
                ]) {
                  let value = original.getInheritable(key);
                  if (value.isNull() && ["DA", "DR", "Q"].includes(key))
                    value = source.getTrailer().get("Root", "AcroForm", key);
                  if (!value.isNull()) field.put(key, map.graftObject(value));
                }
                parent = d.addObject(field);
                groupedFields.set(sourceName, parent);
                formObject(d).get("Fields").push(parent);
              }
              parent.get("Kids").push(copied);
              copied.put("Parent", parent);
            }
            targetAnnots.push(copied);
          });
        target.getObject().put("Annots", targetAnnots);
        for (const link of links) {
          let uri = link.getURI();
          if (!link.isExternal()) {
            const sourceIndex = safe(() => source.resolveLink(uri), -1);
            const destination = remapping.has(sourceIndex)
              ? remapping.get(sourceIndex)
              : duplicate && sourceIndex >= 0
                ? sourceIndex + (sourceIndex >= at ? selected.length : 0)
                : -1;
            if (destination < 0) {
              omittedLinks++;
              continue;
            }
            uri = uri.replace(/^#page=\d+/, `#page=${destination + 1}`);
          }
          const created = target.createLink(link.getBounds(), uri);
          created.destroy();
        }
      } finally {
        widgets.forEach((w) => w.destroy());
        links.forEach((l) => l.destroy());
        srcPage.destroy();
        target.destroy();
      }
    }
  } finally {
    map.destroy();
  }
  return { importedFields: groupedFields.size, omittedLinks };
}
function pruneUnreachableFields(d) {
  const visible = new Set();
  for (let i = 0; i < d.countPages(); i++) {
    const annotations = d.findPage(i).get("Annots");
    if (annotations.isArray())
      annotations.forEach((a) => {
        if (a.get("Subtype").asName() === "Widget") visible.add(objectId(a));
      });
  }
  const prune = (array) => {
    if (!array.isArray()) return;
    for (let i = array.length - 1; i >= 0; i--) {
      const field = array.get(i);
      const kids = field.get("Kids");
      if (kids.isArray()) {
        prune(kids);
        if (!kids.length && !visible.has(objectId(field))) array.delete(i);
      } else if (!visible.has(objectId(field))) array.delete(i);
    }
  };
  prune(d.getTrailer().get("Root", "AcroForm", "Fields"));
}

export function mutate(op) {
  const d = requireDocument();
  if (!op || typeof op.type !== "string")
    throw new Error("Choose an editing action.");
  const permission =
    op.type === "formValue"
      ? "form"
      : (ANNOT_TYPES[op.type] && op.type !== "redact") ||
          [
            "deleteAnnotation",
            "editAnnotation",
            "transformAnnotation",
          ].includes(op.type)
        ? "annotate"
        : [
              "rotate",
              "deletePages",
              "duplicatePages",
              "reorderPages",
              "blankPage",
              "merge",
            ].includes(op.type)
          ? "assemble"
          : "edit";
  if (!d.hasPermission(permission))
    throw new Error(
      `This PDF does not permit ${permission === "assemble" ? "page changes" : permission === "form" ? "filling forms" : permission === "annotate" ? "annotations" : "editing"}. Open it with its owner password to make this change.`,
    );
  let changedPages = [];
  let extra = {};
  d.beginOperation(op.type);
  try {
    switch (op.type) {
      case "text":
      case "ocr":
      case "OCR":
      case "image":
      case "signature":
      case "replaceImage":
      case "deleteImage":
      case "moveImage":
      case "transformImage":
      case "replaceText":
        changedPages = [index(op.page)];
        withPage(op.page, (page) => {
          if (op.type === "image" || op.type === "signature")
            addImage(page, op);
          else if (
            [
              "replaceImage",
              "deleteImage",
              "moveImage",
              "transformImage",
            ].includes(op.type)
          )
            transformExistingImage(page, op);
          else if (op.type.toLowerCase() === "ocr") {
            if (!Array.isArray(op.lines) || !op.lines.length)
              throw new Error("OCR found no readable text on this page.");
            let records = page.getObject().get("CamsOCR");
            if (!records.isArray()) {
              records = d.newArray();
              page.getObject().put("CamsOCR", records);
            }
            for (const line of op.lines)
              if (String(line.text || "").trim()) {
                const sourceRect = rect(line.rect);
                textContent(page, {
                  ...line,
                  invisible: true,
                  wrap: false,
                  clip: false,
                  fontSize:
                    line.fontSize ||
                    Math.max(4, (line.rect[3] - line.rect[1]) * 0.85),
                });
                records.push({
                  Text: d.newString(String(line.text)),
                  Rect: mupdf.Rect.transform(
                    sourceRect,
                    mupdf.Matrix.invert(page.getTransform()),
                  ),
                });
              }
          } else {
            let baseline = op.baseline;
            let nativeFont = null;
            if (op.type === "replaceText") {
              const lines = textLines(page);
              const selected =
                lines.find((line) =>
                  line.rect.every((n, i) => Math.abs(n - op.rect[i]) < 1),
                ) ||
                lines.find(
                  (line) => op.id !== undefined && line.id === String(op.id),
                ) ||
                lines.find(
                  (line) =>
                    Math.abs(line.rect[0] - op.rect[0]) < 1 &&
                    Math.abs(line.rect[1] - op.rect[1]) < 1,
                );
              if (!selected)
                throw new Error(
                  "Select an existing line of text before replacing it.",
                );
              if (String(op.text || "").trim())
                nativeFont = matchingFont(
                  page,
                  selected.rect,
                  String(op.text || ""),
                  op.font,
                );
              if (baseline === undefined) baseline = selected.origin?.[1];
              const bounds = rect(selected.sourceRect || selected.rect);
              const background = op.replaceImagePixels
                ? color(
                    op.backgroundColor ||
                      hexColor(rasterBackground(page, bounds)),
                  )
                : null;
              transformExistingImage(page, op, selected);
              if (op.replaceImagePixels) {
                const annotation = page.createAnnotation("Redact");
                try {
                  annotation.setRect(bounds);
                  annotation.applyRedaction(0, 2, 0, 1);
                } finally {
                  annotation.destroy();
                }
                appendContent(
                  page,
                  `${rgb(background).map(number).join(" ")} rg\n${number(bounds[0])} ${number(bounds[1])} ${number(bounds[2] - bounds[0])} ${number(bounds[3] - bounds[1])} re f`,
                );
              }
              removeOCRRecords(page, [bounds]);
            }
            try {
              if (op.type !== "replaceText" || String(op.text || "").trim())
                textContent(page, {
                  ...op,
                  rect: op.targetRect || op.rect,
                  baseline,
                  nativeFont,
                });
            } finally {
              if (nativeFont) nativeFont.destroy();
            }
          }
        });
        break;
      case "highlight":
      case "underline":
      case "strikeout":
      case "ink":
      case "rectangle":
      case "ellipse":
      case "line":
      case "arrow":
      case "note":
      case "stamp":
      case "redact":
      case "freeText":
        changedPages = [index(op.page)];
        extra.annotation = withPage(op.page, (page) =>
          createAnnotation(page, op),
        );
        break;
      case "deleteAnnotation":
      case "editAnnotation":
      case "transformAnnotation":
        changedPages = [index(op.page)];
        withPage(op.page, (page) => {
          const { selected, release } = findAnnotation(page, op.id);
          try {
            if (op.type === "deleteAnnotation") page.deleteAnnotation(selected);
            else if (op.type === "transformAnnotation") {
              transformAnnotation(selected, op.targetRect);
              extra.annotation = annotationInfo(selected);
            } else {
              if (op.rect) selected.setRect(rect(op.rect));
              if (op.text !== undefined) selected.setContents(String(op.text));
              if (op.color !== undefined) selected.setColor(color(op.color));
              if (op.opacity !== undefined)
                selected.setOpacity(opacity(op.opacity));
              if (
                op.fontSize !== undefined &&
                selected.getType() === "FreeText"
              )
                selected.setDefaultAppearance(
                  "Helv",
                  finite(op.fontSize, 16),
                  color(op.color || "#20262b"),
                );
              selected.setModificationDate(new Date());
              if (selected.getType() === "Stamp")
                stampAppearance(
                  selected,
                  {
                    text: selected.getContents(),
                    fontSize:
                      op.fontSize ||
                      selected
                        .getObject()
                        .get("CamsStampFontSize")
                        .asNumber() ||
                      16,
                  },
                  selected.getRect(),
                  selected.getColor(),
                );
              else selected.update();
            }
          } finally {
            release();
          }
        });
        break;
      case "applyRedactions": {
        changedPages = op.all ? pages() : pages(op.pages, op.page);
        let removed = 0;
        for (const pageIndex of changedPages)
          removed += withPage(pageIndex, (page) =>
            selectedRedactions(page, op.ids),
          );
        if (!removed) throw new Error("Mark an area for redaction first.");
        if (op.sanitize !== false) {
          sanitizeRedactedDocument(d);
          extra.sanitized = true;
        }
        extra.redactionsApplied = removed;
        break;
      }
      case "formValue":
        changedPages = [index(op.page)];
        withPage(op.page, (page) => setFormValue(page, op));
        break;
      case "rotate": {
        changedPages = pages(op.pages, op.page);
        const degrees = finite(op.degrees ?? op.angle, 90, "Rotation");
        if (degrees % 90 !== 0)
          throw new Error("Page rotation must be a multiple of 90 degrees.");
        for (const pageIndex of changedPages) {
          const obj = d.findPage(pageIndex);
          const old = obj.getInheritable("Rotate").asNumber() || 0;
          obj.put("Rotate", (((old + degrees) % 360) + 360) % 360);
        }
        break;
      }
      case "crop":
        changedPages = pages(op.pages, op.page);
        for (const pageIndex of changedPages)
          withPage(pageIndex, (page) => {
            const r = rect(op.rect);
            const bounds = page.getBounds();
            if (
              r[0] < bounds[0] ||
              r[1] < bounds[1] ||
              r[2] > bounds[2] ||
              r[3] > bounds[3]
            )
              throw new Error("The crop must fit inside the current page.");
            page.setPageBox("CropBox", r);
          });
        break;
      case "deletePages": {
        const list = pages(op.pages, op.page);
        if (list.length >= d.countPages())
          throw new Error("Keep at least one page in the PDF.");
        for (const pageIndex of list.sort((a, b) => b - a))
          d.deletePage(pageIndex);
        pruneUnreachableFields(d);
        changedPages = pages();
        break;
      }
      case "duplicatePages": {
        const list = pages(op.pages, op.page);
        const at = insertion(
          op.at === undefined ? Math.max(...list) + 1 : op.at,
        );
        const temporary = copyForOutput();
        try {
          extra = graftPagesWithExtras(temporary, list, at, true);
        } finally {
          temporary.destroy();
        }
        changedPages = pages();
        break;
      }
      case "reorderPages": {
        const order = op.order || op.pages;
        if (
          !Array.isArray(order) ||
          order.length !== d.countPages() ||
          new Set(order).size !== order.length
        )
          throw new Error("Reordering must contain each page exactly once.");
        order.forEach((i) => index(i));
        const form = d.getTrailer().get("Root", "AcroForm");
        d.rearrangePages(order);
        if (!form.isNull()) d.getTrailer().get("Root").put("AcroForm", form);
        pruneUnreachableFields(d);
        changedPages = pages();
        break;
      }
      case "blankPage": {
        const width = finite(op.width, 595.28, "Page width");
        const height = finite(op.height, 841.89, "Page height");
        if (width < 10 || height < 10 || width > 14400 || height > 14400)
          throw new Error(
            "Page dimensions must be between 10 and 14,400 points.",
          );
        d.insertPage(
          insertion(op.at),
          d.addPage([0, 0, width, height], 0, {}, ""),
        );
        changedPages = pages();
        break;
      }
      case "merge": {
        const source = new mupdf.PDFDocument(byteArray(op.bytes));
        try {
          if (
            source.needsPassword() &&
            !source.authenticatePassword(String(op.password || ""))
          )
            throw new Error("The PDF being merged needs its password.");
          source.disableJS();
          const selected =
            op.pages ||
            Array.from({ length: source.countPages() }, (_, i) => i);
          if (!selected.length)
            throw new Error("The other PDF contains no selected pages.");
          selected.forEach((i) => index(i, source.countPages()));
          extra = graftPagesWithExtras(source, selected, insertion(op.at));
        } finally {
          source.destroy();
        }
        changedPages = pages();
        break;
      }
      case "metadata":
        for (const [key, value] of Object.entries(
          op.metadata || op.values || op,
        ))
          if (META[key]) d.setMetaData(META[key], String(value || ""));
        break;
      case "clearMetadata":
        stripMetadata(d);
        break;
      case "pageNumbers": {
        changedPages = pages(op.pages);
        const size = finite(op.fontSize, 12);
        const start = finite(op.start, 1);
        for (let n = 0; n < changedPages.length; n++)
          withPage(changedPages[n], (page) => {
            const bounds = page.getBounds();
            const text = `${op.prefix || ""}${start + n}${op.suffix || ""}`;
            const width = Math.max(size * text.length, 60);
            const margin = finite(op.margin, 24);
            const position = op.position || "bottom-center";
            let x = (bounds[0] + bounds[2] - width) / 2;
            if (position.endsWith("left")) x = bounds[0] + margin;
            if (position.endsWith("right")) x = bounds[2] - margin - width;
            const y = position.startsWith("top")
              ? bounds[1] + margin
              : bounds[3] - margin - size * 1.4;
            textContent(page, {
              rect: [x, y, x + width, y + size * 1.5],
              text,
              fontSize: size,
              color: op.color || "#20262b",
              clip: false,
            });
          });
        break;
      }
      case "watermark": {
        changedPages = pages(op.pages);
        for (const pageIndex of changedPages)
          withPage(pageIndex, (page) => {
            const bounds = page.getBounds();
            const size = finite(op.fontSize, 48);
            const text = String(op.text || "").trim();
            if (!text) throw new Error("Enter watermark text first.");
            const font = baseFont(op.font);
            let width = 0;
            try {
              for (const char of text)
                width +=
                  font.advanceGlyph(font.encodeCharacter(char.codePointAt(0))) *
                  size;
            } finally {
              font.destroy();
            }
            const x = (bounds[0] + bounds[2] - width) / 2;
            const y = (bounds[1] + bounds[3]) / 2 - size * 0.4;
            textContent(page, {
              ...op,
              text,
              rect: [x, y, x + Math.max(width, 1), y + size * 2],
              color: op.color || "#8b9098",
              opacity: op.opacity ?? 0.2,
              fontSize: size,
              wrap: false,
              clip: false,
              angle: op.angle ?? -35,
            });
          });
        break;
      }
      case "link":
        changedPages = [index(op.page)];
        withPage(op.page, (page) => {
          const uri = String(op.uri || op.url || "").trim();
          if (!/^(https?:|mailto:|tel:|#page=)/i.test(uri))
            throw new Error(
              "Use an https://, http://, mailto:, tel:, or #page= link.",
            );
          const link = page.createLink(rect(op.rect), uri);
          link.destroy();
        });
        break;
      case "deleteLink":
        changedPages = [index(op.page)];
        withPage(op.page, (page) => {
          const links = page.getLinks();
          try {
            const link = links[Number(op.id)];
            if (!link) throw new Error("That link no longer exists.");
            page.deleteLink(link);
          } finally {
            links.forEach((l) => l.destroy());
          }
        });
        break;
      default:
        throw new Error(`The action “${op.type}” is not supported.`);
    }
    d.endOperation();
    revision++;
    return { ...info(), changedPages, ...extra };
  } catch (error) {
    safe(() => d.abandonOperation());
    throw new Error(error.message || "This PDF could not be edited.");
  }
}
export function undo() {
  const d = requireDocument();
  if (!d.canUndo()) throw new Error("There is nothing to undo.");
  d.undo();
  revision++;
  return { ...info(), changedPages: pages() };
}
export function redo() {
  const d = requireDocument();
  if (!d.canRedo()) throw new Error("There is nothing to redo.");
  d.redo();
  revision++;
  return { ...info(), changedPages: pages() };
}
function outputSettings(options = {}) {
  const compression = options.compress !== false;
  const settings = {
    ...SAVE_DEFAULTS,
    compress: compression,
    "compress-images": compression,
    "compress-fonts": compression,
  };
  const preserve =
    sessionEncrypted &&
    (options.password === undefined ||
      (options.preserveEncryption === true && !options.password));
  if (options.password || preserve) {
    const password = preserve ? sessionPassword : String(options.password);
    if (new TextEncoder().encode(password).length > 127)
      throw new Error("The password is too long. Use at most 127 UTF-8 bytes.");
    settings.encrypt = "aes-256";
    settings["user-password"] = password;
    settings["owner-password"] = password;
  }
  return settings;
}
export function save(options = {}) {
  const copy = copyForOutput();
  try {
    if (options.clearMetadata) stripMetadata(copy);
    if (options.flatten) copy.bake(true, true);
    return writeBytes(copy, outputSettings(options));
  } finally {
    copy.destroy();
  }
}
export function extract(pageIndices, options = {}) {
  const selected = pages(pageIndices);
  const result = copyForOutput();
  try {
    const form = result.getTrailer().get("Root", "AcroForm");
    result.rearrangePages(selected);
    if (!form.isNull()) result.getTrailer().get("Root").put("AcroForm", form);
    pruneUnreachableFields(result);
    if (options.clearMetadata) stripMetadata(result);
    if (options.flatten) result.bake(true, true);
    return writeBytes(result, outputSettings(options));
  } finally {
    result.destroy();
  }
}
export function resolveLink(uri) {
  return requireDocument().resolveLink(String(uri));
}
export const methods = {
  open,
  create,
  close,
  info,
  render,
  search,
  extractText,
  mutate,
  undo,
  redo,
  save,
  extract,
  resolveLink,
};
export default methods;
