// Metadata normalisation for Tamil music files.
//
// The hard part is the music director. ID3 has no such field, so Tamil rips put
// it in the composer tag, in the album name ("Ayan (Harris Jayaraj)"), or nowhere
// at all. This resolves it in that order of confidence.

const KNOWN_DIRECTORS = [
  "Ilaiyaraaja", "A.R. Rahman", "Anirudh Ravichander", "Harris Jayaraj",
  "Yuvan Shankar Raja", "Devi Sri Prasad", "D. Imman", "G.V. Prakash Kumar",
  "Santhosh Narayanan", "Vidyasagar", "Deva", "M.S. Viswanathan",
  "K.V. Mahadevan", "Sirpy", "Bharadwaj", "Justin Prabhakaran", "Sean Roldan",
  "Govind Vasantha", "Hiphop Tamizha", "Thaman S", "Ghibran", "Vijay Antony",
  "Srikanth Deva", "James Vasanthan", "Dhina", "Karthik Raja", "Ramesh Vinayakam",
  "Leon James", "Sam C.S.", "Darbuka Siva", "Nivas K. Prasanna", "Ron Ethan Yohann",
  "Mani Sharma", "Joshua Sridhar", "Dharan Kumar",
];

// "a.r. rahman", "A R Rahman" and "AR Rahman" must all collapse to one key.
const normalise = (s) => (s || "").toLowerCase().replace(/[.\s_-]+/g, "");

// Tamil uploads rarely spell the full name — "Yuvan hits", "Ilayaraja Melodies".
const ALIASES = {
  yuvan: "Yuvan Shankar Raja",
  ilayaraja: "Ilaiyaraaja",
  ilayaraaja: "Ilaiyaraaja",
  ilaiyaraja: "Ilaiyaraaja",
  illayaraja: "Ilaiyaraaja",
  illayaraaja: "Ilaiyaraaja",
  raaja: "Ilaiyaraaja",
  arrahman: "A.R. Rahman",
  rahman: "A.R. Rahman",
  anirudh: "Anirudh Ravichander",
  imman: "D. Imman",
  harris: "Harris Jayaraj",
  thaman: "Thaman S",
  vidyasagar: "Vidyasagar",
  msviswanathan: "M.S. Viswanathan",
};

const CANONICAL = new Map([
  ...KNOWN_DIRECTORS.map((d) => [normalise(d), d]),
  ...Object.entries(ALIASES),
]);

// Longest keys first so "yuvan" can never win over "yuvanshankarraja".
const BY_LENGTH = [...CANONICAL.entries()].sort((a, b) => b[0].length - a[0].length);

// Rejects "(2010)", "(Original Motion Picture Soundtrack)", "[320kbps]" etc.
const NOT_A_NAME = /^(\d{4}|from\s.*|.*\b(kbps|mp3|flac|ost|soundtrack|original|motion|picture|remaster|vol\.?\s*\d+|cd\s*\d+)\b.*)$/i;

const BRACKETED = /[([{]\s*([^)\]}]+?)\s*[)\]}]/g;
const TRAILING_DASH = /\s[-–—]\s+([^-–—]{3,40})$/;

function cleanName(raw) {
  const name = (raw || "").trim().replace(/^(music|musical)?\s*(by|director)?[:\s-]+/i, "").trim();
  if (!name || name.length < 3 || name.length > 40 || NOT_A_NAME.test(name)) return null;
  if (DOMAIN.test(name)) return null; // "TamilWire.com" is not a composer
  return CANONICAL.get(normalise(name)) || name;
}

function editDistance(a, b) {
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let corner = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const next = Math.min(prev[j] + 1, prev[j - 1] + 1, corner + (a[i - 1] === b[j - 1] ? 0 : 1));
      corner = prev[j];
      prev[j] = next;
    }
  }
  return prev[b.length];
}

/** Tolerates the misspellings these uploads are riddled with ("Yuvan Shnakar Raja"). */
function matchKnown(candidate) {
  const key = normalise(candidate);
  if (!key) return null;
  if (CANONICAL.has(key)) return CANONICAL.get(key);
  for (const [known, canonical] of BY_LENGTH) {
    if (key.length > 6 && Math.abs(key.length - known.length) <= 3 && editDistance(key, known) <= 2) {
      return canonical;
    }
  }
  return null;
}

const splitNames = (value) =>
  String(value || "").split(/[,&/]|\band\b|\bfeat\.?\b/i).map((s) => s.trim()).filter(Boolean);

/** Find any known director mentioned anywhere in the supplied text. */
function findKnown(...fields) {
  for (const field of fields.filter(Boolean)) {
    for (const name of splitNames(field)) {
      const hit = matchKnown(name);
      if (hit) return hit;
    }
  }
  const hay = normalise(fields.filter(Boolean).join(" "));
  for (const [key, canonical] of BY_LENGTH) {
    if (key.length >= 5 && hay.includes(key)) return canonical;
  }
  return null;
}

export function resolveMusicDirector({ composer, artist, album, title, creator } = {}) {
  // A composer tag listing several people is really a singer list — these uploads
  // routinely put playback singers in the creator/composer field.
  const composerNames = splitNames(composer);
  for (const name of composerNames) {
    const hit = matchKnown(name);
    if (hit) return hit;
  }
  if (composerNames.length === 1) {
    // A lone unrecognised name is usually the playback singer, so let a known
    // director found on the album win before falling back to it.
    const fromContext = findKnown(album, title, creator);
    if (fromContext) return fromContext;
    const single = cleanName(composerNames[0]);
    if (single) return single;
  }

  const known = findKnown(artist, album, title, creator);
  if (known) return known;

  for (const source of [album, title, creator]) {
    if (!source) continue;
    for (const match of String(source).matchAll(BRACKETED)) {
      const name = cleanName(match[1]);
      if (name) return name;
    }
    const dash = String(source).match(TRAILING_DASH);
    if (dash) {
      const name = cleanName(dash[1]);
      if (name) return name;
    }
  }
  return "Unknown";
}

