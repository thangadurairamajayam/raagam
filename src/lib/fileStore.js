// Remembers the user's music folder between sessions.
//
// The browser can't keep a folder open across reloads, but it can persist a
// directory *handle* in IndexedDB. Reopening still needs one click to re-grant
// permission — the browser deliberately won't let a page silently regain access
// to your disk.

const DB_NAME = "sur-library";
const STORE = "handles";
const KEY = "musicFolder";

export const supportsPersistentFolder = () => typeof window !== "undefined" && "showDirectoryPicker" in window;

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function withStore(mode, fn) {
  const db = await openDb();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const req = fn(tx.objectStore(STORE));
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  } finally {
    db.close();
  }
}

export const saveFolderHandle = (handle) => withStore("readwrite", (s) => s.put(handle, KEY));
export const getFolderHandle = () => withStore("readonly", (s) => s.get(KEY)).catch(() => null);
export const clearFolderHandle = () => withStore("readwrite", (s) => s.delete(KEY));

/** `request` must run inside a user gesture or the browser refuses. */
export async function ensureReadPermission(handle, { request = false } = {}) {
  if (!handle?.queryPermission) return false;
  const options = { mode: "read" };
  if ((await handle.queryPermission(options)) === "granted") return true;
  if (!request) return false;
  return (await handle.requestPermission(options)) === "granted";
}

export async function pickFolder() {
  const handle = await window.showDirectoryPicker({ id: "sur-music", mode: "read" });
  await saveFolderHandle(handle);
  return handle;
}

const AUDIO_EXT = /\.(mp3|m4a|aac|flac|ogg|opus|wav|wma)$/i;

/** Walk the folder tree, tagging each file with its path so albums can be inferred. */
export async function filesFromHandle(handle, prefix = handle.name, depth = 0) {
  if (depth > 6) return [];
  const files = [];
  for await (const [name, entry] of handle.entries()) {
    const path = `${prefix}/${name}`;
    if (entry.kind === "directory") {
      files.push(...(await filesFromHandle(entry, path, depth + 1)));
    } else if (AUDIO_EXT.test(name)) {
      const file = await entry.getFile();
      // buildLocalTracks reads webkitRelativePath; mirror it for handle-based files.
      Object.defineProperty(file, "webkitRelativePath", { value: path, configurable: true });
      files.push(file);
    }
  }
  return files;
}
