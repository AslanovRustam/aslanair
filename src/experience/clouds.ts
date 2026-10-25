/**
 * The night's clouds (spec r4 §9): a photographed cloud sea far below, and moon-lit sprite puffs between it and the
 * plane. Metres, in the world (the aircraft cruises at y ≈ 0).
 *
 * The cloud sea: a disc `radius` across at height `y`, its photo laid at `tile` metres across — shifted from place to
 * place so it never shows as a repeat (CLOUD_SEA_FRAGMENT).
 */
export const CLOUD_SEA = { y: -600, radius: 40_000, tile: 1800 } as const;

/** The night's two images, loaded after the journey starts (never under the loader); sources in their CREDITS.md. */
export const SKY_IMAGES = { stars: '/images/sky/stars.webp', cloudSea: '/images/sky/cloud-sea.webp' } as const;

/**
 * The puffs: `count` camera-facing sprites in clusters of `cluster` puffs, filling a `box` × `box` field round the
 * camera between the layer's `bottom` and `top` (every puff wholly under the top), `sizeMin`–`sizeMax` across,
 * drifting with the `wind` (m/s) and wrapped round the camera so the field never runs out.
 */
export const PUFFS = {
  count: 360,
  layer: { bottom: -320, top: -90 },
  box: 3000,
  sizeMin: 40,
  sizeMax: 140,
  cluster: [6, 14],
  spread: 180,
  wind: [-55, 0, 6],
} as const;

export interface Puff {
  centre: [number, number, number];
  size: number;
  /** Its cluster's centre: the puff's moon-lit side faces away from it. */
  cluster: [number, number, number];
}

/** A seeded generator in [0, 1). */
function random(seed: number): () => number {
  let state = (seed * 48271) % 2147483647 || 1;
  return () => (state = (state * 16807) % 2147483647) / 2147483647;
}

/** The puffs for a seed: clusters spread over the field, each a heap of puffs round its centre. */
export function puffLayout(seed: number): Puff[] {
  const rnd = random(seed);
  const { count, layer, box, sizeMin, sizeMax, cluster, spread } = PUFFS;
  const half = box / 2;
  const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
  const puffs: Puff[] = [];
  while (puffs.length < count) {
    const c: [number, number, number] = [(rnd() - 0.5) * box, layer.bottom + 60 + rnd() * (layer.top - layer.bottom - 120), (rnd() - 0.5) * box];
    const n = cluster[0] + Math.floor(rnd() * (cluster[1] - cluster[0] + 1));
    for (let k = 0; k < n && puffs.length < count; k++) {
      const size = sizeMin + rnd() * (sizeMax - sizeMin);
      // a heap: wider than tall, the bigger puffs nearer the middle
      const r = spread * Math.sqrt(rnd()) * (1 - (size - sizeMin) / (2 * (sizeMax - sizeMin)));
      const a = rnd() * 2 * Math.PI;
      const y = clamp(c[1] + (rnd() - 0.4) * 50, layer.bottom, layer.top - size / 2);
      puffs.push({ centre: [clamp(c[0] + r * Math.cos(a), -half, half), y, clamp(c[2] + r * Math.sin(a), -half, half)], size, cluster: c });
    }
  }
  return puffs;
}

/** `v` moved by whole `box`es to within `box / 2` of `centre`. */
export function wrapAround(v: number, centre: number, box: number): number {
  return ((((v - centre + box / 2) % box) + box) % box) - box / 2 + centre;
}

/**
 * A puff's sprite: size × size RGBA, white, its alpha a billowy blob — a round falloff whose edge a few octaves of
 * value noise break into lobes (the noise fades out towards the rim, so the blob never reaches the border), denser
 * in its middle. Deterministic for a seed.
 */
export function puffTexels(size: number, seed: number): Uint8Array {
  const rnd = random(seed);
  const lattice = Array.from({ length: 4 }, (_, o) => {
    const g = 4 << o;
    return { g, values: Float32Array.from({ length: g * g }, rnd) };
  });
  const noise = (u: number, v: number) => {
    let sum = 0;
    let weight = 0.5;
    for (const { g, values } of lattice) {
      const [x, y] = [u * g, v * g];
      const [x0, y0] = [Math.floor(x), Math.floor(y)];
      const [tx, ty] = [x - x0, y - y0].map((t) => t * t * (3 - 2 * t));
      const at = (i: number, j: number) => values[(((j % g) + g) % g) * g + (((i % g) + g) % g)];
      const top = at(x0, y0) + (at(x0 + 1, y0) - at(x0, y0)) * tx;
      const bottom = at(x0, y0 + 1) + (at(x0 + 1, y0 + 1) - at(x0, y0 + 1)) * tx;
      sum += weight * (top + (bottom - top) * ty);
      weight /= 2;
    }
    return sum / 0.9375;
  };
  const out = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const [u, v] = [(x + 0.5) / size, (y + 0.5) / size];
      const r = Math.hypot(u - 0.5, v - 0.5) * 2;
      const n = noise(u, v);
      const shape = 1 - r + (n - 0.5) * 0.9 * Math.max(0, 1 - r * r);
      const lobe = Math.min(1, Math.max(0, (shape - 0.05) / 0.4));
      const border = x === 0 || y === 0 || x === size - 1 || y === size - 1;
      const a = border ? 0 : lobe * lobe * (3 - 2 * lobe) * (0.8 + 0.2 * n);
      out.set([255, 255, 255, Math.round(a * 255)], (y * size + x) * 4);
    }
  }
  return out;
}
