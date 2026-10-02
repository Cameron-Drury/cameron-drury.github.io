// SPDX-License-Identifier: AGPL-3.0-or-later
let activeWorker = null;

/** Recognise English text locally and map pixel boxes to PDF page coordinates. */
export async function recognize(png, bounds, onProgress = () => {}) {
  if (activeWorker) throw new Error("Text recognition is already running.");
  const { default: Tesseract } = await import("../vendor/tesseract.esm.min.js");
  const { createWorker } = Tesseract;
  const bytes = png instanceof Uint8Array ? png : new Uint8Array(png);
  const image = await createImageBitmap(
    new Blob([bytes], { type: "image/png" }),
  );
  const width = image.width;
  const height = image.height;
  image.close();
  const report = (event) =>
    onProgress({
      status: event.status || "Recognising text",
      progress: Math.max(0, Math.min(1, event.progress || 0)),
    });
  try {
    activeWorker = await createWorker("eng", 1, {
      workerPath: "/assets/pdf-editor/vendor/ocr/worker.min.js",
      corePath: "/assets/pdf-editor/vendor/ocr",
      langPath: "/assets/pdf-editor/vendor/ocr",
      workerBlobURL: false,
      gzip: false,
      cacheMethod: "none",
      logger: report,
    });
    await activeWorker.setParameters({ preserve_interword_spaces: "1" });
    const { data } = await activeWorker.recognize(
      new Blob([bytes], { type: "image/png" }),
      {},
      { text: true, blocks: true },
    );
    const sx = (bounds[2] - bounds[0]) / width;
    const sy = (bounds[3] - bounds[1]) / height;
    const metrics = document.createElement("canvas").getContext("2d");
    metrics.font = "100px Arial";
    const lines = (data.blocks || [])
      .flatMap((block) =>
        (block.paragraphs || []).flatMap((paragraph) => paragraph.lines || []),
      )
      .filter((line) => line.text.trim())
      .map((line) => ({
        text: line.text.trim(),
        rect: [
          bounds[0] + line.bbox.x0 * sx,
          bounds[1] + line.bbox.y0 * sy,
          bounds[0] + line.bbox.x1 * sx,
          bounds[1] + line.bbox.y1 * sy,
        ],
        fontSize: Math.max(
          4,
          Math.min(
            ((line.bbox.y1 - line.bbox.y0) * sy) / 0.75,
            (((line.bbox.x1 - line.bbox.x0) * sx) /
              Math.max(1, metrics.measureText(line.text.trim()).width)) *
              100,
          ),
        ),
        baseline:
          bounds[1] +
          line.bbox.y1 * sy -
          (line.bbox.y1 - line.bbox.y0) * sy * 0.15,
        confidence: line.confidence,
      }));
    if (!lines.length)
      throw new Error(
        "No text was found. Try a clearer scan or a larger page image.",
      );
    return { lines, text: data.text, confidence: data.confidence };
  } finally {
    if (activeWorker) await activeWorker.terminate();
    activeWorker = null;
  }
}

export async function cancelRecognition() {
  if (activeWorker) await activeWorker.terminate();
  activeWorker = null;
}
