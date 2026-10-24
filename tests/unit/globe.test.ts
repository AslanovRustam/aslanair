import { PerspectiveCamera, Quaternion, Vector3 } from 'three';
import { describe, expect, test } from 'vitest';
import { applyLens, poseOnPreTrack } from '@/experience/cameraPoses';
import { trackProgress } from '@/experience/chapters';
import { DESTINATIONS, HOME } from '@/experience/destinations';
import { FUSELAGE_LENGTH } from '@/experience/geometry';
import type { ArcFlight } from '@/experience/globe';
import {
  arcDrawn,
  arcPoints,
  FLIGHT,
  flightAt,
  GLOBE,
  globeFade,
  globeTurnAt,
  globeTurnFor,
  greatCircle,
  latLonToVector,
  nextFlight,
  planeOnGlobe,
  planeOverGlobe,
  spinBy,
  toWorld,
} from '@/experience/globe';
import { ON_GLOBE_SCALE } from '@/experience/stage';

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

  test('Odesa to Lisbon is 3 330 km along the great circle', () => {
    const lis = DESTINATIONS.find((d) => d.code === 'LIS')!;
    const angle = latLonToVector(HOME.lat, HOME.lon).angleTo(latLonToVector(lis.lat, lis.lon));
    expect(angle * EARTH_KM).toBeGreaterThan(3330 * 0.99);
    expect(angle * EARTH_KM).toBeLessThan(3330 * 1.01);
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
    test(`at ${aspect.toFixed(2)} it rises into view as the plane flies off towards it, whole in frame once it is there`, () => {
      const sky = (t: number) => trackProgress('pre', 'sky', t);
      // unseen while the plane fills the frame, all there before the plane reaches it (stage.ts hides it behind)
      expect(globeFade('browse', sky(0.35))).toBe(0);
      expect(globeFade('browse', sky(0.75))).toBe(1);
      expect(globeFade('browse', sky(1))).toBe(1);
      const [a, b] = [globeOnScreen(sky(0.45), aspect), globeOnScreen(sky(1), aspect)];
      expect((b.y0 + b.y1) / 2, 'rising').toBeLessThan((a.y0 + a.y1) / 2 - 0.05);
      for (const t of [0.75, 1]) {
        const g = globeOnScreen(sky(t), aspect);
        expect(g.y0 > 0 && g.y1 < 1 && g.x0 > 0 && g.x1 < 1, `whole in frame at sky ${t}`).toBe(true);
      }
    });
  }

  test('it shows from the second half of the first screen to the transfer chapter, nowhere else', () => {
    expect(globeFade('browse', trackProgress('pre', 'sky', 0.35))).toBe(0);
    expect(globeFade('browse', trackProgress('pre', 'destinations', 0.5))).toBe(1);
    expect(globeFade('browse', trackProgress('pre', 'transfer', 0.2))).toBe(0);
    expect(globeFade('browse', trackProgress('pre', 'aisle', 0.5))).toBe(0);
    expect(globeFade('seated', trackProgress('pre', 'destinations', 0.5))).toBe(0);
  });
});

