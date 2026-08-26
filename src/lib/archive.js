// Internet Archive source — free, publicly hosted audio with a real API.
// Metadata endpoints send Access-Control-Allow-Origin: *, so the browser can
// call them directly with no proxy.

import { resolveMusicDirector, cleanAlbumName, normaliseGenre, stripSiteSpam, isJunkArtist, resolveActor, canonicaliseQuery } from "./metadata.js";

const SEARCH = "https://archive.org/advancedsearch.php";
const META = "https://archive.org/metadata";
const DOWNLOAD = "https://archive.org/download";
const COVER = "https://archive.org/services/img";

// Full-text "tamil" drags in thousands of news podcasts, Quran recitations and
// lectures, which outrank songs on download count. Require a Tamil catalogue
// entry and exclude spoken-word audio.
const TAMIL =
  '(subject:"Tamil" OR subject:"Tamil Song" OR subject:"Tamil Songs" OR language:"Tamil" OR language:"tam" OR title:"tamil")';

// Excluding spoken word beats demanding music keywords: requiring a positive
// music tag cut the free-licensed catalogue from ~1400 to ~137, because most
// music uploads simply aren't tagged that way.
const NOT_SPOKEN = [
  "Podcast", "Quran", "lecture", "speech", "sermon", "audiobook", "news",
  "bayan", "interview", "discourse", "story", "bible", "talk", "radio",
].map((t) => `-subject:"${t}"`).join(" AND ") +
  ' AND -collection:"podcasts" AND -collection:"librivoxaudio"' +
  ' AND ' + ["quran", "lecture", "sermon", "audiobook", "bayan", "interview", "discourse", "upanyasam", "stories", "bible"]
    .map((t) => `-title:"${t}"`).join(" AND ");

// Live Archive counts at build time: free-licensed ~1400, songs ~2200 (all
// uploads), jukebox ~139, devotional ~147, folk ~131, carnatic ~112,
// instrumental ~41, bgm ~14, ost ~10. BGM and OST are tiny because that
// material is licensed and isn't legally free anywhere.
export const CATEGORIES = [
  { id: "all", label: "Everything", query: "" },
  { id: "songs", label: "Songs", query: '(subject:song OR subject:songs OR title:songs OR subject:"film songs")' },
  { id: "movie", label: "Film & Movie", query: '(subject:film OR subject:movie OR subject:cinema OR subject:filmi OR title:movie OR title:film)' },
  { id: "jukebox", label: "Jukebox & Hits", query: "(title:jukebox OR subject:jukebox OR title:collection OR title:hits OR title:melodies)" },
  { id: "devotional", label: "Devotional", query: "(subject:devotional OR subject:bhakti OR title:devotional OR subject:thevaram OR subject:bhajan)" },
  { id: "carnatic", label: "Carnatic & Vocal", query: "(subject:carnatic OR subject:classical OR subject:vocal OR title:vocal OR subject:keerthanai)" },
  { id: "concerts", label: "Concerts", query: '(subject:concert OR title:concert OR title:kutcheri OR subject:kutcheri OR title:sabha OR title:"live at")' },
  { id: "folk", label: "Folk & Gaana", query: "(subject:folk OR title:folk OR subject:gaana OR subject:villupattu OR subject:oppari)" },
  { id: "instrumental", label: "Instrumental", query: "(subject:instrumental OR title:instrumental OR subject:veena OR subject:flute OR subject:nadaswaram)" },
  { id: "bgm", label: "BGM & Themes", query: '(subject:bgm OR title:bgm OR subject:"background score" OR title:"theme music" OR title:theme)' },
  { id: "ost", label: "OST", query: "(subject:soundtrack OR title:soundtrack OR subject:ost OR title:ost)" },
];

