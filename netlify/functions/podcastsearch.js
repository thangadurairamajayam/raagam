// Podcast search via Apple's directory.
//
// Apple's Search API has by far the best Tamil coverage, but it sends no CORS
// headers so a browser can't call it directly. Proxying server-side sidesteps
// that — and it's a public, keyless endpoint, so nothing is being circumvented.

const SEARCH = "https://itunes.apple.com/search";

export async function handler(event) {
  const term = (event.queryStringParameters?.term || "").trim();
  const country = (event.queryStringParameters?.country || "IN").slice(0, 2).toUpperCase();

  const json = (statusCode, body) => ({
    statusCode,
    headers: { "content-type": "application/json", "cache-control": "public, max-age=3600" },
    body: JSON.stringify(body),
  });

  if (!term) return json(400, { error: "Missing search term." });

  const params = new URLSearchParams({
    term, media: "podcast", entity: "podcast", limit: "200", country,
  });

  try {
    const res = await fetch(`${SEARCH}?${params}`);
    if (!res.ok) return json(res.status, { error: `Apple search failed (${res.status}).` });

    const { results = [] } = await res.json();
    const shows = results
      .filter((r) => r.feedUrl)
      .map((r) => ({
        title: r.collectionName,
        feed: r.feedUrl,
        image: r.artworkUrl600 || r.artworkUrl100 || null,
        author: r.artistName || "",
        episodes: r.trackCount || 0,
        genres: r.genres || [],
      }));

    return json(200, { shows });
  } catch (e) {
    return json(502, { error: `Couldn't reach the podcast directory: ${e.message}` });
  }
}
