// node src/lib/regional.test.mjs
import { transliterateTamil, searchNormalise } from "./tamil.js";
import { inferFromPath } from "./localLibrary.js";
import { searchTracks } from "./grouping.js";

let failed = 0;
const check = (label, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failed++;
  console.log(`${ok ? "ok  " : "FAIL"}  ${label.padEnd(40)} -> ${JSON.stringify(got)}`);
};

console.log("--- transliteration ---");
check("முன்பே", transliterateTamil("முன்பே"), "munpee");
check("வா", transliterateTamil("வா"), "vaa");
check("இளையராஜா", transliterateTamil("இளையராஜா"), "ilaiyaraajaa");
check("latin untouched", transliterateTamil("Munbe Vaa"), "Munbe Vaa");

console.log("\n--- search folding ---");
check("tamil folds", searchNormalise("முன்பே வா"), "munpe va");
check("latin folds to same key", searchNormalise("Munbe Vaa"), "munpe va");
check("accents stripped", searchNormalise("Ilaiyaraajaa!"), "ilaiyaraja");
check("tamizh == tamil", searchNormalise("Tamizh"), searchNormalise("Tamil"));

console.log("\n--- folder inference ---");
check("composer/movie/track", inferFromPath("Ilaiyaraaja/Mouna Ragam/01 Nilave Vaa.mp3"),
  { album: "Mouna Ragam", artist: "Ilaiyaraaja" });
check("movie/track only", inferFromPath("Ghilli/02 Appadi Podu.mp3"),
  { album: "Ghilli", artist: "" });
check("bare file", inferFromPath("song.mp3"), { album: "", artist: "" });
check("site spam stripped", inferFromPath("starmusiq.com/Ayan/1.mp3"),
  { album: "Ayan", artist: "" });

console.log("\n--- cross-script search ---");
const library = [
  { title: "முன்பே வா", artist: "Shreya Ghoshal", album: "Sillunu Oru Kaadhal", director: "A.R. Rahman", actor: "Suriya", genre: "Film" },
  { title: "Appadi Podu", artist: "Tippu", album: "Ghilli", director: "Vidyasagar", actor: "Vijay", genre: "Film" },
];
check("latin query finds tamil title", searchTracks(library, "munbe").map((t) => t.album), ["Sillunu Oru Kaadhal"]);
check("tamil query finds tamil title", searchTracks(library, "முன்பே").map((t) => t.album), ["Sillunu Oru Kaadhal"]);
check("actor search", searchTracks(library, "vijay").map((t) => t.album), ["Ghilli"]);
check("no match", searchTracks(library, "zzzz"), []);


// unified search across films / directors / actors, not just loaded audio
import { searchEverything } from "./grouping.js";
import { FILMS } from "./films.js";
import { DIRECTOR_NAMES, ACTOR_NAMES } from "./metadata.js";
console.log("\n--- unified search ---");
const all = { tracks: [], films: FILMS, directors: DIRECTOR_NAMES, actors: ACTOR_NAMES };
const q = (s) => searchEverything(s, all);
check("film by name", q("minnale").films.map(f => f.title), ["Minnale"]);
check("film by year", q("2010").films.map(f => f.title).sort(),
  FILMS.filter(f => f.year === 2010).map(f => f.title).sort());
check("director found", q("harris").directors, ["Harris Jayaraj"]);
check("actor found", q("silambarasan").actors, ["Silambarasan"]);
check("composer finds his films", q("yuvan").films.length > 5, true);
check("misspelling tolerated", q("vinnaithandi varuvaya").films.map(f => f.title), ["Vinnaithaandi Varuvaayaa"]);
check("nonsense finds nothing", q("zzzzz").total, 0);
console.log(failed ? `\n${failed} FAILED` : "\nall passed");
process.exit(failed ? 1 : 0);
