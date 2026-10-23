import { PerspectiveCamera, Vector3 } from 'three';
import { describe, expect, test } from 'vitest';
import { applyLens, poseOnPreTrack } from '@/experience/cameraPoses';
import { trackProgress } from '@/experience/chapters';
import { DESTINATIONS, HOME } from '@/experience/destinations';
import { arcPoints, GLOBE, globeFade, globeTurnFor, greatCircle, latLonToVector } from '@/experience/globe';

const EARTH_KM = 6371;

/** Whether `p` (globe-local, after the turn) can be seen from `eye` (world): the sight line misses the sphere. */
function seen(p: Vector3, eye: Vector3): boolean {
  const point = p.clone().add(GLOBE.center);
  const toPoint = point.clone().sub(eye);
  const t = Math.min(1, Math.max(0, GLOBE.center.clone().sub(eye).dot(toPoint) / toPoint.lengthSq()));
  // the closest approach to the centre before the point itself, with a hair of tolerance for points on the surface
  if (t >= 1 - 1e-6) return true;
  return eye.clone().addScaledVector(toPoint, t).distanceTo(GLOBE.center) > GLOBE.radius * (1 - 1e-6);
}

/** The globe's outline on screen for the camera at `progress` in a frame of `aspect`: fractions, y down. */
function globeOnScreen(progress: number, aspect: number) {
  const pose = poseOnPreTrack(progress, aspect);
  const camera = new PerspectiveCamera(pose.fov, aspect, 0.1, 10000);
  camera.position.copy(pose.position);
  camera.lookAt(pose.target);
  applyLens(camera, pose, aspect, 1);
  camera.updateMatrixWorld();
  // the silhouette: the cone of sight lines grazing the sphere
  const toCentre = GLOBE.center.clone().sub(pose.position);
  const grazing = Math.asin(GLOBE.radius / toCentre.length());
  const axis = toCentre.clone().normalize();
  const side = axis.clone().cross(new Vector3(0, 1, 0)).normalize();
  const box = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
  for (let i = 0; i < 72; i++) {
    const around = side.clone().applyAxisAngle(axis, (i / 72) * 2 * Math.PI);
    const dir = axis.clone().applyAxisAngle(around.clone().cross(axis).normalize(), grazing);
    const p = pose.position.clone().addScaledVector(dir, 100).project(camera);
    const [x, y] = [(p.x + 1) / 2, (1 - p.y) / 2];
    box.x0 = Math.min(box.x0, x);
    box.x1 = Math.max(box.x1, x);
    box.y0 = Math.min(box.y0, y);
    box.y1 = Math.max(box.y1, y);
  }
  return box;
}

