// SPDX-License-Identifier: AGPL-3.0-or-later
const DB = "cams-pdf-editor";
const STORE = "drafts";

function database() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(
        new Error(
          "This browser could not open local draft storage. Download your PDF to keep your changes.",
        ),
      );
  });
}

async function transaction(mode, action) {
  const db = await database();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      let result;
      const request = action(tx.objectStore(STORE));
      request.onsuccess = () => {
        result = request.result;
      };
      tx.oncomplete = () => resolve(result);
      tx.onerror = () =>
        reject(
          new Error(
            "The local draft could not be saved. Download your PDF to keep your changes.",
          ),
        );
      tx.onabort = () =>
        reject(
          new Error(
            "Local draft storage is full or unavailable. Download your PDF to keep your changes.",
          ),
        );
    });
  } finally {
    db.close();
  }
}

export async function saveDraft({ bytes, name, page }) {
  const data =
    bytes instanceof Uint8Array ? bytes.slice() : new Uint8Array(bytes);
  return transaction("readwrite", (store) =>
    store.put(
      {
        bytes: data,
        name: String(name || "Untitled.pdf"),
        page: Number(page) || 0,
        savedAt: Date.now(),
      },
      "current",
    ),
  );
}
export async function loadDraft() {
  return transaction("readonly", (store) => store.get("current"));
}
export async function clearDraft() {
  return transaction("readwrite", (store) => store.delete("current"));
}
