// YouTube — the compliant way.
//
// Playback happens in YouTube's own IFrame player, which must stay VISIBLE:
// hiding it to use as an audio-only source breaks YouTube's terms, as does
// extracting or proxying the media stream. We never touch the audio; YouTube
// serves the ads and the rights-holders get paid.

const IFRAME_API = "https://www.youtube.com/iframe_api";
const OEMBED = "https://www.youtube.com/oembed";
const DATA_API = "https://www.googleapis.com/youtube/v3/search";
const KEY_STORE = "sur.youtubeKey";

// A key baked in at build time serves everyone using a hosted copy; a key typed
// into Settings overrides it for that device. Restrict a shared key by HTTP
// referrer in Google Cloud so only your domain can spend the quota.
const BUILD_KEY = import.meta.env?.VITE_YOUTUBE_API_KEY || "";

export const getApiKey = () => localStorage.getItem(KEY_STORE) || BUILD_KEY;
export const hasSharedKey = () => Boolean(BUILD_KEY);
export const setApiKey = (key) => localStorage.setItem(KEY_STORE, key.trim());

/** Accepts a full URL, a share link, an embed link, or a bare 11-character id. */
export function parseYouTubeId(input) {
  const text = String(input || "").trim();
  if (/^[\w-]{11}$/.test(text)) return text;
  try {
    const url = new URL(text);
    if (url.hostname === "youtu.be") return url.pathname.slice(1, 12) || null;
    if (url.searchParams.get("v")) return url.searchParams.get("v").slice(0, 11);
    const path = url.pathname.match(/\/(embed|shorts|live)\/([\w-]{11})/);
    if (path) return path[2];
  } catch {
    // not a URL
  }
  return null;
}

/** Title/channel/thumbnail for a video — public, no API key. */
export async function fetchVideoInfo(id) {
  const params = new URLSearchParams({ url: `https://www.youtube.com/watch?v=${id}`, format: "json" });
  const res = await fetch(`${OEMBED}?${params}`);
  if (!res.ok) throw new Error("That video isn't available (it may be private or removed).");
  const data = await res.json();
  return {
    id,
    title: data.title,
    channel: data.author_name,
    thumbnail: data.thumbnail_url,
  };
}

const PROXY = "/api/youtube";

/** True when a deployed serverless proxy is answering, so no key is needed here. */
let proxyAvailable = null;

async function searchViaProxy(query) {
  const res = await fetch(`${PROXY}?q=${encodeURIComponent(query)}`);
  // A static host with no function returns the SPA's index.html, not JSON.
  const isJson = res.headers.get("content-type")?.includes("application/json");
  if (!isJson) return null;

  const body = await res.json();
  if (!res.ok) throw new Error(body.error || `Search failed (${res.status})`);
  return body.items;
}

/** Search via the proxy when deployed; otherwise fall back to a client-side key. */
export async function searchYouTube(query, apiKey) {
  if (proxyAvailable !== false) {
    try {
      const items = await searchViaProxy(query);
      if (items) {
        proxyAvailable = true;
        return items;
      }
      proxyAvailable = false;
    } catch (e) {
      proxyAvailable = true;   // proxy answered, it just failed — report honestly
      throw e;
    }
  }

  if (!apiKey) throw new Error("No search key set, and no server proxy is deployed.");

  // Bias toward Tamil music with real API parameters rather than by appending
  // "tamil" to the query, which wrecks exact song titles.
  const base = {
    part: "snippet", type: "video", videoEmbeddable: "true",
    maxResults: "24", q: query, key: apiKey,
    regionCode: "IN", relevanceLanguage: "ta",
  };

  let res = await fetch(`${DATA_API}?${new URLSearchParams({ ...base, videoCategoryId: "10" })}`);
  // Not every region/param combination accepts a category filter; drop it and retry.
  if (res.status === 400) res = await fetch(`${DATA_API}?${new URLSearchParams(base)}`);

  if (!res.ok) {
    // Google returns 403 for several very different problems; say which.
    const reason = await res.json()
      .then((body) => body?.error?.errors?.[0]?.reason || "")
      .catch(() => "");
    const explain = {
      quotaExceeded: "Daily quota used up (100 searches). It resets at midnight Pacific.",
      dailyLimitExceeded: "Daily quota used up. It resets at midnight Pacific.",
      keyInvalid: "That API key isn't valid — check for stray spaces when pasting.",
      ipRefererBlocked: "The key is restricted and this site isn't on its allowed list. In Google Cloud, set Application restrictions to None, or add this origin as an allowed HTTP referrer.",
      accessNotConfigured: "YouTube Data API v3 isn't enabled for that key's project. Enable it in Google Cloud → APIs & Services → Library.",
      forbidden: "Request refused. Usually the YouTube Data API v3 isn't enabled on the key's project.",
    }[reason];
    throw new Error(explain || `YouTube search failed (${res.status}${reason ? `: ${reason}` : ""})`);
  }

  return (await res.json()).items.map((item) => ({
    id: item.id.videoId,
    title: item.snippet.title,
    channel: item.snippet.channelTitle,
    thumbnail: item.snippet.thumbnails?.medium?.url,
  }));
}

/** Keyless fallback: YouTube's own results page, opened in a new tab. */
export function youtubeSearchUrl(query) {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
}

let apiReady = null;

export function loadIframeApi() {
  if (apiReady) return apiReady;
  apiReady = new Promise((resolve) => {
    if (window.YT?.Player) return resolve(window.YT);
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      resolve(window.YT);
    };
    const script = document.createElement("script");
    script.src = IFRAME_API;
    document.head.appendChild(script);
  });
  return apiReady;
}
