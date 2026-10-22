// Cabin floor coverings as texels: a blue-grey tufted carpet with a small geometric motif, and a darker aisle runner
// with a border line near each long edge. Pure (no three.js) so the texels can be tested; materials.ts wraps them in
// textures. Every pattern repeats an exact number of times per tile, so both tile without a seam.
import { mottle, seeded } from './fabricPrint';

type Ink = { color: number[]; a: number } | null;

// the cabin light reaches the floor at 40 % of its strength: the coverings are lighter than they look
const CARPET = [84, 92, 110];
const MOTIF = [122, 132, 152];
const RUNNER = [66, 76, 104];
const STRIPE = [54, 62, 88];
const BORDER = [190, 172, 140];
/** Motifs per carpet tile, each way. */
const CELLS = 8;

/** Tufted pile: a base colour with soft mottling and per-tuft grain, painted with `ink` where it returns a colour. */
function pile(size: number, seed: number, base: number[], ink: (x: number, y: number) => Ink): Uint8Array {
  const rand = seeded(seed);
  const tone = mottle(size, rand);
  const out = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = y * size + x;
      const grain = 1 + 0.12 * tone[i] + 0.08 * (rand() - 0.5);
      const paint = ink(x, y);
      for (let c = 0; c < 3; c++) {
        const b = base[c] * grain;
        out[i * 4 + c] = Math.round(paint ? b + (paint.color[c] * grain - b) * paint.a : b);
      }
      out[i * 4 + 3] = 255;
    }
  }
  return out;
}

/** RGBA sRGB texels of the cabin carpet: a diamond outline in every cell and a dot where four cells meet. */
export function carpetTexels(size: number, seed: number): Uint8Array {
  const cell = size / CELLS;
  return pile(size, seed, CARPET, (x, y) => {
    const u = (x % cell) - cell / 2 + 0.5;
    const v = (y % cell) - cell / 2 + 0.5;
    const d = Math.abs(u) + Math.abs(v);
    if (d > cell * 0.12 && d < cell * 0.22) return { color: MOTIF, a: 0.85 };
    if (Math.hypot(cell / 2 - Math.abs(u), cell / 2 - Math.abs(v)) < cell * 0.09) return { color: MOTIF, a: 0.5 };
    return null;
  });
}

/** RGBA sRGB texels of the aisle runner: rows run across the aisle (v), columns along it (u). A fine rib along the
 * length and a light border line near both long edges. */
export function aisleRunnerTexels(size: number, seed: number): Uint8Array {
  return pile(size, seed + 1, RUNNER, (x, y) => {
    const v = (y + 0.5) / size;
    if (Math.abs(v - 0.07) < 0.012 || Math.abs(v - 0.93) < 0.012) return { color: BORDER, a: 0.9 };
    return y % 4 === 0 ? { color: STRIPE, a: 0.6 } : null;
  });
}
