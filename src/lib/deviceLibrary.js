import { storedTrack } from "./playerState.js";

// App-managed music storage on this device. Audio never leaves the browser.
const DB = "raagam-device-music";
const STORE = "songs";

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: "id" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveDeviceTracks(files, tracks) {
  const records = await Promise.all(tracks.map(async (track, i) => ({
    id: track.id,
    file: files[i],
    metadata: storedTrack(track),
    artwork: track.cover?.startsWith("blob:") ? await fetch(track.cover).then((r) => r.blob()) : null,
  })));
  const db = await openDb();
  try {
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.oncomplete = resolve;
      tx.onabort = () => reject(tx.error || new Error("Music storage was interrupted."));
      tx.onerror = () => reject(tx.error);
      const store = tx.objectStore(STORE);
      for (const record of records) store.put(record);
    });
  } finally { db.close(); }
}

export async function loadDeviceTracks() {
  const db = await openDb();
  try {
    const records = await new Promise((resolve, reject) => {
      const request = db.transaction(STORE, "readonly").objectStore(STORE).getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    return records.map((record) => ({
      ...record.metadata,
      src: URL.createObjectURL(record.file),
      cover: record.artwork ? URL.createObjectURL(record.artwork) : record.metadata.cover,
    }));
  } finally { db.close(); }
}

export async function removeDeviceTrack(id) {
  const db = await openDb();
  try {
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.oncomplete = resolve;
      tx.onabort = () => reject(tx.error || new Error("Could not remove the song."));
      tx.onerror = () => reject(tx.error);
      tx.objectStore(STORE).delete(id);
    });
  } finally { db.close(); }
}

export function releaseDeviceTracks(tracks) {
  for (const track of tracks) for (const key of ["src", "cover"]) {
    if (track[key]?.startsWith("blob:")) URL.revokeObjectURL(track[key]);
  }
}
