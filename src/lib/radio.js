// Live radio — the legal route to current Tamil film music.
//
// Stations hold their own broadcast licences, so listening to a public stream is
// lawful. This is why radio carries the commercial music (Silambarasan, Anirudh,
// current releases) that no free download source legitimately can.
//
// Radio Browser is a community API: no key, CORS open, ~200 Tamil stations.

const API = "https://de1.api.radio-browser.info/json";

export async function searchStations({ query = "", limit = 80 } = {}) {
  const params = new URLSearchParams({
    limit: String(limit),
    hidebroken: "true",
    order: "clickcount",
    reverse: "true",
  });
  if (query.trim()) params.set("name", query.trim());
  else params.set("language", "tamil");

  const res = await fetch(`${API}/stations/search?${params}`);
  if (!res.ok) throw new Error(`Radio search failed (${res.status})`);

  const seen = new Set();
  return (await res.json())
    .filter((s) => {
      const url = s.url_resolved || s.url;
      // http:// streams are blocked as mixed content once the app is served over
      // https, so only keep secure ones.
      if (!url || !url.startsWith("https://") || seen.has(url)) return false;
      seen.add(url);
      return true;
    })
    .map((s) => ({
      id: `radio:${s.stationuuid}`,
      title: s.name.trim(),
      name: s.name.trim(),
      artist: [s.state, s.country].filter(Boolean).join(", ") || "Live radio",
      album: "Radio",
      director: "Unknown",
      actor: "Unknown",
      genre: "Radio",
      subtitle: `${s.countrycode || ""} ${s.bitrate ? `· ${s.bitrate}kbps` : ""}`.trim() || "Live",
      duration: 0,
      live: true,
      src: s.url_resolved || s.url,
      cover: s.favicon || null,
      source: "radio",
    }));
}
