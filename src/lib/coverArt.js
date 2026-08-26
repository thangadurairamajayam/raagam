// Cover art from open sources.
//
// Google Images has no free API, its results are themselves copyrighted, and
// scraping breaks their terms — so art comes from the Cover Art Archive, found
// via a MusicBrainz release lookup. Coverage of Tamil film albums is partial;
// callers fall back to a generated tile.

const MB_SEARCH = "https://musicbrainz.org/ws/2/release";
const CAA = "https://coverartarchive.org/release";
const CACHE_KEY = "sur.coverCache.v1";
const MB_MIN_INTERVAL = 1100; // MusicBrainz asks for <= 1 request/second

let cache = {};
try {
  cache = JSON.parse(localStorage.getItem(CACHE_KEY) || "{}");
} catch {
  cache = {};
}

function remember(key, value) {
  cache[key] = value;
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    // Quota exceeded — running without a persisted cache is fine.
  }
}

// Serialise every MusicBrainz call through one queue to honour the rate limit.
let chain = Promise.resolve();
let lastCall = 0;

function scheduled(task) {
  const run = async () => {
    const wait = Math.max(0, MB_MIN_INTERVAL - (Date.now() - lastCall));
    if (wait) await new Promise((r) => setTimeout(r, wait));
    lastCall = Date.now();
    return task();
  };
  chain = chain.then(run, run);
  return chain;
}

const clean = (s) =>
  String(s || "")
    .replace(/["\\]/g, " ")
    .replace(/\b(songs?|jukebox|hits|melodies|collection|audio|mp3|full|vol\.?\s*\d+)\b/gi, " ")
    .replace(/\s{2,}/g, " ")
    .trim();

/**
 * Resolve a front-cover URL for an album, or null when nothing is found.
 * Results (including misses) are cached in localStorage.
 */
export async function lookupCover(album, artist = "") {
  const title = clean(album);
  if (title.length < 3) return null;

  const key = `${title}|${clean(artist)}`.toLowerCase();
  if (key in cache) return cache[key];

  return scheduled(async () => {
    if (key in cache) return cache[key]; // filled while queued
    try {
      const terms = [`release:"${title}"`, "tag:tamil"];
      if (clean(artist)) terms.push(`artist:"${clean(artist)}"`);
      const params = new URLSearchParams({ query: terms.join(" AND "), fmt: "json", limit: "3" });

      const res = await fetch(`${MB_SEARCH}?${params}`);
      // 503/429 mean rate-limited, not "no art" — caching that would poison the
      // cache permanently, so leave the key unset and retry another time.
      if (res.status === 503 || res.status === 429) return null;
      if (!res.ok) throw new Error(String(res.status));

      const releases = (await res.json()).releases || [];
      for (const release of releases) {
        if (release.score < 80) break;
        const url = `${CAA}/${release.id}/front-250`;
        const head = await fetch(url, { method: "HEAD" });
        if (head.ok) {
          remember(key, url);
          return url;
        }
      }
      remember(key, null); // searched properly, genuinely nothing there
      return null;
    } catch {
      return null; // transient: don't remember
    }
  });
}
