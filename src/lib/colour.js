// Dominant colour from cover art, used to tint the now-playing screen.
//
// Sampling a canvas taints it for cross-origin images unless the server allows
// it, so remote covers are fetched with crossOrigin and simply skipped when the
// host refuses — a null result falls back to the default theme.

const cache = new Map();

/** Skips near-black, near-white and grey pixels, which otherwise dominate the average. */
function pickVivid(data) {
  let best = null;
  let bestScore = -1;
  let rSum = 0;
  let gSum = 0;
  let bSum = 0;
  let counted = 0;

  for (let i = 0; i < data.length; i += 4) {
    const [r, g, b, a] = [data[i], data[i + 1], data[i + 2], data[i + 3]];
    if (a < 200) continue;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const lightness = (max + min) / 2;
    if (lightness < 30 || lightness > 225) continue;

    rSum += r; gSum += g; bSum += b; counted += 1;

    const saturation = max === min ? 0 : (max - min) / (255 - Math.abs(max + min - 255));
    const score = saturation * (1 - Math.abs(lightness - 128) / 128);
    if (score > bestScore) {
      bestScore = score;
      best = [r, g, b];
    }
  }

  if (!counted) return null;
  // A washed-out cover gives a poor "most vivid" pixel; the average reads better.
  return bestScore > 0.25 ? best : [rSum / counted, gSum / counted, bSum / counted].map(Math.round);
}

function toHsl([r, g, b]) {
  const [rf, gf, bf] = [r / 255, g / 255, b / 255];
  const max = Math.max(rf, gf, bf);
  const min = Math.min(rf, gf, bf);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };

  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === rf ? ((gf - bf) / d + (gf < bf ? 6 : 0))
    : max === gf ? (bf - rf) / d + 2
    : (rf - gf) / d + 4;

  return { h: h * 60, s, l };
}

/**
 * Resolves to an { h, s, l } hue for CSS, or null when the image can't be read.
 * Never rejects: a missing tint is a cosmetic loss, not an error.
 */
export function dominantColour(src) {
  if (!src) return Promise.resolve(null);
  if (cache.has(src)) return Promise.resolve(cache.get(src));

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";

    img.onload = () => {
      try {
        const size = 32;   // enough for an average, cheap to draw
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        ctx.drawImage(img, 0, 0, size, size);

        const rgb = pickVivid(ctx.getImageData(0, 0, size, size).data);
        const result = rgb ? toHsl(rgb) : null;
        cache.set(src, result);
        resolve(result);
      } catch {
        cache.set(src, null);   // tainted canvas
        resolve(null);
      }
    };

    img.onerror = () => {
      cache.set(src, null);
      resolve(null);
    };

    img.src = src;
  });
}
