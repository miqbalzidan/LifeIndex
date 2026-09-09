/**
 * Draws the app icons.
 *
 * The mark is a crescent — a filled disc with a second disc cut out of it — in
 * the one accent colour on the app's own background. It matches the rest of the
 * app in having no gloss, no badge and no mascot, and it reads at 48px.
 *
 * PNGs are written by hand (zlib is in the standard library, an image
 * dependency is not). Run with `node scripts/make-icons.mjs`; output is
 * committed.
 */
import { deflateSync } from "node:zlib";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = resolve(ROOT, "public/icons");

const BG = [0x0e, 0x0d, 0x0c];
const ACCENT = [0xe0, 0xb9, 0x8d];

/** Smooths the curves; the crescent's inner edge is unforgiving without it. */
const SS = 4;

// --- PNG encoding ----------------------------------------------------------

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

/** `pixels` is RGB, row-major, 3 bytes per pixel. */
function encodePng(width, height, pixels) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type: truecolour
  // bytes 10–12: deflate, adaptive filtering, no interlace — all zero.

  // One filter byte per scanline; filter 0 (none) compresses fine for flat art.
  const stride = width * 3;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    pixels.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// --- the mark --------------------------------------------------------------

/**
 * `inset` is the share of the canvas kept clear around the mark. Maskable icons
 * need a wide margin because the platform crops them to its own shape.
 */
function drawCrescent(size, inset) {
  const n = size * SS;
  const acc = new Float64Array(n * n);

  const cx = n / 2;
  const cy = n / 2;
  const r = (n / 2) * (1 - inset);

  // The bite: a second disc, offset up and to the right, leaving a crescent
  // that opens toward the lower left.
  const bx = cx + r * 0.42;
  const by = cy - r * 0.3;
  const br = r * 0.86;

  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const px = x + 0.5;
      const py = y + 0.5;
      const inDisc = (px - cx) ** 2 + (py - cy) ** 2 <= r * r;
      const inBite = (px - bx) ** 2 + (py - by) ** 2 <= br * br;
      if (inDisc && !inBite) acc[y * n + x] = 1;
    }
  }

  // Box-downsample the supersampled coverage into the final pixel grid.
  const pixels = Buffer.alloc(size * size * 3);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let sum = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) sum += acc[(y * SS + sy) * n + (x * SS + sx)];
      }
      const a = sum / (SS * SS);
      const i = (y * size + x) * 3;
      for (let c = 0; c < 3; c++) {
        pixels[i + c] = Math.round(BG[c] + (ACCENT[c] - BG[c]) * a);
      }
    }
  }

  return encodePng(size, size, pixels);
}

/** Same geometry as `drawCrescent(512, 0.26)`, in vector form. */
const SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" role="img" aria-label="Nightly">
  <rect width="512" height="512" fill="#0e0d0c"/>
  <mask id="bite">
    <rect width="512" height="512" fill="#fff"/>
    <circle cx="335.5" cy="199.2" r="162.9" fill="#000"/>
  </mask>
  <circle cx="256" cy="256" r="189.4" fill="#e0b98d" mask="url(#bite)"/>
</svg>
`;

async function main() {
  await mkdir(OUT, { recursive: true });

  const files = [
    ["icon-192.png", drawCrescent(192, 0.26)],
    ["icon-512.png", drawCrescent(512, 0.26)],
    // Wider margin: platforms crop maskable icons to a circle or squircle.
    ["icon-512-maskable.png", drawCrescent(512, 0.38)],
    ["apple-touch-icon.png", drawCrescent(180, 0.26)],
    ["icon.svg", Buffer.from(SVG, "utf8")],
  ];

  for (const [name, data] of files) {
    await writeFile(resolve(OUT, name), data);
    console.log(`${name}  ${(data.length / 1024).toFixed(1)}kB`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
