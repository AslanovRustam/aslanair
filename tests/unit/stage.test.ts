import { Matrix4, Quaternion, Vector3 } from 'three';
import { describe, expect, test } from 'vitest';
import { poseOnPreTrack } from '@/experience/cameraPoses';
import { trackProgress, TRACKS } from '@/experience/chapters';
import { DESTINATIONS, HOME } from '@/experience/destinations';
import { GLOBE, globeFade, globeTurnFor, nextFlight, planeOnGlobe, planeOverGlobe, toWorld } from '@/experience/globe';
import { aircraftStage, ARRIVAL, ON_GLOBE_SCALE, projectedBox, type ScreenBox, type Stage } from '@/experience/stage';

const ASPECTS = [412 / 915, 1, 1440 / 800, 2100 / 900, 3.6];
const sky = (t: number) => trackProgress('pre', 'sky', t);
const inFrame = (b: ScreenBox) => b.x1 > 0 && b.x0 < 1 && b.y1 > 0 && b.y0 < 1;
const LIS = DESTINATIONS.find((d) => d.code === 'LIS')!;
const TURN = globeTurnFor(HOME, LIS);
/** The plane waiting over home (Odesa) before any pick, in the world. */
const waiting = toWorld(planeOnGlobe(null, LIS, 0), TURN);
const stageAt = (progress: number, aspect = 16 / 9) => aircraftStage('browse', progress, planeOverGlobe('browse', progress, null, LIS, 0), aspect);

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

const boxAt = (progress: number, aspect: number) => projectedBox(stageAt(progress, aspect), poseOnPreTrack(progress, aspect), aspect);
/** Behind the globe as seen from the camera, while the globe is there (it hides only while nearly opaque). */
const hidden = (progress: number, aspect: number) =>
  globeFade('browse', progress) >= 0.9 && !unhidden(stageAt(progress, aspect), poseOnPreTrack(progress, aspect).position);
/** On screen: in frame and not behind the globe. */
const showing = (progress: number, aspect: number) => inFrame(boxAt(progress, aspect)) && !hidden(progress, aspect);
const area = (b: ScreenBox) => (b.x1 - b.x0) * (b.y1 - b.y0);
/** The pre track's height in viewport heights: steps are judged per vh of scroll, whatever the chapter's length. */
const TRACK_VH = TRACKS.pre.reduce((sum, c) => sum + c.heightVh, 0);
/**
 * The largest move of the plane's box on screen per vh of scroll between neighbouring points of `steps`, while it
 * shows, as a share of the frame. The first screen's rule — 3 % of the frame per 1 % of its 110 vh — is 2.73 %/vh.
 */
function worstStep(steps: number[], aspect: number, counts: (progress: number) => boolean = () => true): number {
  let worst = 0;
  for (let i = 1; i < steps.length; i++) {
    // a chapter's end and the next one's start are the same point
    if (steps[i] === steps[i - 1] || !counts(steps[i]) || (!showing(steps[i - 1], aspect) && !showing(steps[i], aspect))) continue;
    // what the visitor sees of it: the box cut to the frame
    const [a, b] = [boxAt(steps[i - 1], aspect), boxAt(steps[i], aspect)].map(seen);
    const moved = Math.max(Math.abs(a.x0 - b.x0), Math.abs(a.x1 - b.x1), Math.abs(a.y0 - b.y0), Math.abs(a.y1 - b.y1));
    worst = Math.max(worst, moved / ((steps[i] - steps[i - 1]) * TRACK_VH));
  }
  return worst;
}
const PER_VH = 0.03 / 1.1;
/**
 * The flight in for the transfer (spec r5 §4) may move faster: it crosses from beyond the right edge to its place in
 * about 38 vh, and on a narrow screen it spans most of the width. A jump still shows: at these 1 % steps one is over
 * 6 % of the frame per vh.
 */
const ARRIVAL_PER_VH = 0.04;
const arriving = (progress: number) =>
  progress > trackProgress('pre', 'destinations', ARRIVAL.start) && progress <= trackProgress('pre', 'transfer', ARRIVAL.settle);