describe('the globe', () => {
  test('latitude and longitude: 0°, 0° on +x, the north pole on +y, east towards −z', () => {
    const at = (lat: number, lon: number) => latLonToVector(lat, lon).toArray().map((c) => Math.round(c * 1e9) / 1e9 + 0);
    expect(at(0, 0)).toEqual([1, 0, 0]);
    expect(at(90, 0)).toEqual([0, 1, 0]);
    expect(at(0, 90)).toEqual([0, 0, -1]);
    expect(latLonToVector(10, 20, 5).length()).toBeCloseTo(5, 9);
  });

  test('Chișinău to Lisbon is 3 198 km along the great circle', () => {
    const lis = DESTINATIONS.find((d) => d.code === 'LIS')!;
    const angle = latLonToVector(HOME.lat, HOME.lon).angleTo(latLonToVector(lis.lat, lis.lon));
    expect(angle * EARTH_KM).toBeGreaterThan(3198 * 0.99);
    expect(angle * EARTH_KM).toBeLessThan(3198 * 1.01);
  });

  test('a great circle runs on the sphere from one city to the other', () => {
    const tokyo = DESTINATIONS.find((d) => d.code === 'HND')!;
    const points = greatCircle(HOME, tokyo, 33);
    expect(points).toHaveLength(33);
    expect(points[0].distanceTo(latLonToVector(HOME.lat, HOME.lon, GLOBE.radius))).toBeLessThan(1e-9);
    expect(points[32].distanceTo(latLonToVector(tokyo.lat, tokyo.lon, GLOBE.radius))).toBeLessThan(1e-9);
    for (const p of points) expect(p.length()).toBeCloseTo(GLOBE.radius, 9);
  });

  test('an arc leaves the home marker, peaks half way — higher for a longer flight — and lands on the city', () => {
    const peak = (code: string) => {
      const d = DESTINATIONS.find((x) => x.code === code)!;
      const points = arcPoints(HOME, d, 41);
      expect(points[0].distanceTo(latLonToVector(HOME.lat, HOME.lon, GLOBE.radius))).toBeLessThan(1e-9);
      expect(points[40].distanceTo(latLonToVector(d.lat, d.lon, GLOBE.radius))).toBeLessThan(1e-9);
      const heights = points.map((p) => p.length() - GLOBE.radius);
      expect(heights.indexOf(Math.max(...heights))).toBe(20);
      return Math.max(...heights);
    };
    expect(peak('GIG')).toBeGreaterThan(peak('LIS') * 2);
    expect(peak('LIS')).toBeGreaterThan(0);
  });

  test('turned for any flight, the whole arc faces the camera of the destinations chapter, its middle centred', () => {
    const eye = poseOnPreTrack(trackProgress('pre', 'destinations', 0.5)).position;
    const facing = eye.clone().sub(GLOBE.center).normalize();
    for (const d of DESTINATIONS) {
      const turn = globeTurnFor(HOME, d);
      const points = arcPoints(HOME, d, 33).map((p) => p.applyQuaternion(turn));
      for (const [i, p] of points.entries()) expect(seen(p, eye), `${d.code} point ${i}`).toBe(true);
      const middle = greatCircle(HOME, d, 3)[1].applyQuaternion(turn).normalize();
      expect(middle.dot(facing), d.code).toBeCloseTo(1, 6);
    }
  });

  test('turned, the globe keeps its north up on screen', () => {
    const pose = poseOnPreTrack(trackProgress('pre', 'destinations', 0.5));
    const view = pose.target.clone().sub(pose.position).normalize();
    const up = new Vector3(0, 1, 0).sub(view.clone().multiplyScalar(view.y)).normalize();
    for (const d of DESTINATIONS) {
      const north = new Vector3(0, 1, 0).applyQuaternion(globeTurnFor(HOME, d));
      // the pole's direction seen across the view: pointing up the screen
      expect(north.sub(view.clone().multiplyScalar(north.dot(view))).normalize().dot(up), d.code).toBeGreaterThan(0.99);
    }
  });

  test('mid-chapter the camera frames the globe at 60 % of the frame height, and inside the width on a phone', () => {
    const mid = trackProgress('pre', 'destinations', 0.5);
    const wide = globeOnScreen(mid, 16 / 9);
    expect(wide.y1 - wide.y0).toBeGreaterThan(0.57);
    expect(wide.y1 - wide.y0).toBeLessThan(0.63);
    expect(Math.abs((wide.x0 + wide.x1) / 2 - 0.5)).toBeLessThan(0.01);
    expect(Math.abs((wide.y0 + wide.y1) / 2 - 0.5)).toBeLessThan(0.01);
    const phone = globeOnScreen(mid, 412 / 915);
    expect(phone.x1 - phone.x0).toBeLessThan(0.88);
    expect(phone.x0).toBeGreaterThan(0.05);
  });

  for (const aspect of [16 / 9, 412 / 915]) {
    test(`at ${aspect.toFixed(2)} it emerges below the climbing plane and rises as the first screen ends`, () => {
      const sky = (t: number) => trackProgress('pre', 'sky', t);
      // unseen while the plane holds the frame, all there by the end
      expect(globeFade('browse', sky(0.55))).toBe(0);
      expect(globeFade('browse', sky(0.7))).toBeGreaterThan(0.2);
      expect(globeFade('browse', sky(1))).toBe(1);
      const [a, b] = [globeOnScreen(sky(0.6), aspect), globeOnScreen(sky(1), aspect)];
      expect((b.y0 + b.y1) / 2, 'rising').toBeLessThan((a.y0 + a.y1) / 2 - 0.05);
      expect(b.y0 > 0 && b.y1 < 1 && b.x0 > 0 && b.x1 < 1, 'whole in frame at the end').toBe(true);
    });
  }

  test('it shows from the end of the first screen to the transfer chapter, nowhere else', () => {
    expect(globeFade('browse', trackProgress('pre', 'sky', 0.5))).toBe(0);
    expect(globeFade('browse', trackProgress('pre', 'destinations', 0.5))).toBe(1);
    expect(globeFade('browse', trackProgress('pre', 'transfer', 0.2))).toBe(0);
    expect(globeFade('browse', trackProgress('pre', 'aisle', 0.5))).toBe(0);
    expect(globeFade('seated', trackProgress('pre', 'destinations', 0.5))).toBe(0);
  });
});
