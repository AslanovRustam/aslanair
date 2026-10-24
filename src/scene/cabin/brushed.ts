/**
 * Brushed steel for the galley (spec r4 §8.3): a size × size greyscale of fine horizontal streaks — each row its own
 * shade, blended with the next, with a little grain along it — so the steel breaks the light into lines instead of
 * reading as a flat mirror. Deterministic for a seed.
 */
export function brushedTexels(size: number, seed: number): Uint8Array {
  let state = (seed * 48271) % 2147483647 || 1;
  const rnd = () => (state = (state * 16807) % 2147483647) / 2147483647;
  const rows = Array.from({ length: size }, () => rnd());
  const out = new Uint8Array(size * size);
  for (let y = 0; y < size; y++) {
    const base = 150 + 70 * (rows[y] - 0.5) + 30 * (rows[(y + 1) % size] - 0.5);
    for (let x = 0; x < size; x++) out[y * size + x] = Math.max(0, Math.min(255, Math.round(base + (rnd() - 0.5) * 8)));
  }
  return out;
}
