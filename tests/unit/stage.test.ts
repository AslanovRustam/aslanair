import { Matrix4, Quaternion, Vector3 } from 'three';
import { describe, expect, test } from 'vitest';
import { poseOnPreTrack } from '@/experience/cameraPoses';
import { chapterAt, trackProgress } from '@/experience/chapters';
import { DESTINATIONS, HOME } from '@/experience/destinations';
import { arrivalAt, arriving, GLOBE, globeTurnFor, planeOnGlobe, toWorld } from '@/experience/globe';
import { aircraftStage, ON_GLOBE_SCALE, projectedBox, type ScreenBox, type Stage } from '@/experience/stage';

const ASPECTS = [412 / 915, 1, 1440 / 800, 2100 / 900, 3.6];
const sky = (t: number) => trackProgress('pre', 'sky', t);
const inFrame = (b: ScreenBox) => b.x1 > 0 && b.x0 < 1 && b.y1 > 0 && b.y0 < 1;
const LIS = DESTINATIONS.find((d) => d.code === 'LIS')!;
const TURN = globeTurnFor(HOME, LIS);
/** The plane waiting over Chișinău before any pick, in the world. */
const waiting = toWorld(planeOnGlobe(null, LIS, 0), TURN);
/** Where it is over the globe at `progress`: coming over the horizon early in the chapter, then waiting. */
const overGlobe = (progress: number) => toWorld(arriving(planeOnGlobe(null, LIS, 0), arrivalAt('browse', progress)), TURN);
const stageAt = (progress: number) => aircraftStage('browse', progress, chapterAt('pre', progress).id === 'destinations' ? overGlobe(progress) : undefined);

/** Whether any of the plane's outline can be seen from `eye`, past the globe (when the globe shows). */
function unhidden(stage: Stage, eye: Vector3): boolean {
  const toWorldMatrix = new Matrix4().compose(stage.position, new Quaternion().setFromEuler(stage.rotation), new Vector3().setScalar(stage.scale));
  return OUTLINE_PROBE.some((corner) => {
    const point = corner.clone().applyMatrix4(toWorldMatrix);
    const toPoint = point.clone().sub(eye);
    const t = Math.min(1, Math.max(0, GLOBE.center.clone().sub(eye).dot(toPoint) / toPoint.lengthSq()));
    return t >= 1 || eye.clone().addScaledVector(toPoint, t).distanceTo(GLOBE.center) > GLOBE.radius;
  });
}
const OUTLINE_PROBE = [new Vector3(18.8, 0, 0), new Vector3(-19, 0.9, 0), new Vector3(-4, 2.3, -17.84), new Vector3(-4, 2.3, 17.84), new Vector3(-15.6, 7.8, 0)];

const boxAt = (progress: number, aspect: number) => projectedBox(stageAt(progress), poseOnPreTrack(progress, aspect), aspect);
/** On screen: in frame and, once over the globe, not behind it. */
const showing = (progress: number, aspect: number) =>
  inFrame(boxAt(progress, aspect)) && (chapterAt('pre', progress).id !== 'destinations' || unhidden(stageAt(progress), poseOnPreTrack(progress, aspect).position));

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
      expect(showing(sky(0.999), aspect), 'out of frame at the end of the first screen').toBe(false);
      // at most 3 % of the frame per 1 % of the chapter, across the chapter and on over the globe
      const steps = [...Array.from({ length: 101 }, (_, i) => sky(i / 100)), ...Array.from({ length: 50 }, (_, i) => trackProgress('pre', 'destinations', (i + 1) / 100))];
      for (let i = 1; i < steps.length; i++) {
        if (!showing(steps[i - 1], aspect) && !showing(steps[i], aspect)) continue;
        const a = boxAt(steps[i - 1], aspect);
        const b = boxAt(steps[i], aspect);
        const moved = Math.max(Math.abs(a.x0 - b.x0), Math.abs(a.x1 - b.x1), Math.abs(a.y0 - b.y0), Math.abs(a.y1 - b.y1));
        expect(moved, `step ${i}`).toBeLessThanOrEqual(0.03);
      }
    });
  }

  test('over the globe the plane stands where it is put, nose along its heading, top up, at the scale of the globe', () => {
    const s = aircraftStage('browse', trackProgress('pre', 'destinations', 0.6), waiting);
    expect(s.position.distanceTo(waiting.position)).toBeLessThan(1e-9);
    expect(s.scale).toBe(ON_GLOBE_SCALE);
    const q = new Quaternion().setFromEuler(s.rotation);
    expect(new Vector3(1, 0, 0).applyQuaternion(q).dot(waiting.heading)).toBeCloseTo(1, 9);
    expect(new Vector3(0, 1, 0).applyQuaternion(q).dot(waiting.up)).toBeCloseTo(1, 9);
  });

  test('it changes place unseen: out of frame at the end of the first screen, behind the globe as the next begins', () => {
    for (const aspect of ASPECTS) {
      expect(showing(sky(0.999), aspect), `${aspect} sky end`).toBe(false);
      expect(showing(trackProgress('pre', 'destinations', 0), aspect), `${aspect} destinations start`).toBe(false);
      expect(showing(trackProgress('pre', 'destinations', 0.3), aspect), `${aspect} arrived`).toBe(true);
    }
  });
});

