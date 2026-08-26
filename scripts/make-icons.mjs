// Generates the PWA icons with no image tooling installed: a hand-rolled PNG
// encoder (raw deflate blocks + CRC), enough for flat-colour app icons.
//   node scripts/make-icons.mjs
import { writeFileSync, mkdirSync } from "node:fs";
import { deflateSync } from "node:zlib";

const OUT = new URL("../public/", import.meta.url);
mkdirSync(OUT, { recursive: true });

const BG = [20, 11, 24];        // --bg
const MARIGOLD = [242, 169, 59];
const ROSE = [236, 83, 130];

function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = c ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

/**
 * Draws the raagam mark: five equaliser bars on the app's dark background.
 * Bars stay legible at 48px where a vinyl disc turns to mush.
 */
function pixels(size) {
  const rows = [];
  const bars = 5;
  const gap = size * 0.045;
  const barW = (size * 0.58 - gap * (bars - 1)) / bars;
  const left = size * 0.21;
  // Relative heights, tallest in the middle.
  const heights = [0.30, 0.52, 0.72, 0.46, 0.34];
  const radius = barW * 0.5;

  for (let y = 0; y < size; y++) {
    const row = Buffer.alloc(size * 3);
    for (let x = 0; x < size; x++) {
      let colour = BG;
      for (let b = 0; b < bars; b++) {
        const x0 = left + b * (barW + gap);
        const h = size * heights[b];
        const y0 = (size - h) / 2;
        const y1 = y0 + h;
        if (x >= x0 && x < x0 + barW && y >= y0 && y < y1) {
          // Round the bar ends.
          const capY = y < y0 + radius ? y0 + radius - y : y > y1 - radius ? y - (y1 - radius) : 0;
          if (capY > 0) {
            const dx = Math.abs(x - (x0 + barW / 2));
            if (Math.hypot(dx, capY) > radius) continue;
          }
          colour = b % 2 === 0 ? MARIGOLD : ROSE;
        }
      }
      row.set(colour, x * 3);
    }
    rows.push(Buffer.concat([Buffer.from([0]), row])); // filter byte 0
  }
  return Buffer.concat(rows);
}

function png(size) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;   // bit depth
  ihdr[9] = 2;   // truecolour
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(pixels(size), { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

for (const size of [180, 192, 512]) {
  const file = new URL(`icon-${size}.png`, OUT);
  writeFileSync(file, png(size));
  console.log("wrote", file.pathname.split("/").pop(), `${size}x${size}`);
}