/** Strip the director/year noise back out so album tiles read cleanly. */
export function cleanAlbumName(album, fallback = "Singles") {
  if (!album) return fallback;
  const stripped = String(album)
    .replace(BRACKETED, (full, inner) => (cleanName(inner) || /^\d{4}$/.test(inner.trim()) ? "" : full))
    .replace(TRAILING_DASH, (full, tail) => (cleanName(tail) ? "" : full))
    .replace(/\s{2,}/g, " ")
    .trim();
  return stripped || String(album).trim() || fallback;
}

const GENRE_ALIASES = new Map([  ["film", "Film Songs"], ["filmi", "Film Songs"], ["cine", "Film Songs"],
  ["tamil song", "Film Songs"], ["tamil songs", "Film Songs"],
  ["carnatic", "Carnatic"], ["classical", "Carnatic"],
  ["devotional", "Devotional"], ["bhakti", "Devotional"], ["bhajan", "Devotional"],
  ["folk", "Folk"], ["gaana", "Gaana"], ["melody", "Melody"],
]);

export function normaliseGenre(raw) {
  const first = Array.isArray(raw) ? raw[0] : raw;
  const value = String(first || "").split(/[;,/]/)[0].trim();
  if (!value) return "Unsorted";
  return GENRE_ALIASES.get(value.toLowerCase()) || value.replace(/\b\w/g, (c) => c.toUpperCase());
}

// Free Tamil rips are almost always stamped with the site that hosted them
// ("Aagaya Thamarai - oldtamilmp3.com"). Strip it so titles read properly.
const DOMAIN = /(www\.)?[a-z0-9][a-z0-9-]*\.(com|net|org|in|co|info|me|tv|mobi|xyz|site|link)\b/i;
const TRAILING_DOMAIN = new RegExp(`[\\s\\-–—_|,:]+${DOMAIN.source}.*$`, "i");

export function stripSiteSpam(raw) {
  let text = String(raw || "");
  text = text.replace(/[([{][^)\]}]*[)\]}]/g, (chunk) => (DOMAIN.test(chunk) ? "" : chunk));
  let previous;
  do {
    previous = text;
    text = text.replace(TRAILING_DOMAIN, "");
  } while (text !== previous);
  return text.replace(/[\s\-–—_|,:]+$/, "").trim();
}

/** True when a tag holds a website rather than a person. */
export function isJunkArtist(value) {
  const text = String(value || "").trim();
  return !text || DOMAIN.test(text);
}

// Tamil film music is strongly associated with its lead actor, but no tag holds
// that, so it's matched from the album/film name.
const KNOWN_ACTORS = [
  "Rajinikanth", "Kamal Haasan", "Vijay", "Ajith Kumar", "Suriya", "Dhanush",
  "Silambarasan", "Vikram", "Sivakarthikeyan", "Vijay Sethupathi", "Karthi",
  "Jayam Ravi", "Arya", "Vishal", "Madhavan", "Prabhu Deva",
  "M.G.R.", "Sivaji Ganesan", "Gemini Ganesan", "Nayanthara",
  "Trisha", "Jyothika", "Samantha", "Keerthy Suresh", "Sridevi", "Revathi",
];

const ACTOR_ALIASES = {
  rajini: "Rajinikanth",
  thalaivar: "Rajinikanth",
  kamal: "Kamal Haasan",
  ulaganayagan: "Kamal Haasan",
  thala: "Ajith Kumar",
  ajith: "Ajith Kumar",
  thalapathy: "Vijay",
  mgr: "M.G.R.",
  sivaji: "Sivaji Ganesan",
  str: "Silambarasan",
  simbu: "Silambarasan",
};

const ACTORS = new Map([
  ...KNOWN_ACTORS.map((a) => [normalise(a), a]),
  ...Object.entries(ACTOR_ALIASES),
]);
const ACTORS_BY_LENGTH = [...ACTORS.entries()].sort((a, b) => b[0].length - a[0].length);

export function resolveActor(...fields) {
  for (const field of fields.filter(Boolean)) {
    // Split on words too, so short aliases like "STR hits" still resolve.
    for (const name of [...splitNames(field), ...String(field).split(/[\s_/\\.-]+/)]) {
      const hit = ACTORS.get(normalise(name));
      if (hit) return hit;
    }
  }
  const hay = normalise(fields.filter(Boolean).join(" "));
  for (const [key, canonical] of ACTORS_BY_LENGTH) {
    if (key.length >= 5 && hay.includes(key)) return canonical;
  }
  return "Unknown";
}

export const ACTOR_NAMES = KNOWN_ACTORS;
export const DIRECTOR_NAMES = KNOWN_DIRECTORS;

/**
 * Fix a search term's spelling against the names we know, so "yuvan sankar raja"
 * finds the archive's "Yuvan Shankar Raja". Returns the input untouched when it
 * isn't a recognisable name.
 */
export function canonicaliseQuery(query) {
  const text = String(query || "").trim();
  if (!text) return text;
  return matchKnown(text) || ACTORS.get(normalise(text)) || text;
}
