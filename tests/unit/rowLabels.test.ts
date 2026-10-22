import { describe, expect, test } from 'vitest';
import { copy } from '@/content/copy';
import { rowLabelQuads } from '@/scene/cabin/rowLabels';

describe('row labels', () => {
  test('one label per row and side, each with its own atlas cell', () => {
    const q = rowLabelQuads();
    expect(q.position.length / 12).toBe(60);
    expect(q.index.length).toBe(60 * 6);
    const cells = new Set<string>();
    for (let i = 0; i < 60; i++) cells.add(Array.from(q.uv.subarray(i * 8, i * 8 + 8)).map((v) => v.toFixed(4)).join());
    expect(cells.size).toBe(60);
    expect(Math.min(...q.uv)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...q.uv)).toBeLessThanOrEqual(1);
  });

  test('labels read 14 ABC on the port side and 14 DEF on the starboard side', () => {
    expect(copy.cabin.rowLabel(14, -1)).toBe('14 ABC');
    expect(copy.cabin.rowLabel(14, 1)).toBe('14 DEF');
  });
});
