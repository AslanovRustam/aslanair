import { describe, expect, test } from 'vitest';
import { brushedTexels } from '@/scene/cabin/brushed';

/** Mean of the variances along each row (or down each column) of a size × size single-channel image. */
function variance(t: Uint8Array, size: number, alongRows: boolean): number {
  let total = 0;
  for (let a = 0; a < size; a++) {
    let [sum, sq] = [0, 0];
    for (let b = 0; b < size; b++) {
      const v = t[alongRows ? a * size + b : b * size + a];
      sum += v;
      sq += v * v;
    }
    total += sq / size - (sum / size) ** 2;
  }
  return total / size;
}

describe('brushed steel', () => {
  test('the same seed brushes the same steel', () => {
    expect(brushedTexels(64, 1)).toEqual(brushedTexels(64, 1));
    expect(brushedTexels(64, 2)).not.toEqual(brushedTexels(64, 1));
  });

  test('its streaks run sideways: little change along a row, much down a column', () => {
    const t = brushedTexels(64, 1);
    expect(t).toHaveLength(64 * 64);
    expect(variance(t, 64, false)).toBeGreaterThanOrEqual(4 * variance(t, 64, true));
  });
});
