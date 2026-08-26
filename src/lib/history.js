// Recently played, persisted between sessions.
//
// Only streamable tracks are stored with a usable src: a local file's blob URL
// dies with the session, so those entries are kept for display and re-linked
// against the library when the folder is loaded again.

const RECENT_KEY = "sur.recent.v1";
const RESUME_KEY = "sur.resume.v1";
const MAX_RECENT = 30;

const read = (key, fallback) => {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
};

const write = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Quota exceeded — history is a nicety, not worth failing over.
  }
};

const slim = (track) => ({
  id: track.id,
  title: track.title,
  artist: track.artist,
  album: track.album,
  cover: track.cover,
  duration: track.duration,
  source: track.source,
  live: Boolean(track.live),
  src: track.source === "local" ? null : track.src,
});

export const loadRecent = () => read(RECENT_KEY, []);

export function pushRecent(track) {
  if (!track) return loadRecent();
  const entry = slim(track);
  const rest = loadRecent().filter((t) => t.id !== entry.id);
  const next = [entry, ...rest].slice(0, MAX_RECENT);
  write(RECENT_KEY, next);
  return next;
}

export const clearRecent = () => write(RECENT_KEY, []);

/** Where the last track had got to, so the app can offer to carry on. */
export function saveResume(track, position) {
  if (!track || track.live) return;
  write(RESUME_KEY, { track: slim(track), position: Math.floor(position || 0), at: Date.now() });
}

export function loadResume() {
  const saved = read(RESUME_KEY, null);
  // Anything under half a minute in isn't worth resuming.
  if (!saved?.track || saved.position < 30) return null;
  return saved;
}

export const clearResume = () => write(RESUME_KEY, null);

/** A stored entry is playable if it streams, or if the file is loaded again. */
export function resolveRecent(entry, tracks) {
  if (entry.src) return entry;
  return tracks.find((t) => t.id === entry.id) || null;
}
