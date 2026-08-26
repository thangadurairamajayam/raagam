// Serverless proxy for YouTube search.
//
// The key lives here, in the server environment, and is never sent to the
// browser. Set YOUTUBE_API_KEY in your host's environment variables — note the
// name has no VITE_ prefix, so Vite can't inline it into the bundle.

const DATA_API = "https://www.googleapis.com/youtube/v3/search";

const FAILURES = {
  quotaExceeded: "Daily quota used up (100 searches). It resets at midnight Pacific.",
  dailyLimitExceeded: "Daily quota used up. It resets at midnight Pacific.",
  keyInvalid: "The server's API key isn't valid.",
  accessNotConfigured: "YouTube Data API v3 isn't enabled for that key's project.",
};

export async function handler(event) {
  const key = process.env.YOUTUBE_API_KEY;
  const query = (event.queryStringParameters?.q || "").trim();

  const json = (statusCode, body) => ({
    statusCode,
    headers: { "content-type": "application/json", "cache-control": "public, max-age=600" },
    body: JSON.stringify(body),
  });

  if (!key) return json(500, { error: "Server is missing YOUTUBE_API_KEY." });
  if (!query) return json(400, { error: "Missing search term." });

  const params = new URLSearchParams({
    part: "snippet", type: "video", videoEmbeddable: "true",
    maxResults: "24", q: query, key,
    regionCode: "IN", relevanceLanguage: "ta",
  });

  try {
    let res = await fetch(`${DATA_API}?${params}&videoCategoryId=10`);
    if (res.status === 400) res = await fetch(`${DATA_API}?${params}`);

    if (!res.ok) {
      const reason = await res.json()
        .then((b) => b?.error?.errors?.[0]?.reason || "")
        .catch(() => "");
      return json(res.status, { error: FAILURES[reason] || `YouTube search failed (${res.status})` });
    }

    const items = (await res.json()).items.map((item) => ({
      id: item.id.videoId,
      title: item.snippet.title,
      channel: item.snippet.channelTitle,
      thumbnail: item.snippet.thumbnails?.medium?.url,
    }));
    return json(200, { items });
  } catch (e) {
    return json(502, { error: `Could not reach YouTube: ${e.message}` });
  }
}
