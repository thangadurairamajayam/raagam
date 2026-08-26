import { resolveMusicDirector, stripSiteSpam, cleanAlbumName } from "./metadata.js";

const cases = [
  [{ composer: "Yuvan Shnakar Raja" }, "Yuvan Shankar Raja", "typo"],
  [{ composer: "Yuvanshankar Raja,Tanvi Shah" }, "Yuvan Shankar Raja", "singer list"],
  [{ composer: "Hariharan", album: "Yuvan hits" }, "Yuvan Shankar Raja", "singer + album alias"],
  [{ creator: "Ilayaraja", album: "Ilayaraja Melodies" }, "Ilaiyaraaja", "alias"],
  [{ album: 'Vinnaithaandi Varuvaayaa (A.R. Rahman)' }, "A.R. Rahman", "bracketed"],
  [{ album: "Kaakha Kaakha - Harris Jayaraj" }, "Harris Jayaraj", "dash"],
  [{ composer: "From \"Baana\"" }, "Unknown", "junk rejected"],
  [{ album: "Some Album (2010)" }, "Unknown", "year rejected"],
  [{ composer: "Some Local Composer" }, "Some Local Composer", "unknown kept"],
];
let fail = 0;
for (const [input, expected, label] of cases) {
  const got = resolveMusicDirector(input);
  const ok = got === expected;
  if (!ok) fail++;
  console.log(`${ok ? "ok  " : "FAIL"}  ${label.padEnd(22)} -> ${got}`);
}
console.log("---");
for (const [raw, expected] of [
  ["Aagaya Thamarai - oldtamilmp3.com", "Aagaya Thamarai"],
  ["Munbe Vaa (www.tamilwire.com)", "Munbe Vaa"],
  ["Song | starmusiq.com", "Song"],
  ["Normal Title", "Normal Title"],
]) {
  const got = stripSiteSpam(raw);
  const ok = got === expected;
  if (!ok) fail++;
  console.log(`${ok ? "ok  " : "FAIL"}  "${raw}" -> "${got}"`);
}
console.log(fail ? `\n${fail} FAILED` : "\nall passed");

// regressions found in the browser
import { resolveMusicDirector as rd, resolveActor } from "./metadata.js";
console.log("--- regressions ---");
const extra = [
  [rd({ composer: "TamilWire.com", album: "Illayaraja Greatest Hits" }), "Ilaiyaraaja", "domain rejected + double-L alias"],
  [rd({ composer: "www.starmusiq.com" }), "Unknown", "bare domain -> Unknown"],
  [resolveActor("Ghilli (Vijay)"), "Vijay", "actor from album"],
  [resolveActor("Thalaivar 170 songs"), "Rajinikanth", "actor alias"],
  [resolveActor("Some Random Album"), "Unknown", "no actor"],
];
let f = 0;
for (const [got, want, label] of extra) {
  const ok = got === want; if (!ok) f++;
  console.log(`${ok ? "ok  " : "FAIL"}  ${label.padEnd(32)} -> ${got}`);
}
console.log(f ? `${f} FAILED` : "regressions all passed");
