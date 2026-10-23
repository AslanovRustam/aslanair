import { describe, expect, test } from 'vitest';
import { easeLevel, hoverLift, SEAT_GLOW } from '@/experience/seatGlow';

describe('seat hover response', () => {
  test('a hovered seat rises a few centimetres, a resting one sits on the floor', () => {
    expect(hoverLift(0)).toBe(0);
    expect(hoverLift(1)).toBeCloseTo(SEAT_GLOW.lift);
    expect(SEAT_GLOW.lift).toBeGreaterThanOrEqual(0.03);
    expect(SEAT_GLOW.lift).toBeLessThanOrEqual(0.06);
  });

  test('the level eases towards its target, independent of the frame rate', () => {
    const once = easeLevel(0, 1, 1 / 30);
    const twice = easeLevel(easeLevel(0, 1, 1 / 60), 1, 1 / 60);
    expect(once).toBeGreaterThan(0);
    expect(once).toBeLessThan(1);
    expect(twice).toBeCloseTo(once, 6);
    let level = 0;
    for (let i = 0; i < 18; i++) level = easeLevel(level, 1, 1 / 60); // 0.3 s
    expect(level).toBeGreaterThan(0.95);
    expect(easeLevel(1, 0, 1)).toBeLessThan(0.01);
  });
});
