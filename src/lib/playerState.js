// Persist metadata, never session-only blob URLs. Reconnect files after import.
const read = (key, fallback) => {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
  catch { return fallback; }
};
const write = (key, value) => {
  try { localStorage.setItem(key, JSON.stringify(value)); return true; }
  catch { return false; }
};

export function storedTrack(track) {
  const copy = { ...track };
  for (const key of ["src", "cover"]) {
    if (String(copy[key] || "").startsWith("blob:")) copy[key] = null;
  }
  return copy;
}

export function resolveTrack(entry, library) {
  if (!entry) return null;
  const found = library.find((track) => track.id === entry.id ||
    (entry.source === "local" && track.source === "local" &&
      (entry.fileKey ? track.fileKey === entry.fileKey :
        track.filePath === entry.id?.replace(/^local:/, "").replace(/:\d+$/, ""))));
  if (found) return found;
  return entry.source !== "local" && entry.src && !entry.src.startsWith("blob:") ? entry : null;
}

export function loadQueue() {
  const saved = read("sur.queue.v1", {});
  const queue = Array.isArray(saved.queue) ? saved.queue.filter((t) => t && typeof t.id === "string") : [];
  const currentIndex = Number.isInteger(saved.currentIndex) && saved.currentIndex >= 0 && saved.currentIndex < queue.length
    ? saved.currentIndex : queue.length ? 0 : null;
  return { queue, currentIndex };
}
export const saveQueue = (queue, currentIndex) => write("sur.queue.v1", { queue: queue.map(storedTrack), currentIndex });
export function loadFavorites() {
  const entries = read("sur.favorites.v1", []);
  return Array.isArray(entries) ? entries.filter((t) => t && typeof t.id === "string") : [];
}
export const saveFavorites = (entries) => write("sur.favorites.v1", entries.map(storedTrack));

export function removeQueueTrack(queue, currentIndex, index) {
  if (index < 0 || index >= queue.length) return { queue, currentIndex };
  const next = queue.filter((_, i) => i !== index);
  const selected = !next.length ? null : currentIndex === null ? null : index < currentIndex
    ? currentIndex - 1 : Math.min(currentIndex, next.length - 1);
  return { queue: next, currentIndex: selected };
}

export function moveQueueTrack(queue, currentIndex, from, to) {
  if (from < 0 || to < 0 || from >= queue.length || to >= queue.length) return { queue, currentIndex };
  const order = queue.map((track, index) => ({ track, index }));
  const [entry] = order.splice(from, 1);
  order.splice(to, 0, entry);
  return { queue: order.map((item) => item.track), currentIndex: currentIndex === null ? null :
    order.findIndex((item) => item.index === currentIndex) };
}
