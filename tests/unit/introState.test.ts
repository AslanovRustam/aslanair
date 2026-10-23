import { describe, expect, test } from 'vitest';
import { trackProgress } from '@/experience/chapters';
import { INTRO, introState } from '@/experience/introState';

const p = (t: number) => trackProgress('pre', 'sky', t);

describe('intro: the picture becomes the 3D plane', () => {
  test('the picture flies down and grows, matching the 3D frame at the swap', () => {
    expect(introState(p(0))).toMatchObject({ imageScale: INTRO.heroScale, aircraftVisible: false, imageOpacity: 1 });
    expect(introState(p(INTRO.swapAt))).toMatchObject({ imageScale: 1, imageY: 0, aircraftVisible: true });
    expect(introState(p(INTRO.swapAt + INTRO.crossfade)).imageOpacity).toBe(0);
    for (let t = 0; t < INTRO.swapAt; t += 0.05) expect(introState(p(t + 0.05)).imageScale).toBeGreaterThanOrEqual(introState(p(t)).imageScale);
  });

  test('the picture starts high above the frame centre and lands on it', () => {
    expect(introState(p(0)).imageY).toBe(INTRO.heroLift);
    for (let t = 0; t < INTRO.swapAt; t += 0.05) expect(introState(p(t + 0.05)).imageY).toBeLessThanOrEqual(introState(p(t)).imageY);
  });

  test('the 3D plane is already there whenever the picture is less than opaque', () => {
    for (let t = 0; t <= 1; t += 0.01) {
      const s = introState(p(t));
      if (s.imageOpacity < 1) expect(s.aircraftVisible, `t=${t.toFixed(2)}`).toBe(true);
    }
  });

  test('the 3D plane only shows once the picture is within a hair of its full frame', () => {
    const first = introState(p(INTRO.swapAt - INTRO.crossfade));
    expect(first.aircraftVisible).toBe(true);
    expect(1 - first.imageScale).toBeLessThan(0.002);
    expect(introState(p(INTRO.swapAt - INTRO.crossfade - 0.01)).aircraftVisible).toBe(false);
  });

  test('past the sky chapter the picture is gone and the 3D plane stays', () => {
    for (const progress of [trackProgress('pre', 'door', 0), trackProgress('pre', 'door', 0.5), 1]) {
      expect(introState(progress)).toMatchObject({ imageOpacity: 0, aircraftVisible: true, imageScale: 1, imageY: 0 });
    }
  });

  test('on a phone the hero picture keeps the whole plane inside the screen width', () => {
    const [w, h] = [412, 915];
    const { imageScale } = introState(0, w / h);
    const plane = INTRO.picture.plane;
    const planeWidth = imageScale * (plane.right - plane.left) * h * (INTRO.picture.width / INTRO.picture.height);
    expect(planeWidth).toBeLessThanOrEqual(0.9 * w);
    expect(introState(0, 16 / 9).imageScale).toBe(INTRO.heroScale);
  });
});
