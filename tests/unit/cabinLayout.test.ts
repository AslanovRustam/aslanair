import { Vector3 } from 'three';
import { describe, expect, test } from 'vitest';
import { armMatrices, binBoxes, distanceToBoxes, SEAT_KIT, seatMatrices } from '@/experience/cabinLayout';
import { poseOnPreTrack } from '@/experience/cameraPoses';
import { EYE_SEATED, FLOOR_Y, rowX, SEATED_EYE_AFT, seatWorldPosition } from '@/experience/geometry';
import { generateSeatMap } from '@/experience/seats';

describe('seats', () => {
  test('the seated eye clears its own seat', () => {
    expect(EYE_SEATED - FLOOR_Y - SEAT_KIT.height).toBeGreaterThanOrEqual(0.05);
    expect(-SEATED_EYE_AFT - SEAT_KIT.backFrontTopX).toBeGreaterThanOrEqual(0.1);
  });

  test('each seat instance stands on its floor position', () => {
    const seats = generateSeatMap();
    const at = seatMatrices(seats).map((m) => new Vector3().setFromMatrixPosition(m).toArray());
    expect(at).toHaveLength(180);
    expect(at[0]).toEqual(seatWorldPosition(1, 'A'));
    expect(at[179]).toEqual(seatWorldPosition(30, 'F'));
  });

  test('armrests at both ends of every triple and between neighbours', () => {
    const arms = armMatrices().map((m) => new Vector3().setFromMatrixPosition(m));
    expect(arms).toHaveLength(240);
    expect(arms.filter((p) => Math.abs(p.x - rowX(1)) < 1e-6).map((p) => +p.z.toFixed(2)).sort((a, b) => a - b))
      .toEqual([-1.64, -1.18, -0.7, -0.24, 0.24, 0.7, 1.18, 1.64]);
  });
});

describe('bins', () => {
  test('the walking camera keeps clear of the bins', () => {
    const boxes = binBoxes();
    expect(boxes).toHaveLength(60);
    for (let i = 0; i <= 2000; i++) {
      const cam = poseOnPreTrack(i / 2000).position;
      expect(distanceToBoxes(cam, boxes), `p=${i / 2000}`).toBeGreaterThanOrEqual(0.3);
    }
  });
});
