// Serverless proxy for podcast RSS feeds.
//
// Podcast feeds are public and meant to be fetched by any client, but many hosts
// omit CORS headers, which browsers refuse to work around. This just relays the
// XML — no key, no auth, nothing hidden.

// Anyone can hit this endpoint, so restrict it to fetching podcast feeds over
// https and refuse anything that looks like an SSRF probe at internal hosts.
const BLOCKED_HOSTS = /^(localhost$|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|\[?::1\]?$)/i;

export async function handler(event) {
  const target = (event.queryStringParameters?.url || "").trim();

  const fail = (statusCode, error) => ({
    statusCode,
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ error }),
  });

  if (!target) return fail(400, "Missing feed url.");

  let url;
  try {
    url = new URL(target);
  } catch {
    return fail(400, "That isn't a valid URL.");
  }

  if (url.protocol !== "https:") return fail(400, "Only https feeds are allowed.");
  if (BLOCKED_HOSTS.test(url.hostname)) return fail(400, "That host isn't allowed.");

  try {
    const res = await fetch(url, {
      redirect: "follow",
      headers: { "user-agent": "raagam-podcasts/1.0", accept: "application/rss+xml, application/xml, text/xml" },
    });
    if (!res.ok) return fail(res.status, `Feed responded ${res.status}.`);

    const body = await res.text();
    if (body.length > 5_000_000) return fail(413, "That feed is too large.");

    return {
      statusCode: 200,
      headers: {
        "content-type": "application/xml; charset=utf-8",
        "cache-control": "public, max-age=900",
      },
      body,
    };
  } catch (e) {
    return fail(502, `Couldn't reach that feed: ${e.message}`);
  }
}