describe('the flight over the globe', () => {
  const city = (code: string) => DESTINATIONS.find((d) => d.code === code)!;
  const above = (p: { lat: number; lon: number }) => latLonToVector(p.lat, p.lon, GLOBE.radius + FLIGHT.cruise);
  const homeFlight = (to: string, startedAt: number) => ({
    from: above(HOME),
    to: city(to),
    startedAt,
    turnFrom: globeTurnFor(HOME, city('LIS')),
    headingFrom: planeOnGlobe(null, city('LIS'), 0).heading,
  });
  /** The whole of a flight's way, sampled: its largest step (m) and the largest turn of its nose (degrees). */
  const steps = (f: ArcFlight, from: number, to: number) => {
    let [move, turn] = [0, 0];
    let last = flightAt(f, from);
    for (let i = 1; i <= 600; i++) {
      const now = flightAt(f, from + ((to - from) * i) / 600);
      move = Math.max(move, now.position.distanceTo(last.position));
      turn = Math.max(turn, (now.heading.angleTo(last.heading) * 180) / Math.PI);
      last = now;
    }
    return { move, turn };
  };

  test('it starts where the plane is and lands above the city at cruise height in 1.6 s, level, nose along its way', () => {
    const f = homeFlight('HND', 10);
    expect(flightAt(f, 10).position.distanceTo(above(HOME))).toBeLessThan(1e-9);
    expect(flightAt(f, 10 + FLIGHT.seconds - 0.05).done).toBe(false);
    const end = flightAt(f, 10 + FLIGHT.seconds);
    expect(end.done).toBe(true);
    expect(end.position.distanceTo(above(city('HND')))).toBeLessThan(1e-6);
    // once its nose has come round from where it pointed while waiting
    for (const now of [10 + FLIGHT.turn, 10.5, 10.8, 11.2, 11.55]) {
      const { position, heading } = flightAt(f, now);
      expect(heading.length()).toBeCloseTo(1, 9);
      expect(Math.abs(heading.dot(position.clone().normalize())), `level at ${now}`).toBeLessThan(1e-6);
      const ahead = flightAt(f, now + 0.01).position.sub(position);
      const up = position.clone().normalize();
      const along = ahead.sub(up.multiplyScalar(ahead.dot(up)));
      expect(heading.dot(along.normalize()), `along its way at ${now}`).toBeGreaterThan(0.999);
    }
  });

  test('the arc draws in step with the plane: its tip is where the plane is along the way', () => {
    const f = homeFlight('GIG', 0);
    const home = latLonToVector(HOME.lat, HOME.lon);
    const total = home.angleTo(latLonToVector(city('GIG').lat, city('GIG').lon));
    for (const now of [0.2, 0.6, 0.8, 1.1, 1.4]) {
      const along = flightAt(f, now).position.normalize().angleTo(home) / total;
      expect(arcDrawn(f, now), `at ${now} s`).toBeCloseTo(along, 3);
    }
    expect(arcDrawn(null, 5)).toBe(1);
    expect(arcDrawn(f, 9)).toBe(1);
    // a flight from anywhere but home shows the route from home at once: the plane flies its own way to the city
    const second = nextFlight(f, city('GIG'), city('HND'), 3);
    for (const now of [3, 3.5, 4.2]) expect(arcDrawn(second, now), `${now} s`).toBe(1);
  });

  test('a pick mid-flight flies straight on from where the plane is — never back through home — the plane and its nose never jumping', () => {
    const first = homeFlight('JFK', 0);
    const mid = flightAt(first, 0.7);
    const second = nextFlight(first, city('JFK'), city('FCO'), 0.7);
    expect(flightAt(second, 0.7).position.distanceTo(mid.position)).toBeLessThan(1e-9);
    expect(flightAt(second, 0.7).heading.angleTo(mid.heading)).toBeLessThan(1e-6);
    const end = flightAt(second, 0.7 + FLIGHT.seconds);
    expect(end.done).toBe(true);
    expect(end.position.distanceTo(above(city('FCO')))).toBeLessThan(1e-6);
    expect(flightAt(second, 0.7 + FLIGHT.seconds - 0.05).done).toBe(false);
    const home = latLonToVector(HOME.lat, HOME.lon);
    for (let i = 0; i <= 40; i++) {
      const p = flightAt(second, 0.7 + (FLIGHT.seconds * i) / 40).position.normalize();
      expect((p.angleTo(home) * 180) / Math.PI, `step ${i}`).toBeGreaterThan(2);
    }
    const { move, turn } = steps(second, 0.7, 0.7 + FLIGHT.seconds);
    expect(move, 'largest step (m)').toBeLessThan(0.02 * GLOBE.radius);
    expect(turn, 'largest turn of the nose (°)').toBeLessThan(6);
  });

  test('a flight from a city to that same city goes nowhere and keeps the nose as it was', () => {
    const landed = flightAt(homeFlight('JFK', 0), 5);
    const again = { from: landed.position, to: city('JFK'), startedAt: 5, turnFrom: globeTurnFor(HOME, city('JFK')), headingFrom: landed.heading };
    for (const now of [5, 5.4, 6, 9]) {
      const at = flightAt(again, now);
      expect(at.position.distanceTo(landed.position), `at ${now}`).toBeLessThan(1e-6);
      expect(at.heading.angleTo(landed.heading), `at ${now}`).toBeLessThan(1e-6);
    }
  });

  test('before any pick the plane waits over home, nose towards the chosen city, and the globe faces that flight', () => {
    const lis = city('LIS');
    const rest = planeOnGlobe(null, lis, 123);
    expect(rest.position.distanceTo(above(HOME))).toBeLessThan(1e-9);
    const path = greatCircle(HOME, lis, 401);
    const towards = path[1].sub(path[0]).normalize();
    expect(rest.heading.dot(towards)).toBeGreaterThan(0.999);
    expect(globeTurnAt(null, lis, 123).angleTo(globeTurnFor(HOME, lis))).toBeLessThan(1e-9);
  });

  test('the globe turns with the flight, from where it stood to the turn of the new flight', () => {
    const f = homeFlight('GIG', 5);
    expect(globeTurnAt(f, f.to, 5).angleTo(f.turnFrom)).toBeLessThan(1e-9);
    expect(globeTurnAt(f, f.to, 5 + FLIGHT.seconds).angleTo(globeTurnFor(HOME, city('GIG')))).toBeLessThan(1e-6);
    const second = nextFlight(f, city('GIG'), city('BKK'), 9);
    expect(globeTurnAt(second, second.to, 9 + FLIGHT.seconds).angleTo(globeTurnFor(HOME, city('BKK')))).toBeLessThan(1e-6);
  });

  test('a new flight sets off from the plane and the globe as they are at that moment', () => {
    const f = homeFlight('BKK', 0);
    const next = nextFlight(f, city('BKK'), city('CPT'), 0.9);
    expect(next.from.distanceTo(flightAt(f, 0.9).position)).toBeLessThan(1e-9);
    expect(next.turnFrom.angleTo(globeTurnAt(f, f.to, 0.9))).toBeLessThan(1e-6);
    expect(next.headingFrom.angleTo(flightAt(f, 0.9).heading)).toBeLessThan(1e-9);
    expect(next).toMatchObject({ to: city('CPT'), startedAt: 0.9 });
    const first = nextFlight(null, city('LIS'), city('HND'), 3);
    expect(first.from.distanceTo(above(HOME))).toBeLessThan(1e-9);
  });

  test('in the world the plane stands over the turned globe, its top away from the centre', () => {
    const turn = globeTurnFor(HOME, city('LIS'));
    const world = toWorld(planeOnGlobe(null, city('LIS'), 0), turn);
    expect(world.position.distanceTo(GLOBE.center)).toBeCloseTo(GLOBE.radius + FLIGHT.cruise, 9);
    expect(world.up.dot(world.position.clone().sub(GLOBE.center).normalize())).toBeCloseTo(1, 9);
    expect(Math.abs(world.heading.dot(world.up))).toBeLessThan(1e-9);
  });

  test('the plane over the globe is 6 % of the diameter of the globe long', () => {
    expect((ON_GLOBE_SCALE * FUSELAGE_LENGTH) / (2 * GLOBE.radius)).toBeCloseTo(0.06, 3);
  });
});

