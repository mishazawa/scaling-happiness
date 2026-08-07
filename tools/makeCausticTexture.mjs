/**
 * Bakes `src/assets/caustics.png` — the seamless tile the caustics shader
 * samples (see `withCaustics` in `src/render/materials.ts`).
 *
 * Offline, run by hand: `node tools/makeCausticTexture.mjs`. Nothing imports it
 * and nothing runs at boot; it exists so the committed binary is reproducible
 * and tunable rather than being an opaque blob.
 *
 * The field is periodic *by construction* rather than by blending edges: value
 * noise on a lattice whose coordinates are taken modulo the lattice size, at
 * octave sizes that all divide the image, so the left edge and the right edge
 * read the same lattice corners. Ridging it (`1 - |2n - 1|`) turns the noise's
 * mid-level contour into connected filaments, which is the shape caustics have;
 * a power then sharpens them.
 *
 * Deliberately left softer than the final look: the shader multiplies two
 * scrolling copies of this tile, and that product is what sharpens the
 * filaments. Bake it sharp and the product is sparse dots instead of lines.
 */
import { deflateSync } from "node:zlib";
import { writeFileSync } from "node:fs";

const SIZE = 512;
// Lattice cells across the tile in the first octave. Each octave doubles, and
// all of them must divide SIZE for the wrap to be exact.
const BASE_LATTICE = 4;
const OCTAVES = 4;
/**
 * Filament width — higher is thinner. Tuned against what the *product* of two
 * samples comes out at, not against how the tile looks on its own: 8 lands the
 * combined field at a mean of 0.13 with ~14% of the surface above 0.3, which is
 * where the runtime math it replaces sat (0.17 / 14%). Overridable from the
 * environment for a quick sweep.
 */
const SHARPNESS = Number(process.env.SHARPNESS ?? 8);
const SEED = 20260807;

/** Deterministic hash of a lattice corner, in 0..1. */
function corner(x, y, lattice, octave) {
  let h = ((x % lattice) + lattice) % lattice;
  h = h * 374761393 + (((y % lattice) + lattice) % lattice) * 668265263;
  h = (h ^ (h >>> 13)) * 1274126177 + octave * 2654435761 + SEED;
  h = (h ^ (h >>> 16)) >>> 0;
  return h / 4294967296;
}

const smooth = (t) => t * t * t * (t * (t * 6 - 15) + 10);
const lerp = (a, b, t) => a + (b - a) * t;

/** One octave of periodic value noise, sampled at (u, v) in 0..1. */
function valueNoise(u, v, lattice, octave) {
  const x = u * lattice;
  const y = v * lattice;
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = smooth(x - x0);
  const fy = smooth(y - y0);

  const c00 = corner(x0, y0, lattice, octave);
  const c10 = corner(x0 + 1, y0, lattice, octave);
  const c01 = corner(x0, y0 + 1, lattice, octave);
  const c11 = corner(x0 + 1, y0 + 1, lattice, octave);

  return lerp(lerp(c00, c10, fx), lerp(c01, c11, fx), fy);
}

function field(u, v) {
  let sum = 0;
  let amplitude = 1;
  let total = 0;
  for (let octave = 0; octave < OCTAVES; octave++) {
    sum += valueNoise(u, v, BASE_LATTICE << octave, octave) * amplitude;
    total += amplitude;
    amplitude *= 0.5;
  }
  const n = sum / total;
  return Math.pow(1 - Math.abs(2 * n - 1), SHARPNESS);
}

const pixels = new Float64Array(SIZE * SIZE);
let peak = 0;
for (let y = 0; y < SIZE; y++) {
  for (let x = 0; x < SIZE; x++) {
    const v = field(x / SIZE, y / SIZE);
    pixels[y * SIZE + x] = v;
    if (v > peak) peak = v;
  }
}

const gray = new Uint8Array(SIZE * SIZE);
for (let i = 0; i < pixels.length; i++) {
  gray[i] = Math.round((pixels[i] / peak) * 255);
}