const LICENCE_LABELS = [
  [/publicdomain|mark\/1\.0/i, "Public Domain"],
  [/zero|cc0/i, "CC0"],
  [/by-nc-sa/i, "CC BY-NC-SA"],
  [/by-nc-nd/i, "CC BY-NC-ND"],
  [/by-nc/i, "CC BY-NC"],
  [/by-sa/i, "CC BY-SA"],
  [/by-nd/i, "CC BY-ND"],
  [/\/by\//i, "CC BY"],
];

function licenceLabel(url) {
  if (!url) return null;
  const found = LICENCE_LABELS.find(([re]) => re.test(url));
  return found ? found[1] : "Free licence";
}

const AUDIO_FORMATS = /^(VBR MP3|128Kbps MP3|64Kbps MP3|MP3|Ogg Vorbis|Flac)$/i;

function buildQuery({ query = "", category = "all", freeOnly = false }) {
  const parts = [TAMIL, "mediatype:audio", NOT_SPOKEN];
  const categoryQuery = CATEGORIES.find((c) => c.id === category)?.query;
  if (categoryQuery) parts.push(categoryQuery);
  if (freeOnly) parts.push("licenseurl:[* TO *]");
  const term = canonicaliseQuery(query);
  if (term.trim()) parts.push(`(${term.trim()})`);
  return parts.join(" AND ");
}

/** How many items match, ignoring paging. Used to report what a filter is hiding. */
export async function countArchive(options = {}) {
  const params = new URLSearchParams({ q: buildQuery(options), rows: "0", output: "json" });
  const res = await fetch(`${SEARCH}?${params}`);
  if (!res.ok) return 0;
  return (await res.json()).response?.numFound || 0;
}

export async function searchArchive({ query = "", category = "all", freeOnly = false, rows = 48, page = 1 } = {}) {
  const params = new URLSearchParams({
    q: buildQuery({ query, category, freeOnly }),
    rows: String(rows), page: String(page), output: "json",
  });
  for (const field of ["identifier", "title", "creator", "subject", "year", "downloads", "licenseurl"]) {
    params.append("fl[]", field);
  }
  params.append("sort[]", "downloads desc");

  const res = await fetch(`${SEARCH}?${params}`);
  if (!res.ok) throw new Error(`Archive search failed (${res.status})`);
  const body = await res.json();

  return (body.response?.docs || []).map((doc) => ({
    id: doc.identifier,
    title: cleanAlbumName(stripSiteSpam(doc.title), doc.identifier),
    rawTitle: doc.title || doc.identifier,
    creator: (() => {
      const c = Array.isArray(doc.creator) ? doc.creator[0] : doc.creator;
      return isJunkArtist(c) ? "" : c;
    })(),
    genre: normaliseGenre(doc.subject),
    year: doc.year || "",
    licence: licenceLabel(doc.licenseurl),
    cover: `${COVER}/${doc.identifier}`,
  }));
}

/** Expand one archive item into playable tracks. */
export async function loadArchiveAlbum(item) {
  const res = await fetch(`${META}/${item.id}`);
  if (!res.ok) throw new Error(`Could not load "${item.title}" (${res.status})`);
  const data = await res.json();

  const md = data.metadata || {};
  const rawCreator = Array.isArray(md.creator) ? md.creator[0] : md.creator || item.creator;
  const creator = isJunkArtist(rawCreator) ? "" : rawCreator;
  const album = cleanAlbumName(stripSiteSpam(md.title || item.rawTitle), item.title);
  const genre = normaliseGenre(md.subject || item.genre);
  const licence = licenceLabel(md.licenseurl) || item.licence;

  // One MP3 per song: prefer VBR, and never list the same song twice in two formats.
  const bySong = new Map();
  for (const file of data.files || []) {
    if (!AUDIO_FORMATS.test(file.format || "")) continue;
    const key = (file.name || "").replace(/\.[^.]+$/, "");
    const isMp3 = /mp3/i.test(file.format);
    if (!bySong.has(key) || (isMp3 && !/mp3/i.test(bySong.get(key).format))) {
      bySong.set(key, file);
    }
  }

  return [...bySong.values()].map((file, index) => {
    const title = stripSiteSpam(
      (file.title || file.name.replace(/\.[^.]+$/, "")).replace(/_/g, " ")
    ) || file.name;
    // Prefer the file's own ID3 album: one archive item often holds many real
    // movie soundtracks, and the item title alone collapses them into one blob.
    const trackAlbum = file.album ? cleanAlbumName(stripSiteSpam(file.album), album) : album;
    const director = resolveMusicDirector({
      composer: file.creator, artist: file.artist, album: file.album || md.title, title, creator,
    });
    const artist = [file.artist, creator, director].find((v) => v && !isJunkArtist(v) && v !== "Unknown");
    return {
      id: `ia:${item.id}:${file.name}`,
      title,
      artist: artist || "Unknown artist",
      album: trackAlbum,
      director,
      actor: resolveActor(file.album, md.title, item.rawTitle, title, md.subject),
      genre: file.genre ? normaliseGenre(file.genre) : genre,
      year: md.year || item.year || "",
      duration: Number(file.length) || 0,
      track: Number(file.track) || index + 1,
      src: `${DOWNLOAD}/${item.id}/${encodeURIComponent(file.name)}`,
      cover: `${COVER}/${item.id}`,
      source: "archive",
      licence,
      pageUrl: `https://archive.org/details/${item.id}`,
    };
  }).sort((a, b) => a.track - b.track);
}
