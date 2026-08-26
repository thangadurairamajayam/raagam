// Podcasts — the one category that is genuinely ad-free by design.
//
// Music streaming has ads because ads pay the per-stream royalty to rights
// holders. Podcasts have no such royalty: publishers hand out an open RSS feed
// precisely so any client can fetch it. There is no platform tax to skip, so
// nothing here is a workaround — it is the intended way to consume a feed.
//
// (Episodes may still contain host-read sponsor segments baked into the audio.
// Those are part of the recording, not an injected ad break, and removing them
// would mean altering someone else's work.)

const SUBS_KEY = "raagam.podcasts.v1";

// Verified reachable and Tamil-language. Kept short and honest: this is a
// starting point, not a directory. Real coverage comes from adding feed URLs.
export const CURATED = [
  {
    title: "SBS Tamil — SBS தமிழ்",
    feed: "https://sbs-ondemand.streamguys1.com/sbs-tamil/",
    note: "Daily news from Australia's Tamil public broadcaster",
  },
  {
    title: "Celibacy Tamil Yoga Meditations",
    feed: "https://anchor.fm/s/ee4a2470/podcast/rss",
    note: "Yoga and meditation talks",
  },
  {
    title: "NPA Talk",
    feed: "https://anchor.fm/s/3e9990ec/podcast/rss",
    note: "Conversation and commentary",
  },
  {
    title: "Mind Voyz — Tamil Podcast",
    feed: "https://rss.buzzsprout.com/2054487.rss",
    note: "Psychology and self-development",
  },
  {
    title: "Naragar Naduvil — நரகர் நடுவில்",
    feed: "https://anchor.fm/s/e26cae98/podcast/rss",
    note: "Storytelling",
  },
];

/** "1:02:03" | "3:04" | "245" -> seconds */
function parseDuration(raw) {
  if (!raw) return 0;
  const text = raw.trim();
  if (/^\d+$/.test(text)) return Number(text);
  const parts = text.split(":").map(Number);
  if (parts.some(Number.isNaN)) return 0;
  return parts.reduce((total, part) => total * 60 + part, 0);
}

function text(node, selector) {
  return node.querySelector(selector)?.textContent?.trim() || "";
}

// itunes:* needs getElementsByTagName: querySelector can't match namespaced tags.
function nsText(node, local) {
  const hit = node.getElementsByTagName(`itunes:${local}`)[0] || node.getElementsByTagName(local)[0];
  return hit?.textContent?.trim() || "";
}

function nsAttr(node, local, attr) {
  const hit = node.getElementsByTagName(`itunes:${local}`)[0];
  return hit?.getAttribute(attr) || "";
}

function parseFeed(xml, feedUrl) {
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  if (doc.querySelector("parsererror")) throw new Error("That URL didn't return a valid podcast feed.");

  const channel = doc.querySelector("channel");
  if (!channel) throw new Error("That URL isn't an RSS podcast feed.");

  const showTitle = text(channel, "title") || "Untitled podcast";
  const showImage = nsAttr(channel, "image", "href") || channel.querySelector("image > url")?.textContent?.trim() || null;

  const episodes = [...channel.querySelectorAll("item")]
    .map((item, index) => {
      const enclosure = item.querySelector("enclosure");
      const src = enclosure?.getAttribute("url") || "";
      if (!src) return null;
      const published = text(item, "pubDate");
      return {
        id: `podcast:${feedUrl}:${text(item, "guid") || src || index}`,
        title: text(item, "title") || `Episode ${index + 1}`,
        artist: showTitle,
        album: showTitle,
        director: "Unknown",
        actor: "Unknown",
        genre: "Podcast",
        subtitle: published ? new Date(published).toLocaleDateString() : "",
        duration: parseDuration(nsText(item, "duration")),
        live: false,
        src,
        cover: nsAttr(item, "image", "href") || showImage,
        source: "podcast",
        feed: feedUrl,
        published,
      };
    })
    .filter(Boolean);

  return {
    feed: feedUrl,
    title: showTitle,
    image: showImage,
    description: nsText(channel, "summary") || text(channel, "description"),
    episodes,
  };
}

/**
 * Roughly a third of podcast hosts omit CORS headers, so a direct browser fetch
 * fails for reasons we can't fix client-side. Retry through the serverless
 * proxy when one is deployed.
 */
export async function loadFeed(feedUrl) {
  const attempts = [feedUrl, `/api/feed?url=${encodeURIComponent(feedUrl)}`];
  let lastError;

  for (const url of attempts) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Feed responded ${res.status}`);
      return parseFeed(await res.text(), feedUrl);
    } catch (e) {
      lastError = e;
    }
  }

  throw new Error(
    `Couldn't load that feed. Its host blocks direct browser access, which needs the feed proxy deployed. (${lastError?.message || "unknown error"})`
  );
}

/**
 * Apple's directory has the real Tamil coverage but no CORS, so it's reached
 * through our proxy. fyyd is keyless and CORS-open, so it still works when the
 * proxy isn't deployed — its Tamil index is just tiny.
 */
export async function searchPodcasts(query) {
  const q = query.trim();
  if (!q) return [];

  try {
    const res = await fetch(`/api/podcasts?term=${encodeURIComponent(q)}`);
    if (res.headers.get("content-type")?.includes("application/json")) {
      const body = await res.json();
      if (res.ok && body.shows?.length) {
        return body.shows.map((s) => ({
          title: s.title,
          feed: s.feed,
          image: s.image,
          note: [s.author, s.episodes ? `${s.episodes} episodes` : ""].filter(Boolean).join(" · "),
        }));
      }
    }
  } catch {
    // proxy not deployed or unreachable — fall through
  }

  const res = await fetch(`https://api.fyyd.de/0.2/search/podcast?title=${encodeURIComponent(q)}&count=40`);
  if (!res.ok) throw new Error(`Podcast search failed (${res.status})`);
  const { data = [] } = await res.json();
  return data
    .filter((p) => p.xmlURL)
    .map((p) => ({
      title: p.title || "Untitled",
      feed: p.xmlURL,
      image: p.imgURL || null,
      note: [p.language, p.episode_count ? `${p.episode_count} episodes` : ""].filter(Boolean).join(" · "),
    }));
}

export function loadSubscriptions() {
  try {
    const saved = JSON.parse(localStorage.getItem(SUBS_KEY) || "null");
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
}

export function saveSubscriptions(subs) {
  localStorage.setItem(SUBS_KEY, JSON.stringify(subs));
}

export function isSubscribed(subs, feedUrl) {
  return subs.some((s) => s.feed === feedUrl);
}

export function toggleSubscription(subs, show) {
  return isSubscribed(subs, show.feed)
    ? subs.filter((s) => s.feed !== show.feed)
    : [...subs, { title: show.title, feed: show.feed, image: show.image || null }];
}
