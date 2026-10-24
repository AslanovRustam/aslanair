import { describe, expect, test } from 'vitest';
import { trackProgress } from '@/experience/chapters';
import { cellOf, gridOpacity, trailAlpha } from '@/experience/grid';

const pre = (id: Parameters<typeof trackProgress>[1], t: number) => trackProgress('pre', id, t);

describe('the grid backdrop', () => {
  test('it covers every dark chapter before boarding', () => {
    for (const [id, t] of [['sky', 0.3], ['destinations', 0.5], ['transfer', 0.5], ['ready', 0.5]] as const) {
      expect(gridOpacity('browse', pre(id, t)), `${id} ${t}`).toBe(1);
    }
  });

  test('it fades out on the way to the door, before the camera is inside', () => {
    expect(gridOpacity('browse', pre('door', 0.15))).toBe(1);
    const mid = gridOpacity('browse', pre('door', 0.3));
    expect(mid).toBeGreaterThan(0);
    expect(mid).toBeLessThan(1);
    expect(gridOpacity('browse', pre('door', 0.5))).toBe(0);
  });

  test('inside the cabin, in the seat and after the seat is confirmed it is gone', () => {
    expect(gridOpacity('browse', pre('aisle', 0.3))).toBe(0);
    expect(gridOpacity('seated', pre('aisle', 0.3))).toBe(0);
    for (const p of [0, 0.5, 1]) {
      expect(gridOpacity('confirmed', p)).toBe(0);
      expect(gridOpacity('thanks', p)).toBe(0);
    }
  });

  test('a lit cell fades from full to nothing over 600 ms, never brightening on the way', () => {
    expect(trailAlpha(0)).toBe(1);
    expect(trailAlpha(600)).toBe(0);
    expect(trailAlpha(900)).toBe(0);
    let last = 1;
    for (let ms = 0; ms <= 600; ms += 20) {
      expect(trailAlpha(ms)).toBeLessThanOrEqual(last);
      last = trailAlpha(ms);
    }
  });

  test('a point falls in the 64 px cell that holds it', () => {
    expect(cellOf(130, 70)).toEqual([2, 1]);
    expect(cellOf(0, 0)).toEqual([0, 0]);
    expect(cellOf(63.9, 64)).toEqual([0, 1]);
  });
});
