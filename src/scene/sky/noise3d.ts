const OCTAVES: [lattice: number, weight: number][] = [
  [4, 0.45],
  [8, 0.3],
  [16, 0.17],
  [32, 0.08],
];

const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);

/**
 * Tileable 3D value noise (four octaves, quintic fade) baked into size³ bytes.
 * Sampled by the cloud shader as a repeating R8 3D texture.
 */
export function bakeNoise3D(size: number, seed: number): Uint8Array {
  let state = seed;
  const rnd = () => (state = (state * 16807) % 2147483647) / 2147483647;
  const lattices = OCTAVES.map(([g]) => Float32Array.from({ length: g * g * g }, rnd));
  const data = new Uint8Array(size * size * size);

  for (let z = 0; z < size; z++) {
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        let v = 0;
        OCTAVES.forEach(([g, w], k) => {
          const lat = lattices[k];
          const fx = (x / size) * g, fy = (y / size) * g, fz = (z / size) * g;
          const x0 = Math.floor(fx), y0 = Math.floor(fy), z0 = Math.floor(fz);
          const tx = fade(fx - x0), ty = fade(fy - y0), tz = fade(fz - z0);
          const at = (i: number, j: number, l: number) => lat[((l % g) * g + (j % g)) * g + (i % g)];
          const lx = (j: number, l: number) => at(x0, j, l) + (at(x0 + 1, j, l) - at(x0, j, l)) * tx;
          const ly = (l: number) => lx(y0, l) + (lx(y0 + 1, l) - lx(y0, l)) * ty;
          v += w * (ly(z0) + (ly(z0 + 1) - ly(z0)) * tz);
        });
        data[(z * size + y) * size + x] = Math.max(0, Math.min(255, Math.round(v * 255)));
      }
    }
  }
  return data;
}
