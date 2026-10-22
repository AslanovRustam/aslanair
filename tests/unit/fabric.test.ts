import { describe, expect, test } from 'vitest';
import { weaveNormals } from '@/scene/cabin/fabric';

describe('fabric weave normal map', () => {
  test('weave texels are unit normals tilted around +Z', () => {
    const t = weaveNormals(64, 16);
    for (let i = 0; i < 64 * 64; i++) {
      const [x, y, z] = [0, 1, 2].map((k) => t[i * 4 + k] / 127.5 - 1);
      expect(Math.hypot(x, y, z)).toBeCloseTo(1, 1);
      expect(z).toBeGreaterThan(0.7);
    }
  });

  test('the weave tiles every period texels', () => {
    const t = weaveNormals(64, 16);
    for (let y = 0; y < 64; y++) {
      for (let x = 0; x < 48; x++) {
        expect(t.subarray((y * 64 + x) * 4, (y * 64 + x) * 4 + 3)).toEqual(t.subarray((y * 64 + x + 16) * 4, (y * 64 + x + 16) * 4 + 3));
      }
    }
  });
});
