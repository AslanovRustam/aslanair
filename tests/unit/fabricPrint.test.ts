import { describe, expect, test } from 'vitest';
import { fabricPrint } from '@/scene/cabin/fabricPrint';

describe('upholstery print', () => {
  test('the print is deterministic and stays navy', () => {
    const t = fabricPrint(128, 7);
    expect(fabricPrint(128, 7)).toEqual(t);
    let r = 0, g = 0, b = 0;
    for (let i = 0; i < t.length; i += 4) { r += t[i]; g += t[i + 1]; b += t[i + 2]; }
    expect(b).toBeGreaterThan(r * 1.3); // blue dominates
    expect(b / (t.length / 4)).toBeLessThan(170); // and stays dark
  });

  test('the print wraps without a seam', () => {
    const t = fabricPrint(128, 7);
    const col = (x: number) => Array.from({ length: 128 }, (_, y) => t[(y * 128 + x) * 4 + 2]);
    const diff = (a: number[], b: number[]) => a.reduce((s, v, i) => s + Math.abs(v - b[i]), 0) / a.length;
    expect(diff(col(127), col(0))).toBeLessThanOrEqual(diff(col(63), col(64)) + 4);
  });
});
