// Upholstery weave as a tangent-space normal map: a 2/2 twill height field, 4 threads per period.
// Pure (no three.js) so the texels can be tested; materials.ts wraps them in a DataTexture.

const THREADS = 4;

/** Height of the weave at texel (x, y), periodic in `period`. */
function height(x: number, y: number, period: number): number {
  const u = (((x % period) + period) % period) / period * THREADS;
  const v = (((y % period) + period) % period) / period * THREADS;
  const i = Math.floor(u);
  const j = Math.floor(v);
  const warpOnTop = (i + j) % 4 < 2;
  // a rounded thread profile across the thread that is on top
  const across = warpOnTop ? u - i : v - j;
  return Math.sin(Math.PI * across) * (warpOnTop ? 1 : 0.85);
}

/** RGBA texels (size × size) of the weave's normals; tiles every `period` texels. */
export function weaveNormals(size: number, period: number, strength = 0.35): Uint8Array {
  const out = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (height(x + 1, y, period) - height(x - 1, y, period)) / 2;
      const dy = (height(x, y + 1, period) - height(x, y - 1, period)) / 2;
      const nx = -dx * strength;
      const ny = -dy * strength;
      const len = Math.hypot(nx, ny, 1);
      const i = (y * size + x) * 4;
      out[i] = Math.round((nx / len + 1) * 127.5);
      out[i + 1] = Math.round((ny / len + 1) * 127.5);
      out[i + 2] = Math.round((1 / len + 1) * 127.5);
      out[i + 3] = 255;
    }
  }
  return out;
}
