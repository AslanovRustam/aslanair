import { describe, expect, test } from 'vitest';
import { poseOnPreTrack } from '@/experience/cameraPoses';
import { trackProgress } from '@/experience/chapters';
import { aircraftStage, projectedBox, type ScreenBox } from '@/experience/stage';

const ASPECTS = [412 / 915, 1, 1440 / 800, 2100 / 900, 3.6];
const sky = (t: number) => trackProgress('pre', 'sky', t);
const inFrame = (b: ScreenBox) => b.x1 > 0 && b.x0 < 1 && b.y1 > 0 && b.y0 < 1;
const boxAt = (progress: number, aspect: number) => projectedBox(aircraftStage('browse', progress), poseOnPreTrack(progress, aspect), aspect);

describe('the aircraft stage', () => {
  test('the plane stands at the origin, level and full size, at the top and from the door on', () => {
    for (const [phase, progress] of [
      ['browse', 0],
      ['browse', trackProgress('pre', 'door', 0)],
      ['browse', trackProgress('pre', 'door', 0.6)],
      ['browse', trackProgress('pre', 'aisle', 0.5)],
      ['seated', trackProgress('pre', 'aisle', 0.5)],
      ['confirmed', 0.5],
    ] as const) {
      const s = aircraftStage(phase, progress);
      expect(s.position.length(), `${phase} ${progress}`).toBeLessThan(1e-9);
      expect(Math.abs(s.rotation.x) + Math.abs(s.rotation.y) + Math.abs(s.rotation.z), `${phase} ${progress}`).toBeLessThan(1e-9);
      expect(s.scale).toBe(1);
    }
  });

  test('on the first screen the plane banks into its climb, never past 25°', () => {
    let most = 0;
    for (let i = 0; i <= 100; i++) {
      const roll = Math.abs(aircraftStage('browse', sky(i / 100)).rotation.x);
      expect(roll).toBeLessThanOrEqual((25 * Math.PI) / 180 + 1e-9);
      most = Math.max(most, roll);
    }
    expect(most).toBeGreaterThan((15 * Math.PI) / 180);
  });

  for (const aspect of ASPECTS) {
    test(`at ${aspect.toFixed(2)} it crosses the frame up and to the left, smoothly, and is gone by the end of the first screen`, () => {
      const start = boxAt(0, aspect);
      expect(inFrame(start)).toBe(true);
      // up and to the left: half way through, its centre has moved both ways
      const mid = boxAt(sky(0.5), aspect);
      expect((start.x0 + start.x1) / 2 - (mid.x0 + mid.x1) / 2).toBeGreaterThan(0.05);
      expect((start.y0 + start.y1) / 2 - (mid.y0 + mid.y1) / 2).toBeGreaterThan(0.1);
      expect(inFrame(boxAt(sky(1), aspect)), 'out of frame at the end of the first screen').toBe(false);
      // at most 3 % of the frame per 1 % of the chapter, across the chapter and on into the globe's
      const steps = [...Array.from({ length: 101 }, (_, i) => sky(i / 100)), ...Array.from({ length: 10 }, (_, i) => trackProgress('pre', 'destinations', (i + 1) / 100))];
      for (let i = 1; i < steps.length; i++) {
        const a = boxAt(steps[i - 1], aspect);
        const b = boxAt(steps[i], aspect);
        if (!inFrame(a) && !inFrame(b)) continue;
        const moved = Math.max(Math.abs(a.x0 - b.x0), Math.abs(a.x1 - b.x1), Math.abs(a.y0 - b.y0), Math.abs(a.y1 - b.y1));
        expect(moved, `step ${i}`).toBeLessThanOrEqual(0.03);
      }
    });
  }
});
