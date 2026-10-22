// Printed upholstery: a navy base with soft tonal mottling, small light flecks and short thin strokes, as on the
// reference seats. Pure (no three.js) so the texels can be tested; materials.ts wraps them in a DataTexture.
// Everything is drawn with wrap-around, so the texture tiles without a seam.

const BASE = [37, 53, 107];
const INK = [150, 168, 212];
const LATTICE = 8;

/** Deterministic PRNG (mulberry32). */
export function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Periodic value noise in [-0.5, 0.5] on a LATTICE × LATTICE grid, sampled at size × size. */
export function mottle(size: number, rand: () => number): Float32Array {
  const grid = Array.from({ length: LATTICE * LATTICE }, () => rand() - 0.5);
  const at = (i: number, j: number) => grid[((j + LATTICE) % LATTICE) * LATTICE + ((i + LATTICE) % LATTICE)];
  const smooth = (t: number) => t * t * (3 - 2 * t);
  const out = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = (x / size) * LATTICE;
      const v = (y / size) * LATTICE;
      const i = Math.floor(u);
      const j = Math.floor(v);
      const fu = smooth(u - i);
      const fv = smooth(v - j);
      const top = at(i, j) + (at(i + 1, j) - at(i, j)) * fu;
      const bottom = at(i, j + 1) + (at(i + 1, j + 1) - at(i, j + 1)) * fu;
      out[y * size + x] = top + (bottom - top) * fv;
    }
  }
  return out;
}

/** RGBA sRGB texels (size × size) of the navy upholstery print; tiles seamlessly, deterministic per seed. */
export function fabricPrint(size: number, seed: number): Uint8Array {
  const rand = seeded(seed);
  const shade = mottle(size, rand);
  const ink = new Float32Array(size * size);
  const dab = (x: number, y: number, a: number) => {
    const i = (((Math.round(y) % size) + size) % size) * size + (((Math.round(x) % size) + size) % size);
    ink[i] = Math.max(ink[i], a);
  };
  for (let k = Math.round((size * size) / 90); k > 0; k--) {
    const x = rand() * size;
    const y = rand() * size;
    const a = 0.45 + 0.4 * rand();
    dab(x, y, a);
    if (rand() < 0.3) dab(x + 1, y, a * 0.7);
  }
  for (let k = Math.round((size * size) / 260); k > 0; k--) {
    const x = rand() * size;
    const y = rand() * size;
    const angle = rand() * Math.PI;
    const length = 3 + rand() * 5;
    for (let s = 0; s <= length; s += 0.5) dab(x + Math.cos(angle) * s, y + Math.sin(angle) * s, 0.4);
  }
  const out = new Uint8Array(size * size * 4);
  for (let i = 0; i < size * size; i++) {
    const tone = 1 + 0.14 * shade[i];
    for (let c = 0; c < 3; c++) out[i * 4 + c] = Math.round(BASE[c] * tone + (INK[c] - BASE[c] * tone) * ink[i]);
    out[i * 4 + 3] = 255;
  }
  return out;
}
