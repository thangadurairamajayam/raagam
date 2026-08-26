// Synced lyrics from LRCLIB — an open, crowdsourced lyrics database.
//
// No key, CORS open, and it returns LRC-format timestamps, which is what makes
// karaoke-style highlighting possible. Coverage for Tamil film songs is good
// because contributors index by the romanised titles people actually search.

const API = "https://lrclib.net/api";
const CACHE_KEY = "raagam.lyrics.v1";

/** Cache misses too: re-asking for a song with no lyrics on every play is wasteful. */
function readCache() {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY) || "{}");
  } catch {
    return {};
  }
}

function writeCache(cache) {
  const entries = Object.entries(cache);
  // Keep the store bounded; oldest entries go first.
  const trimmed = entries.length > 300 ? Object.fromEntries(entries.slice(-300)) : cache;
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(trimmed));
  } catch {
    // storage full — losing the cache is harmless
  }
}

/** "[01:23.45] text" lines -> [{ time: 83.45, text }], sorted, blanks kept for pacing. */
export function parseLrc(lrc) {
  if (!lrc) return [];
  const lines = [];

  for (const raw of lrc.split("\n")) {
    // One line can carry several timestamps when a phrase repeats.
    const stamps = [...raw.matchAll(/\[(\d{1,3}):(\d{2})(?:[.:](\d{1,3}))?\]/g)];
    if (!stamps.length) continue;

    const text = raw.replace(/\[[^\]]*\]/g, "").trim();
    for (const [, min, sec, frac] of stamps) {
      const hundredths = frac ? Number(frac.padEnd(3, "0")) / 1000 : 0;
      lines.push({ time: Number(min) * 60 + Number(sec) + hundredths, text });
    }
  }

  return lines.sort((a, b) => a.time - b.time);
}

/** Index of the line that should be highlighted at `time`, or -1 before the first. */
export function activeLineAt(lines, time) {
  let lo = 0;
  let hi = lines.length - 1;
  let found = -1;

  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (lines[mid].time <= time) {
      found = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }

  return found;
}

function cacheKeyFor(track) {
  return `${track.artist || ""}|${track.title || ""}`.toLowerCase();
}

/**
 * Tries the exact-match endpoint first (needs artist + title + duration), then
 * falls back to a fuzzy search, which is what usually hits for Tamil tracks
 * whose tags don't match LRCLIB's spelling.
 */
export async function fetchLyrics(track) {
  if (!track || track.live) return null;

  const key = cacheKeyFor(track);
  const cache = readCache();
  if (key in cache) return cache[key];

  const title = (track.title || "").trim();
  if (!title) return null;
  const artist = (track.artist || "").trim();

  let hit = null;

  try {
    if (artist) {
      const exact = new URLSearchParams({ track_name: title, artist_name: artist });
      if (track.duration) exact.set("duration", String(Math.round(track.duration)));
      const res = await fetch(`${API}/get?${exact}`);
      if (res.ok) hit = await res.json();
    }

    if (!hit) {
      const res = await fetch(`${API}/search?q=${encodeURIComponent(`${title} ${artist}`.trim())}`);
      if (res.ok) {
        const results = await res.json();
        // Prefer a synced result even if a plain-text one ranks higher.
        hit = results.find((r) => r.syncedLyrics) || results[0] || null;
      }
    }
  } catch {
    return null;   // offline or blocked — don't cache, we may succeed later
  }

  const lyrics = hit && (hit.syncedLyrics || hit.plainLyrics)
    ? {
        synced: parseLrc(hit.syncedLyrics),
        plain: hit.plainLyrics || "",
        title: hit.trackName || title,
        artist: hit.artistName || artist,
      }
    : null;

  cache[key] = lyrics;
  writeCache(cache);
  return lyrics;
}