describe('the visitor spins the globe', () => {
  const city = (code: string) => DESTINATIONS.find((d) => d.code === code)!;
  const pose = poseOnPreTrack(trackProgress('pre', 'destinations', 0.5));
  const view = pose.target.clone().sub(pose.position).normalize();
  const right = view.clone().cross(new Vector3(0, 1, 0)).normalize();
  const up = right.clone().cross(view);
  /** The point of the globe nearest the camera, after a spin. */
  const near = (spin: Quaternion) => {
    const local = GLOBE.facing.clone().applyQuaternion(spin.clone().invert());
    return local.applyQuaternion(spin).multiplyScalar(GLOBE.radius);
  };
  /** Where a point of the globe's surface (its own frame, turned by `turn`) goes on screen when the globe is spun. */
  const moved = (spin: Quaternion) => GLOBE.facing.clone().multiplyScalar(GLOBE.radius).applyQuaternion(spin).sub(near(new Quaternion()));

  test('dragging right turns the near side right; dragging down turns it down; by half a turn across the screen height', () => {
    const none = spinBy(new Quaternion(), 0, 0, right, up, 800);
    expect(none.angleTo(new Quaternion())).toBeLessThan(1e-12);
    expect(moved(spinBy(new Quaternion(), 40, 0, right, up, 800)).dot(right)).toBeGreaterThan(0);
    expect(moved(spinBy(new Quaternion(), 0, 40, right, up, 800)).dot(up)).toBeLessThan(0);
    expect(spinBy(new Quaternion(), 800, 0, right, up, 800).angleTo(new Quaternion())).toBeCloseTo(Math.PI, 9);
    // spins add up
    const twice = spinBy(spinBy(new Quaternion(), 100, 0, right, up, 800), 100, 0, right, up, 800);
    expect(twice.angleTo(spinBy(new Quaternion(), 200, 0, right, up, 800))).toBeLessThan(1e-9);
  });

  test('spun, the globe carries the plane and its turn with it', () => {
    const lis = city('LIS');
    const spin = spinBy(new Quaternion(), 120, -60, right, up, 800);
    expect(globeTurnAt(null, lis, 0, spin).angleTo(spin.clone().multiply(globeTurnFor(HOME, lis)))).toBeLessThan(1e-6);
    const p = trackProgress('pre', 'destinations', 0.5);
    const still = planeOverGlobe('browse', p, null, lis, 0)!;
    const spun = planeOverGlobe('browse', p, null, lis, 0, spin)!;
    const centre = GLOBE.center;
    expect(spun.position.clone().sub(centre).distanceTo(still.position.clone().sub(centre).applyQuaternion(spin))).toBeLessThan(1e-6);
    expect(spun.heading.distanceTo(still.heading.clone().applyQuaternion(spin))).toBeLessThan(1e-6);
  });

  test('a pick turns the globe on from where the visitor left it', () => {
    const lis = city('LIS');
    const spin = spinBy(new Quaternion(), -200, 30, right, up, 800);
    const next = nextFlight(null, lis, city('HND'), 4, spin);
    expect(next.turnFrom.angleTo(spin.clone().multiply(globeTurnFor(HOME, lis)))).toBeLessThan(1e-6);
  });
});

