import { readFileSync } from 'node:fs';
import { Vector3 } from 'three';
import { describe, expect, test } from 'vitest';
import { doorOffset, doorOpenAmount } from '@/experience/aircraftAnimation';
import { poseOnPreTrack } from '@/experience/cameraPoses';
import { trackProgress } from '@/experience/chapters';
import { DOOR_1L, stationToX } from '@/experience/geometry';

describe('door 1L opening', () => {
  test('closed in the sky and in flight, open from mid-approach on', () => {
    expect(doorOpenAmount('browse', trackProgress('pre', 'sky', 0.9))).toBe(0);
    expect(doorOpenAmount('browse', trackProgress('pre', 'door', 0.2))).toBe(0);
    expect(doorOpenAmount('browse', trackProgress('pre', 'door', 0.6))).toBe(1);
    expect(doorOpenAmount('browse', trackProgress('pre', 'aisle', 0.5))).toBe(1);
    expect(doorOpenAmount('seated', 0.9)).toBe(1);
    expect(doorOpenAmount('confirmed', 0.5)).toBe(0);
  });

  test('slides out first, then forward', () => {
    expect(doorOffset(0)).toEqual([0, 0, 0]);
    const half = doorOffset(0.4);
    expect(half[0]).toBeCloseTo(0);
    expect(half[2]).toBeCloseTo(DOOR_1L.side * DOOR_1L.open.outward);
    const open = doorOffset(1);
    expect(open[0]).toBeCloseTo(DOOR_1L.open.forward);
    expect(open[2]).toBeCloseTo(DOOR_1L.side * DOOR_1L.open.outward);
  });

  test('the moving panel never comes within 0.3 m of the camera at the same moment', () => {
    // conservative box around the closed panel: out to the hull's widest point over the door rectangle
    const meta = JSON.parse(readFileSync('public/models/airliner.meta.json', 'utf8'));
    const x0 = stationToX(DOOR_1L.station + DOOR_1L.width / 2);
    const x1 = stationToX(DOOR_1L.station - DOOR_1L.width / 2);
    const y0 = DOOR_1L.y - DOOR_1L.height / 2;
    const y1 = DOOR_1L.y + DOOR_1L.height / 2;
    const z0 = -meta.door1L.panelMaxHalfWidth;
    const z1 = -1.05;
    for (let i = 0; i <= 400; i++) {
      const p = trackProgress('pre', 'door', i / 400);
      const cam = poseOnPreTrack(p).position;
      const [dx, , dz] = doorOffset(doorOpenAmount('browse', p));
      const nearest = new Vector3(
        Math.min(Math.max(cam.x, x0 + dx), x1 + dx),
        Math.min(Math.max(cam.y, y0), y1),
        Math.min(Math.max(cam.z, z0 + dz), z1 + dz),
      );
      expect(cam.distanceTo(nearest), `door t=${i / 400}`).toBeGreaterThan(0.3);
    }
  });
});
