import { describe, expect, test } from 'vitest';
import { lockPulse, passEntrance } from '@/experience/passMotion';

describe('the seat lock and the pass entrance', () => {
  test('the visitor settles into the seat: a short dip at the lock, then rest', () => {
    expect(lockPulse(0, false).dip).toBeCloseTo(0);
    expect(lockPulse(180, false).dip).toBeCloseTo(0.03);
    expect(lockPulse(600, false).dip).toBeCloseTo(0);
    expect(lockPulse(900, false)).toEqual({ dip: 0 });
    // no motion when the visitor asks for less
    expect(lockPulse(180, true)).toEqual({ dip: 0 });
  });

  test('the dip is smooth: no jump between neighbouring milliseconds', () => {
    for (let ms = 1; ms <= 700; ms++) expect(Math.abs(lockPulse(ms, false).dip - lockPulse(ms - 1, false).dip), `${ms} ms`).toBeLessThan(0.001);
  });

  test('the pass waits for the lock, slides up and settles', () => {
    expect(passEntrance(300, false)).toMatchObject({ offsetY: -0.35, opacity: 1 });
    expect(passEntrance(600, false).tilt).toBeCloseTo(0.25);
    expect(passEntrance(2000, false)).toEqual({ offsetY: 0, tilt: 0, opacity: 1 });
    const mid = passEntrance(950, false);
    expect(mid.offsetY).toBeGreaterThan(-0.35);
    expect(mid.offsetY).toBeLessThan(0);
  });

  test('with reduced motion it only fades in, in place', () => {
    expect(passEntrance(800, true).offsetY).toBe(0);
    expect(passEntrance(800, true).tilt).toBe(0);
    expect(passEntrance(600, true).opacity).toBe(0);
    expect(passEntrance(800, true).opacity).toBeCloseTo(0.5);
    expect(passEntrance(1000, true).opacity).toBe(1);
  });
});