// --- seam check -----------------------------------------------------------
// A tile that does not wrap shows a grid line on the ground that no amount of
// layering hides. The edge-to-edge step has to be no worse than the image's own
// neighbouring-pixel step, which is what "seamless" means in practice.
const meanStep = (a, b) => {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += Math.abs(a[i] - b[i]);
  return sum / a.length;
};
const column = (x) =>
  Array.from({ length: SIZE }, (_, y) => gray[y * SIZE + x]);
const row = (y) => Array.from({ length: SIZE }, (_, x) => gray[y * SIZE + x]);

const wrapX = meanStep(column(SIZE - 1), column(0));
const wrapY = meanStep(row(SIZE - 1), row(0));
const interiorX = meanStep(column(SIZE >> 1), column((SIZE >> 1) + 1));
const interiorY = meanStep(row(SIZE >> 1), row((SIZE >> 1) + 1));

console.log(
  `seam  x: ${wrapX.toFixed(3)} vs interior ${interiorX.toFixed(3)}\n` +
    `seam  y: ${wrapY.toFixed(3)} vs interior ${interiorY.toFixed(3)}`,
);
if (wrapX > interiorX * 2 + 1 || wrapY > interiorY * 2 + 1) {
  throw new Error("tile does not wrap: edge step exceeds interior step");
}

// --- how the shader will actually see it ----------------------------------
// The shader multiplies two scrolled, differently scaled samples. These are the
// numbers to tune SHARPNESS against; the runtime math this replaces sat at a
// mean around 0.17 with ~14% of the surface above 0.3.
const sample = (u, v) => {
  const x = Math.round(((u % 1) + 1) % 1 * (SIZE - 1));
  const y = Math.round(((v % 1) + 1) % 1 * (SIZE - 1));
  return gray[y * SIZE + x] / 255;
};
let sum = 0;
let bright = 0;
const COUNT = 400;
for (let i = 0; i < COUNT; i++) {
  for (let j = 0; j < COUNT; j++) {
    const u = i / COUNT;
    const v = j / COUNT;
    const product =
      sample(u + 0.13, v + 0.07) * sample(u * 0.73 - 0.2, v * 0.73 + 0.31) * 2;
    sum += Math.min(1, product);
    bright += product > 0.3 ? 1 : 0;
  }
}
console.log(
  `product mean ${(sum / (COUNT * COUNT)).toFixed(3)}, ` +
    `frac>0.3 ${(bright / (COUNT * COUNT)).toFixed(3)}`,
);

// --- PNG ------------------------------------------------------------------
// 8-bit greyscale (colour type 0), hand-encoded rather than pulling in a
// dependency: three chunks and a CRC table is the whole format at this level.
const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buffer) {
  let c = 0xffffffff;
  for (const byte of buffer) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

const header = Buffer.alloc(13);
header.writeUInt32BE(SIZE, 0);
header.writeUInt32BE(SIZE, 4);
header[8] = 8; // bit depth
header[9] = 0; // colour type: greyscale
// Each scanline is prefixed with its filter byte; 0 (none) keeps this simple and
// still compresses well, the data being smooth.
const raw = Buffer.alloc(SIZE * (SIZE + 1));
for (let y = 0; y < SIZE; y++) {
  raw[y * (SIZE + 1)] = 0;
  Buffer.from(gray.subarray(y * SIZE, (y + 1) * SIZE)).copy(
    raw,
    y * (SIZE + 1) + 1,
  );
}

const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk("IHDR", header),
  chunk("IDAT", deflateSync(raw, { level: 9 })),
  chunk("IEND", Buffer.alloc(0)),
]);

const out = new URL("../src/assets/caustics.png", import.meta.url);
writeFileSync(out, png);
console.log(`wrote ${out.pathname} (${(png.length / 1024).toFixed(1)} kB)`);
