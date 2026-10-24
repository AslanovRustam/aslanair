import { describe, expect, test } from 'vitest';
import { poseOnPostTrack } from '@/experience/cameraPoses';
import { trackProgress } from '@/experience/chapters';
import { CLOUD_SEA, PUFFS, puffLayout, puffTexels, wrapAround } from '@/experience/clouds';

describe('the sprite clouds', () => {
  test('a layer of clustered puffs below the plane, the same for a seed', () => {
    const puffs = puffLayout(1);
    expect(puffs).toHaveLength(PUFFS.count);
    expect(puffLayout(1)).toEqual(puffs);
    expect(puffLayout(2)).not.toEqual(puffs);
    for (const p of puffs) {
      expect(p.centre[1] + p.size / 2, 'top under the layer top').toBeLessThanOrEqual(PUFFS.layer.top + 1e-9);
      expect(p.centre[1]).toBeGreaterThanOrEqual(PUFFS.layer.bottom);
      expect(Math.abs(p.centre[0])).toBeLessThanOrEqual(PUFFS.box / 2);
      expect(Math.abs(p.centre[2])).toBeLessThanOrEqual(PUFFS.box / 2);
      expect(p.size).toBeGreaterThanOrEqual(PUFFS.sizeMin);
      expect(p.size).toBeLessThanOrEqual(PUFFS.sizeMax);
    }
    // in clusters: many puffs share a cluster centre
    expect(new Set(puffs.map((p) => p.cluster.join(','))).size).toBeLessThan(PUFFS.count / 5);
  });

  test('the field wraps round the camera as the wind carries it', () => {
    expect(wrapAround(1600, 0, 3000)).toBeCloseTo(-1400, 9);
    expect(wrapAround(-1600, 0, 3000)).toBeCloseTo(1400, 9);
    expect(wrapAround(200, 1000, 3000)).toBeCloseTo(200, 9);
    expect(wrapAround(2600, 1000, 3000)).toBeCloseTo(-400, 9);
  });

  test('a puff is a soft blob: clear at its border, dense in its middle, the same for a seed', () => {
    const size = 64;
    const t = puffTexels(size, 1);
    expect(t).toHaveLength(size * size * 4);
    expect(puffTexels(size, 1)).toEqual(t);
    const alpha = (x: number, y: number) => t[(y * size + x) * 4 + 3];
    for (let k = 0; k < size; k++) {
      expect(alpha(k, 0)).toBe(0);
      expect(alpha(0, k)).toBe(0);
      expect(alpha(k, size - 1)).toBe(0);
      expect(alpha(size - 1, k)).toBe(0);
    }
    expect(alpha(size / 2, size / 2)).toBeGreaterThanOrEqual(200);
  });

  test('the way out never enters a cloud: always above the puffs and far above the cloud sea', () => {
    for (const seat of [{ row: 14, letter: 'F' as const }, { row: 1, letter: 'A' as const }]) {
      for (const id of ['exit', 'outro'] as const) {
        for (let i = 0; i <= 200; i++) {
          const y = poseOnPostTrack(trackProgress('post', id, i / 200), seat).position.y;
          expect(y, `${seat.row}${seat.letter} ${id} ${i / 200}`).toBeGreaterThanOrEqual(PUFFS.layer.top + 30);
          expect(y - CLOUD_SEA.y).toBeGreaterThanOrEqual(400);
        }
      }
    }
  });
});