const cut = (v: number) => Math.min(1, Math.max(0, v));
const seen = (b: ScreenBox): ScreenBox => ({ x0: cut(b.x0), y0: cut(b.y0), x1: cut(b.x1), y1: cut(b.y1) });
const across = (id: 'sky' | 'destinations' | 'transfer' | 'ready', from = 0, to = 1) =>
  Array.from({ length: Math.round((to - from) * 100) + 1 }, (_, i) => trackProgress('pre', id, from + i / 100));

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

  test('on the first screen it banks gently as it turns towards the globe, never past 25°', () => {
    let most = 0;
    for (let i = 0; i <= 100; i++) {
      const roll = Math.abs(aircraftStage('browse', sky(i / 100)).rotation.x);
      expect(roll).toBeLessThanOrEqual((25 * Math.PI) / 180 + 1e-9);
      most = Math.max(most, roll);
    }
    expect(most).toBeGreaterThan((8 * Math.PI) / 180);
  });

  test('flying off to the globe it goes round it, never through it', () => {
    for (let i = 0; i <= 200; i++) {
      const s = aircraftStage('browse', sky(i / 200));
      // the plane's half-length at its scale: its whole body stays outside the sphere
      expect(s.position.distanceTo(GLOBE.center), `sky ${i / 200}`).toBeGreaterThanOrEqual(GLOBE.radius + 19 * s.scale);
    }
  });

  for (const aspect of ASPECTS) {
    test(`at ${aspect.toFixed(2)} it flies off towards the globe, shrinking, and goes behind it before the first screen ends`, () => {
      expect(inFrame(boxAt(0, aspect))).toBe(true);
      expect(area(boxAt(sky(0.5), aspect)), 'half way it is under half the size').toBeLessThanOrEqual(0.4 * area(boxAt(0, aspect)));
      let last = Infinity;
      for (let i = 10; i <= 100; i++) {
        const p = sky(i / 100);
        if (!showing(p, aspect)) continue;
        const b = boxAt(p, aspect);
        expect(area(b), `never grows again (sky ${i / 100})`).toBeLessThanOrEqual(last * 1.02);
        last = area(b);
        // it never leaves through an edge of the frame
        const [cx, cy] = [(b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2];
        expect(cx > 0 && cx < 1 && cy > 0 && cy < 1, `centre in frame (sky ${i / 100})`).toBe(true);
      }
      // from some point on it stays behind the globe, in frame: the visitor sees it go behind the edge
      const steps = Array.from({ length: 101 }, (_, i) => i / 100);
      const tHide = steps.find((t) => steps.filter((u) => u >= t).every((u) => hidden(sky(u), aspect) && inFrame(boxAt(sky(u), aspect))));
      expect(tHide, 'hidden behind the globe to the end of the first screen').toBeDefined();
      expect(tHide!).toBeLessThan(0.97);
      // at most 3 % of the frame per 1 % of the chapter (per vh, the same on over the globe)
      expect(worstStep([...across('sky'), ...across('destinations', 0.01, 0.5)], aspect)).toBeLessThanOrEqual(PER_VH);
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

  for (const aspect of ASPECTS) {
    test(`at ${aspect.toFixed(2)} it leaves the globe unseen and flies in to wait for the transfer, smoothly into ready`, () => {
      expect(showing(trackProgress('pre', 'destinations', 0.93), aspect), 'gone round the globe before it fades').toBe(false);
      expect(showing(trackProgress('pre', 'transfer', 0.5), aspect), 'waiting in view').toBe(true);
      const steps = [...across('destinations', 0.5), ...across('transfer'), ...across('ready')];
      expect(worstStep(steps, aspect, (p) => !arriving(p)), 'outside the flight in').toBeLessThanOrEqual(PER_VH);
      expect(worstStep(steps, aspect, arriving), 'the flight in').toBeLessThanOrEqual(ARRIVAL_PER_VH);
    });
  }

  // spec r5 §4: as the globe goes the plane is there at once, coming in from beyond the right edge, not from above
  for (const aspect of [1440 / 800, 390 / 844]) {
    test(`at ${aspect.toFixed(2)} it flies straight in from the right as the transfer begins and is settled by 0.2`, () => {
      const at = (t: number) => boxAt(trackProgress('pre', 'transfer', t), aspect);
      const entry = at(0.03);
      expect(inFrame(entry), 'in the frame at once').toBe(true);
      expect((entry.x0 + entry.x1) / 2, 'from the right').toBeGreaterThan(0.8);
      expect(entry.y0, 'not from above').toBeGreaterThanOrEqual(0);
      expect(entry.y1, 'not from below').toBeLessThanOrEqual(1);
      const settled = at(0.2);
      expect([settled.x0 >= 0, settled.x1 <= 1, settled.y0 >= 0, settled.y1 <= 1], 'wholly in the frame').toEqual([true, true, true, true]);
      let last = Infinity;
      for (let i = 0; i <= 20; i++) {
        const b = at(i / 100);
        const centre = (b.x0 + b.x1) / 2;
        expect(centre, `transfer ${i / 100}: no overshoot back to the right`).toBeLessThanOrEqual(last + 1e-9);
        last = centre;
      }
    });
  }

  test('waiting, it turns slowly away; ready, it turns back to face the camera and stands at rest for the door flight', () => {
    const yaw = (id: 'transfer' | 'ready', t: number) => aircraftStage('browse', trackProgress('pre', id, t)).rotation.y;
    let last = Infinity;
    for (let i = 40; i <= 100; i += 5) {
      expect(yaw('transfer', i / 100), `transfer ${i / 100}`).toBeLessThanOrEqual(last + 1e-12);
      last = yaw('transfer', i / 100);
    }
    expect(last).toBeLessThan(-0.2);
    for (let i = 0; i <= 100; i += 5) {
      expect(yaw('ready', i / 100), `ready ${i / 100}`).toBeGreaterThanOrEqual(last - 1e-12);
      last = yaw('ready', i / 100);
    }
    const seam = trackProgress('pre', 'ready', 0);
    expect(Math.abs(aircraftStage('browse', seam - 1e-9).rotation.y - aircraftStage('browse', seam).rotation.y)).toBeLessThan(1e-6);
    for (const p of [trackProgress('pre', 'ready', 0.9999), trackProgress('pre', 'door', 0)]) {
      const s = aircraftStage('browse', p);
      expect(s.position.length()).toBeLessThan(1e-3);
      expect(Math.abs(s.rotation.x) + Math.abs(s.rotation.y) + Math.abs(s.rotation.z)).toBeLessThan(1e-3);
      expect(s.scale).toBe(1);
    }
  });

  test('after a flight to any city, or in mid-flight, the plane still comes over the horizon unseen and moves smoothly', () => {
    for (const d of DESTINATIONS) {
      const flight = nextFlight(null, LIS, d, 0);
      for (const now of [0.6, 10]) {
        for (const aspect of [412 / 915, 16 / 9]) {
          const at = (p: number) => aircraftStage('browse', p, planeOverGlobe('browse', p, flight, d, now), aspect);
          const box = (p: number) => projectedBox(at(p), poseOnPreTrack(p, aspect), aspect);
          // behind the globe (in the first screen's end too: it slips behind it there)
          const on = (p: number) => inFrame(box(p)) && (globeFade('browse', p) < 0.9 || unhidden(at(p), poseOnPreTrack(p, aspect).position));
          const label = `${d.code} at ${now} s, ${aspect.toFixed(2)}`;
          expect(on(trackProgress('pre', 'destinations', 0)), `${label}: hidden as the chapter begins`).toBe(false);
          expect(on(trackProgress('pre', 'destinations', 0.93)), `${label}: gone before the globe fades`).toBe(false);
          const points = [...across('sky', 0.9), ...across('destinations', 0.01)];
          let worst = 0;
          for (let i = 1; i < points.length; i++) {
            if (!on(points[i - 1]) && !on(points[i])) continue;
            const [a, b] = [box(points[i - 1]), box(points[i])].map(seen);
            const moved = Math.max(Math.abs(a.x0 - b.x0), Math.abs(a.x1 - b.x1), Math.abs(a.y0 - b.y0), Math.abs(a.y1 - b.y1));
            worst = Math.max(worst, moved / ((points[i] - points[i - 1]) * TRACK_VH) / (arriving(points[i]) ? ARRIVAL_PER_VH / PER_VH : 1));
          }
          expect(worst, label).toBeLessThanOrEqual(PER_VH);
        }
      }
    }
  });
});

