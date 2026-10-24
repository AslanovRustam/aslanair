import { PerspectiveCamera, Vector3 } from 'three';
import { describe, expect, test } from 'vitest';
import { applyLens, poseOnPreTrack } from '@/experience/cameraPoses';
import { HERO_PICTURE, heroScale, INTRO } from '@/experience/introState';

describe('the hero frame is the capture frame, scaled and lifted', () => {
  for (const [w, h] of [
    [1440, 800],
    [2100, 900],
    [412, 915],
  ]) {
    test(`at ${w}×${h} the camera at the top projects every point where the loader's picture shows it`, () => {
      const aspect = w / h;
      const s = heroScale(aspect);
      const { width: pw, height: ph } = INTRO.picture;
      // the picture: the capture camera's 16:9 frame, shown full height × s, centred, lifted by HERO_PICTURE.lift
      const capture = new PerspectiveCamera(INTRO.swapPose.fov, pw / ph, 0.1, 1000);
      capture.position.copy(INTRO.swapPose.position);
      capture.lookAt(INTRO.swapPose.target);
      capture.updateMatrixWorld();
      const pose = poseOnPreTrack(0, aspect);
      const hero = new PerspectiveCamera(pose.fov, aspect, 0.1, 1000);
      hero.position.copy(pose.position);
      hero.lookAt(pose.target);
      applyLens(hero, pose, w, h);
      hero.updateMatrixWorld();
      for (const p of [new Vector3(0, 0, 0), new Vector3(15, 2, 0), new Vector3(-18, 5, 3), new Vector3(3, -2, 16)]) {
        const a = p.clone().project(capture);
        const b = p.clone().project(hero);
        expect(b.x, `x of ${p.toArray()}`).toBeCloseTo((a.x * s * (pw / ph)) / aspect, 6);
        expect(b.y, `y of ${p.toArray()}`).toBeCloseTo(a.y * s + 2 * HERO_PICTURE.lift, 6);
      }
    });
  }

  test('the hero plane fills two thirds of a 16:9 frame, its middle near the centre', () => {
    const { plane } = INTRO.picture;
    const s = heroScale(16 / 9);
    // the picture is 16:9 like the frame: the plane's share of the width is its share of the picture, scaled
    const width = (plane.right - plane.left) * s;
    const middle = 0.5 - HERO_PICTURE.lift + ((plane.top + plane.bottom) / 2 - 0.5) * s;
    expect(width).toBeGreaterThanOrEqual(0.62);
    expect(width).toBeLessThanOrEqual(0.7);
    expect(middle).toBeGreaterThanOrEqual(0.47);
    expect(middle).toBeLessThanOrEqual(0.56);
  });

  test('on a phone the hero picture keeps the whole plane inside the screen width', () => {
    const [w, h] = [412, 915];
    const plane = INTRO.picture.plane;
    const planeWidth = heroScale(w / h) * (plane.right - plane.left) * h * (INTRO.picture.width / INTRO.picture.height);
    expect(planeWidth).toBeLessThanOrEqual(0.9 * w);
    expect(heroScale(16 / 9)).toBe(INTRO.heroScale);
  });
});
