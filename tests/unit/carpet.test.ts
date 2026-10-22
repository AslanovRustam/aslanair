import { describe, expect, test } from 'vitest';
import { aisleRunnerTexels, carpetTexels } from '@/scene/cabin/carpet';

const SIZE = 128;
const mean = (t: Uint8Array) => {
  let s = 0;
  for (let i = 0; i < t.length; i += 4) s += (t[i] + t[i + 1] + t[i + 2]) / 3;
  return s / (t.length / 4);
};
const luma = (t: Uint8Array, x: number, y: number) => {
  const i = (y * SIZE + x) * 4;
  return (t[i] + t[i + 1] + t[i + 2]) / 3;
};
const diff = (a: number[], b: number[]) => a.reduce((s, v, i) => s + Math.abs(v - b[i]), 0) / a.length;
const column = (t: Uint8Array, x: number) => Array.from({ length: SIZE }, (_, y) => luma(t, x, y));
const row = (t: Uint8Array, y: number) => Array.from({ length: SIZE }, (_, x) => luma(t, x, y));

describe.each([
  ['carpet', carpetTexels],
  ['aisle runner', aisleRunnerTexels],
])('%s texels', (_, texels) => {
  test('are deterministic', () => {
    expect(texels(SIZE, 3)).toEqual(texels(SIZE, 3));
  });

  test('tile without a seam both ways', () => {
    const t = texels(SIZE, 3);
    expect(diff(column(t, SIZE - 1), column(t, 0))).toBeLessThanOrEqual(diff(column(t, SIZE / 2 - 1), column(t, SIZE / 2)) + 4);
    expect(diff(row(t, SIZE - 1), row(t, 0))).toBeLessThanOrEqual(diff(row(t, SIZE / 2 - 1), row(t, SIZE / 2)) + 4);
  });
});

describe('floor coverings', () => {
  test('the carpet is a dark blue-grey', () => {
    const t = carpetTexels(SIZE, 3);
    let r = 0, b = 0;
    for (let i = 0; i < t.length; i += 4) { r += t[i]; b += t[i + 2]; }
    expect(b).toBeGreaterThan(r * 1.1);
    expect(mean(t)).toBeLessThan(110);
  });

  test('the aisle runner reads as a different tone', () => {
    expect(Math.abs(mean(aisleRunnerTexels(SIZE, 3)) - mean(carpetTexels(SIZE, 3)))).toBeGreaterThanOrEqual(8);
  });

  test('the runner has thin border lines near both edges, across its width', () => {
    const t = aisleRunnerTexels(SIZE, 3);
    const rowMean = (y: number) => row(t, y).reduce((s, v) => s + v, 0) / SIZE;
    const middle = rowMean(SIZE / 2);
    const edges = [...Array(SIZE / 4).keys()].map((y) => rowMean(y));
    const far = [...Array(SIZE / 4).keys()].map((y) => rowMean(SIZE - 1 - y));
    expect(Math.max(...edges) - middle).toBeGreaterThan(20);
    expect(Math.max(...far) - middle).toBeGreaterThan(20);
  });
});
