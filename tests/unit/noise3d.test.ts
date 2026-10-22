import { describe, expect, test } from 'vitest';
import { bakeNoise3D } from '@/scene/sky/noise3d';

describe('baked 3D noise', () => {
  test('fills size³ voxels deterministically per seed', () => {
    const a = bakeNoise3D(16, 1337);
    expect(a).toHaveLength(16 * 16 * 16);
    expect(bakeNoise3D(16, 1337)).toEqual(a);
    expect(bakeNoise3D(16, 7)).not.toEqual(a);
  });

  test('is centred around mid-grey', () => {
    const a = bakeNoise3D(16, 1337);
    const mean = a.reduce((s, v) => s + v, 0) / a.length;
    expect(mean).toBeGreaterThan(100);
    expect(mean).toBeLessThan(155);
  });
});
