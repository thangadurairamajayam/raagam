// Self-hosted source — Navidrome / Airsonic / Gonic / Jellyfin's Subsonic plugin.
//
// This is the ad-free route for music you already own: the server holds your own
// rips, speaks the Subsonic API, and streams straight to this player. No licence
// filter is needed because nothing here is redistributed — it's your library.
//
// Auth: Subsonic 1.13+ takes a salted MD5 token instead of the password, and the
// salt may be fixed per client. So we hash once at sign-in and persist only
// { salt, token } — the plaintext password never reaches localStorage.

import md5 from "blueimp-md5";
import { resolveMusicDirector, normaliseGenre, resolveActor, isJunkArtist } from "./metadata.js";

const KEY = "sur.subsonic.v1";
const CLIENT = "sur";
const VERSION = "1.16.1";

export function loadServer() {
  try {
    const cfg = JSON.parse(localStorage.getItem(KEY) || "null");
    return cfg && cfg.url && cfg.user && cfg.token ? cfg : null;
  } catch {
    return null;
  }
}

export function clearServer() {
  localStorage.removeItem(KEY);
}

/** Hash the password into a reusable token and persist the credential-free config. */
export function saveServer({ url, user, password }) {
  const salt = [...crypto.getRandomValues(new Uint8Array(8))]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  const cfg = {
    url: url.trim().replace(/\/+$/, ""),
    user: user.trim(),
    salt,
    token: md5(password + salt),
  };
  localStorage.setItem(KEY, JSON.stringify(cfg));
  return cfg;
}

function endpoint(cfg, method, params = {}) {
  const query = new URLSearchParams({
    u: cfg.user, t: cfg.token, s: cfg.salt, v: VERSION, c: CLIENT, f: "json", ...params,
  });
  return `${cfg.url}/rest/${method}?${query}`;
}

async function call(cfg, method, params) {
  // An https page cannot load an http stream, and the failure is otherwise silent.
  if (location.protocol === "https:" && cfg.url.startsWith("http://")) {
    throw new Error(
      "This page is served over https, so it can't reach an http:// server. " +
      "Put the server behind https (a reverse proxy or Tailscale) or open the app over http."
    );
  }

  let res;
  try {
    res = await fetch(endpoint(cfg, method, params));
  } catch {
    // fetch() hides CORS detail from the page, so name the usual cause.
    throw new Error(
      `Could not reach ${cfg.url}. Check the address, and that the server allows requests ` +
      "from this origin (Navidrome: ND_ENABLECORS=true)."
    );
  }
  if (!res.ok) throw new Error(`Server returned ${res.status}.`);

  const body = (await res.json())["subsonic-response"];
  if (!body) throw new Error("That address answered, but not with the Subsonic API.");
  if (body.status === "failed") {
    throw new Error(body.error?.code === 40 ? "Wrong username or password." : body.error?.message || "Server rejected the request.");
  }
  return body;
}

export async function pingServer(cfg) {
  await call(cfg, "ping.view");
  return true;
}

function coverUrl(cfg, id) {
  return id ? endpoint(cfg, "getCoverArt.view", { id, size: "400" }) : null;
}

function toAlbum(cfg, a) {
  return {
    id: a.id,
    title: a.name || a.album || "Unknown album",
    creator: a.artist || "",
    genre: normaliseGenre(a.genre),
    year: a.year || "",
    subtitle: [a.artist, a.songCount && `${a.songCount} songs`].filter(Boolean).join(" · "),
    cover: coverUrl(cfg, a.coverArt || a.id),
  };
}

/** Blank query lists the library; a query runs the server's own search index. */
export async function searchServer(cfg, { query = "", size = 60 } = {}) {
  if (!query.trim()) {
    const body = await call(cfg, "getAlbumList2.view", {
      type: "alphabeticalByName", size: String(size),
    });
    return (body.albumList2?.album || []).map((a) => toAlbum(cfg, a));
  }
  const body = await call(cfg, "search3.view", {
    query: query.trim(), artistCount: "0", songCount: "0", albumCount: String(size),
  });
  return (body.searchResult3?.album || []).map((a) => toAlbum(cfg, a));
}

/** Expand one server album into playable tracks. */
export async function loadServerAlbum(cfg, album) {
  const body = await call(cfg, "getAlbum.view", { id: album.id });
  const songs = body.album?.song || [];

  return songs.map((s, index) => {
    const artist = isJunkArtist(s.artist) ? "" : s.artist;
    const director = resolveMusicDirector({
      composer: s.composer, artist: s.artist, album: s.album || album.title, title: s.title,
      creator: album.creator,
    });
    return {
      id: `srv:${cfg.url}:${s.id}`,
      title: s.title || "Untitled",
      artist: artist || album.creator || "Unknown artist",
      album: s.album || album.title,
      director,
      actor: resolveActor(s.album, album.title, s.title, s.genre),
      genre: s.genre ? normaliseGenre(s.genre) : album.genre,
      year: s.year || album.year || "",
      duration: Number(s.duration) || 0,
      track: Number(s.track) || index + 1,
      src: endpoint(cfg, "stream.view", { id: s.id }),
      cover: coverUrl(cfg, s.coverArt || album.id),
      source: "server",
    };
  }).sort((a, b) => a.track - b.track);
}
