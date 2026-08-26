// Vercel equivalent of netlify/functions/youtube.js — same key-stays-server rule.
// Set YOUTUBE_API_KEY in the Vercel project's environment variables.

import { handler } from "../netlify/functions/youtube.js";

export default async function proxy(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const result = await handler({
    queryStringParameters: Object.fromEntries(url.searchParams),
  });
  res.status(result.statusCode);
  for (const [name, value] of Object.entries(result.headers || {})) res.setHeader(name, value);
  res.send(result.body);
}
