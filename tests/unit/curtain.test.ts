import { describe, expect, test } from 'vitest';
import { CURTAIN, curtainFrame, reducedCurtainFrame } from '@/experience/curtain';

describe('the curtain transition', () => {
  test('it covers, holds while the plane flies across, then reveals once the chapter is ready', () => {
    expect(curtainFrame(0, null).stage).toBe('cover');
    const rising = curtainFrame(0.2, null);
    expect(rising.stage).toBe('cover');
    expect(rising.accent.top, 'the terracotta layer leads').toBeGreaterThan(rising.dark.top);
    expect(curtainFrame(0.46, 0.5).stage).toBe('covered');
    // ready at 0.5 s: the reveal waits for the plane's flight to end, at cover + flight = 1.2 s
    expect(curtainFrame(0.46 + 0.75 + 0.01, 0.5).stage).toBe('reveal');
    expect(curtainFrame(0.46 + 0.75 + 0.6, 0.5).done).toBe(true);
    expect(curtainFrame(1, 0.5).done).toBe(false);
  });

  test('until the chapter is ready it stays covered, the plane gone and the bar holding at 60 %', () => {
    const f = curtainFrame(5, null);
    expect(f.stage).toBe('covered');
    expect(f.plane).toBeNull();
    expect(f.bar).toBeCloseTo(0.6, 9);
    expect(curtainFrame(CURTAIN.cover + 0.3, null).plane).toBeGreaterThan(0);
  });

  test('a late chapter reveals as soon as it is ready', () => {
    expect(curtainFrame(3.01, 3).stage).toBe('reveal');
    expect(curtainFrame(3.01, 3).bar).toBe(1);
  });

  test('its edges only ever move one way, and covered it fills the screen', () => {
    let [accent, dark] = [0, 0];
    for (let t = 0; t <= CURTAIN.cover; t += 0.01) {
      const f = curtainFrame(t, null);
      expect(f.accent.top).toBeGreaterThanOrEqual(accent - 1e-12);
      expect(f.dark.top).toBeGreaterThanOrEqual(dark - 1e-12);
      [accent, dark] = [f.accent.top, f.dark.top];
    }
    const covered = curtainFrame(CURTAIN.cover + 0.1, null);
    expect(covered.dark).toEqual({ top: 1, bottom: 0 });
    [accent, dark] = [0, 0];
    for (let t = 1.2; t <= 1.2 + CURTAIN.reveal; t += 0.01) {
      const f = curtainFrame(t, 0);
      expect(f.accent.bottom).toBeGreaterThanOrEqual(accent - 1e-12);
      expect(f.dark.bottom).toBeGreaterThanOrEqual(dark - 1e-12);
      [accent, dark] = [f.accent.bottom, f.dark.bottom];
    }
  });

  test('its edge bulges only while it moves, never past 0.35', () => {
    for (const t of [0, CURTAIN.cover, CURTAIN.cover + 0.3, 1.2, 1.2 + CURTAIN.reveal]) expect(curtainFrame(t, 0).bulge, `t=${t}`).toBeCloseTo(0, 6);
    let most = 0;
    for (let t = 0; t <= 2; t += 0.01) most = Math.max(most, curtainFrame(t, 0).bulge);
    expect(most).toBeGreaterThan(0.2);
    expect(most).toBeLessThanOrEqual(0.35);
  });

  test('with reduced motion it is a short fade with no plane', () => {
    for (let t = 0; t <= 1; t += 0.05) expect(reducedCurtainFrame(t, 0).plane).toBeNull();
    expect(reducedCurtainFrame(0, 0.5).opacity).toBe(0);
    expect(reducedCurtainFrame(CURTAIN.fade + 0.01, 0.5)).toMatchObject({ stage: 'covered', opacity: 1 });
    expect(reducedCurtainFrame(0.5 + CURTAIN.fade / 2, 0.5).opacity).toBeCloseTo(0.5, 6);
    expect(reducedCurtainFrame(0.5 + CURTAIN.fade + 0.01, 0.5).done).toBe(true);
    expect(reducedCurtainFrame(1, null).done).toBe(false);
  });
});
