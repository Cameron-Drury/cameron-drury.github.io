import methods from "./src/engine.mjs";

// Serial processing is intentional: edits and renders use one PDF document.
let queue = Promise.resolve();
self.addEventListener("message", (event) => {
  const { id, method, args = [] } = event.data || {};
  queue = queue.then(async () => {
    try {
      if (!Object.hasOwn(methods, method))
        throw new Error(`Unknown PDF action: ${method}.`);
      if (!Array.isArray(args))
        throw new Error("PDF action arguments must be an array.");
      const result = await methods[method](...args);
      const transfer = [];
      if (result instanceof Uint8Array) transfer.push(result.buffer);
      else if (result?.png instanceof Uint8Array)
        transfer.push(result.png.buffer);
      self.postMessage({ id, result }, transfer);
    } catch (error) {
      self.postMessage({ id, error: error.message || String(error) });
    }
  });
});
self.postMessage({ ready: true });
