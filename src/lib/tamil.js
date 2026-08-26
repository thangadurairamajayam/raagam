// Tamil text handling for search.
//
// A regional library mixes scripts: the same song is "முன்பே வா" in one file's
// tags and "Munbe Vaa" in another's. Both are transliterated to a common form so
// either spelling finds either file.

const VOWELS = {
  "அ": "a", "ஆ": "aa", "இ": "i", "ஈ": "ii", "உ": "u", "ஊ": "uu",
  "எ": "e", "ஏ": "ee", "ஐ": "ai", "ஒ": "o", "ஓ": "oo", "ஔ": "au",
};

// Vowel signs replace the consonant's inherent "a".
const SIGNS = {
  "ா": "aa", "ி": "i", "ீ": "ii", "ு": "u", "ூ": "uu",
  "ெ": "e", "ே": "ee", "ை": "ai", "ொ": "o", "ோ": "oo", "ௌ": "au",
};

const CONSONANTS = {
  "க": "k", "ங": "ng", "ச": "ch", "ஞ": "nj", "ட": "t", "ண": "n",
  "த": "th", "ந": "n", "ப": "p", "ம": "m", "ய": "y", "ர": "r",
  "ல": "l", "வ": "v", "ழ": "zh", "ள": "l", "ற": "r", "ன": "n",
  "ஜ": "j", "ஷ": "sh", "ஸ": "s", "ஹ": "h", "க்ஷ": "ksh", "ஶ": "sh",
};

const PULLI = "\u0BCD"; // virama: silences the inherent vowel
const AYTHAM = "ஃ";

export function transliterateTamil(text) {
  const chars = [...String(text || "")];
  let out = "";

  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];
    if (VOWELS[ch]) { out += VOWELS[ch]; continue; }
    if (ch === AYTHAM) { out += "h"; continue; }

    if (CONSONANTS[ch]) {
      out += CONSONANTS[ch];
      const nextCh = chars[i + 1];
      if (nextCh === PULLI) { i++; continue; }          // bare consonant
      if (SIGNS[nextCh]) { out += SIGNS[nextCh]; i++; continue; }
      out += "a";                                        // inherent vowel
      continue;
    }
    if (SIGNS[ch] || ch === PULLI) continue;             // stray mark
    out += ch;
  }
  return out;
}

const hasTamil = (text) => /[\u0b80-\u0bff]/.test(text);

/**
 * Fold text to a comparable form. Tamil doesn't distinguish voiced from unvoiced
 * consonants, so the same song is romanised "Munbe" or "Munpe" — those must land
 * on one key, as must the doubled vowels transliteration produces.
 */
export function searchNormalise(text) {
  const base = hasTamil(text) ? transliterateTamil(text) : String(text || "");
  return base
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/zh/g, "l")          // Tamizh / Tamil
    .replace(/dh|th/g, "t")
    .replace(/[bp]/g, "p")
    .replace(/[dt]/g, "t")
    .replace(/[gk]/g, "k")
    .replace(/([aeiou])\1+/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}
