import { parseLrc, activeLineAt } from "./lyrics.js";

let failed = 0;
const check = (name, actual, expected) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failed += 1;
  console.log(`${ok ? "ok  " : "FAIL"}  ${name.padEnd(42)} -> ${JSON.stringify(actual)}`);
};

const sample = [
  "[ar:Various]",
  "[00:35.71] முன்பே வா என் அன்பே வா",
  "[00:39.14] ஊனே வா உயிரே வா",
  "[01:02.5] பூப்பூவாய்",
  "[02:00] கடைசி வரி",
].join("\n");

const lines = parseLrc(sample);

check("metadata tags ignored", lines.length, 4);
check("mm:ss.cc parsed", lines[0].time, 35.71);
check("two-digit fraction", lines[2].time, 62.5);
check("no fraction", lines[3].time, 120);
check("Tamil text preserved", lines[0].text, "முன்பே வா என் அன்பே வா");

// A repeated phrase carries several timestamps on one line.
check("repeated timestamps expand", parseLrc("[00:10.00][00:20.00] chorus").map((l) => l.time), [10, 20]);
check("out-of-order input is sorted", parseLrc("[00:20.00] b\n[00:05.00] a").map((l) => l.text), ["a", "b"]);
check("empty input", parseLrc(""), []);
check("plain text, no stamps", parseLrc("just words\nmore words"), []);

check("before first line", activeLineAt(lines, 0), -1);
check("exactly on a line", activeLineAt(lines, 35.71), 0);
check("between lines", activeLineAt(lines, 40), 1);
check("after last line", activeLineAt(lines, 9999), 3);
check("empty lyrics", activeLineAt([], 12), -1);

console.log(failed ? `\n${failed} failed` : "\nall passed");
process.exit(failed ? 1 : 0);
