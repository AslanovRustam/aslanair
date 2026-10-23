import { MathUtils, Matrix4, Quaternion, Vector3 } from 'three';
import { chapterAt } from './chapters';
import { HOME } from './destinations';
import { INTRO } from './introState';
import type { Phase } from './store';

export type LatLon = { lat: number; lon: number };

/**
 * The night Earth of the destinations chapter, in its own space below the aircraft: 140 m from the hero camera and
 * 15° under where that camera's gaze ends on the first screen, so it rises into view as the plane climbs away. The
 * destinations camera turns to it from the same spot (cameraPoses).
 */
const CENTER = new Vector3(-15.5, -100.3, 34);
export const GLOBE = {
  radius: 30,
  center: CENTER,
  /** From the globe's centre towards the camera that looks at it. */
  facing: INTRO.swapPose.position.clone().sub(CENTER).normalize(),
};

/** How high an arc rises at its middle, in globe radii per half-turn of the flight. */
const ARC_RISE = 0.35;

const { degToRad, smoothstep } = MathUtils;

/** A point of the globe's own frame: 0°, 0° on +x, the north pole on +y, east towards −z. */
export function latLonToVector(lat: number, lon: number, radius = 1): Vector3 {
  const phi = degToRad(lat);
  const lambda = degToRad(lon);
  return new Vector3(radius * Math.cos(phi) * Math.cos(lambda), radius * Math.sin(phi), -radius * Math.cos(phi) * Math.sin(lambda));
}

/** `n` points along the great circle from `a` to `b`, both ends included, on the globe's surface. */
export function greatCircle(a: LatLon, b: LatLon, n: number): Vector3[] {
  const from = latLonToVector(a.lat, a.lon);
  const to = latLonToVector(b.lat, b.lon);
  const angle = from.angleTo(to);
  const axis = from.clone().cross(to).normalize();
  return Array.from({ length: n }, (_, i) =>
    (angle > 1e-9 ? from.clone().applyAxisAngle(axis, (angle * i) / (n - 1)) : from.clone()).multiplyScalar(GLOBE.radius),
  );
}

/** The flight's arc: the great circle lifted off the surface, highest half way, a longer flight higher. */
export function arcPoints(a: LatLon, b: LatLon, n: number): Vector3[] {
  const angle = latLonToVector(a.lat, a.lon).angleTo(latLonToVector(b.lat, b.lon));
  const rise = (ARC_RISE * angle) / Math.PI;
  return greatCircle(a, b, n).map((p, i) => p.multiplyScalar(1 + rise * Math.sin((Math.PI * i) / (n - 1))));
}

/** A rotation whose columns are `forward`'s frame: z along it, y as close to `up` as it can be. */
function frame(forward: Vector3, up: Vector3): Matrix4 {
  const z = forward.clone().normalize();
  const y = up.clone().sub(z.clone().multiplyScalar(up.dot(z))).normalize();
  return new Matrix4().makeBasis(y.clone().cross(z), y, z);
}

/**
 * The globe's rotation for the flight from `a` to `b`: the arc's middle turned to face the camera, north up on
 * screen, so the whole arc lies on the visible side — long-haul flights included.
 */
export function globeTurnFor(a: LatLon, b: LatLon): Quaternion {
  const middle = greatCircle(a, b, 3)[1];
  const UP = new Vector3(0, 1, 0);
  const turn = frame(GLOBE.facing, UP).multiply(frame(middle, UP).transpose());
  return new Quaternion().setFromRotationMatrix(turn);
}

/**
 * How much of the globe shows: it rises into view as the first screen ends, stays through the destinations chapter
 * and is gone by the transfer chapter. 0 hides it.
 */
export function globeFade(phase: Phase, progress: number): number {
  if (phase !== 'browse') return 0;
  const { id, t } = chapterAt('pre', progress);
  if (id === 'sky') return smoothstep(t, 0.55, 0.9);
  if (id === 'destinations') return 1 - smoothstep(t, 0.93, 1);
  return 0;
}

/**
 * The plane's flight over the globe: every flight leaves Chișinău (r3 §5), so a plane elsewhere first flies home
 * (`back` s), then out along the arc (`seconds` s), each leg eased in and out; it cruises this high above the
 * surface (m) and brings its nose round over `turn` s where a leg begins.
 */
export const FLIGHT = { seconds: 1.6, back: 0.9, cruise: 1.5, turn: 0.3 };

/** A flight to `to`, started at `startedAt` (s) from wherever the plane, its nose and the globe were then. */
export interface ArcFlight {
  from: Vector3;
  to: LatLon;
  startedAt: number;
  turnFrom: Quaternion;
  headingFrom: Vector3;
}

const easeInOut = (u: number) => (u < 0.5 ? 4 * u ** 3 : 1 - (-2 * u + 2) ** 3 / 2);
/** Closer than this (radians) two points are the same place. */
const SAME = 1e-6;
const ABOVE_HOME = latLonToVector(HOME.lat, HOME.lon, GLOBE.radius + FLIGHT.cruise);

/**
 * A leg from `from` (globe frame) to `to`, `e` (0 … 1) along it: the great circle, lifted like an arc; the nose level
 * along the way (or `still` where there is no way to go).
 */
function leg(from: Vector3, to: LatLon, e: number, still: Vector3): { position: Vector3; heading: Vector3 } {
  const fromDir = from.clone().normalize();
  const toDir = latLonToVector(to.lat, to.lon);
  const angle = fromDir.angleTo(toDir);
  const axis = angle > SAME ? fromDir.clone().cross(toDir).normalize() : null;
  const dir = axis ? fromDir.applyAxisAngle(axis, angle * e) : fromDir;
  const start = from.length() - GLOBE.radius;
  const height = start + (FLIGHT.cruise - start) * e + GLOBE.radius * ((ARC_RISE * angle) / Math.PI) * Math.sin(Math.PI * e);
  return { position: dir.clone().multiplyScalar(GLOBE.radius + height), heading: axis ? axis.clone().cross(dir).normalize() : level(still, dir) };
}

/** `heading` laid level at the point straight out along `up`. */
function level(heading: Vector3, up: Vector3): Vector3 {
  return heading.clone().sub(up.clone().multiplyScalar(heading.dot(up))).normalize();
}

/** The nose `w` of the way round from `from` to `to`, turning about `up` (whichever way is shorter). */
function turnNose(from: Vector3, to: Vector3, up: Vector3, w: number): Vector3 {
  const a = level(from, up);
  const angle = Math.atan2(up.dot(a.clone().cross(to)), a.dot(to));
  return a.applyAxisAngle(up, angle * w);
}

/** How long the flight takes home (0 when it starts there) and in all; a flight to where the plane is takes none. */
function timing(f: ArcFlight): { back: number; total: number } {
  const fromDir = f.from.clone().normalize();
  if (fromDir.angleTo(latLonToVector(f.to.lat, f.to.lon)) < SAME) return { back: 0, total: 0 };
  const back = fromDir.angleTo(ABOVE_HOME.clone().normalize()) > SAME ? FLIGHT.back : 0;
  return { back, total: back + FLIGHT.seconds };
}

/** Where the plane is on the flight at `now` (globe frame), its nose level along its way, and whether it has landed. */
export function flightAt(flight: ArcFlight, now: number): { position: Vector3; heading: Vector3; done: boolean } {
  const { back, total } = timing(flight);
  const t = now - flight.startedAt;
  // a hair of slack: a flight is over at startedAt + its time, whatever the rounding
  if (total === 0 || t >= total - 1e-9) {
    const end = total === 0 ? { position: flight.from.clone(), heading: level(flight.headingFrom, flight.from.clone().normalize()) } : leg(ABOVE_HOME, flight.to, 1, flight.headingFrom);
    return { ...end, done: true };
  }
  const home = back ? leg(flight.from, HOME, 1, flight.headingFrom) : null;
  const homeward = t < back;
  const at = homeward
    ? leg(flight.from, HOME, easeInOut(Math.max(0, t) / back), flight.headingFrom)
    : leg(ABOVE_HOME, flight.to, easeInOut((t - back) / FLIGHT.seconds), home ? home.heading : flight.headingFrom);
  // where a leg begins the plane is still: its nose comes round from where it pointed
  const before = homeward || !home ? flight.headingFrom : home.heading;
  const w = smoothstep(t - (homeward ? 0 : back), 0, FLIGHT.turn);
  const heading = w < 1 ? turnNose(before, at.heading, at.position.clone().normalize(), w) : at.heading;
  return { position: at.position, heading, done: false };
}

/**
 * How much of the chosen flight's arc (from Chișinău) is drawn, 0 … 1: none while the plane flies home, then with the
 * plane, eased the same way; all of it at rest.
 */
export function arcDrawn(flight: ArcFlight | null, now: number): number {
  if (!flight) return 1;
  const { back, total } = timing(flight);
  if (total === 0) return 1;
  const t = now - flight.startedAt;
  return t < back ? 0 : easeInOut(MathUtils.clamp((t - back) / FLIGHT.seconds, 0, 1));
}

/** The plane over the globe (its frame): on its flight, or before any pick waiting over Chișinău, nose to `chosen`. */
export function planeOnGlobe(flight: ArcFlight | null, chosen: LatLon, now: number): { position: Vector3; heading: Vector3 } {
  if (flight) {
    const { position, heading } = flightAt(flight, now);
    return { position, heading };
  }
  return leg(ABOVE_HOME, chosen, 0, new Vector3(0, 1, 0));
}

/** The globe's turn at `now`: easing over the whole flight from where it stood to the new flight's, else facing `chosen`. */
export function globeTurnAt(flight: ArcFlight | null, chosen: LatLon, now: number): Quaternion {
  if (!flight) return globeTurnFor(HOME, chosen);
  const { total } = timing(flight);
  const u = total === 0 ? 1 : MathUtils.clamp((now - flight.startedAt) / total, 0, 1);
  return flight.turnFrom.clone().slerp(globeTurnFor(HOME, flight.to), easeInOut(u));
}

/** A flight to `to` picked at `now`: from the plane, its nose and the globe as they are, mid-flight or not. */
export function nextFlight(current: ArcFlight | null, chosen: LatLon, to: LatLon, now: number): ArcFlight {
  const plane = planeOnGlobe(current, chosen, now);
  return { from: plane.position, to, startedAt: now, turnFrom: globeTurnAt(current, chosen, now), headingFrom: plane.heading };
}

/** A point over the globe in the world: where it is, its heading, and its up (away from the globe's centre). */
export function toWorld(local: { position: Vector3; heading: Vector3 }, turn: Quaternion): { position: Vector3; heading: Vector3; up: Vector3 } {
  return {
    position: local.position.clone().applyQuaternion(turn).add(GLOBE.center),
    heading: local.heading.clone().applyQuaternion(turn),
    up: local.position.clone().normalize().applyQuaternion(turn),
  };
}

/** The plane comes to the globe from this far round it, behind its horizon, over this share of the chapter; it
 * leaves over the nearest horizon, this far round, over this stretch — gone before the globe fades. */
const ARRIVAL = { angle: degToRad(130), share: 0.3, leaves: { angle: degToRad(110), from: 0.6, to: 0.92 } };

/** How far the plane has come over the globe's horizon (0 … 1): it arrives early in the destinations chapter. */
export function arrivalAt(phase: Phase, progress: number): number {
  if (phase !== 'browse') return 1;
  const { id, t } = chapterAt('pre', progress);
  if (id === 'sky') return 0;
  return id === 'destinations' ? smoothstep(t, 0, ARRIVAL.share) : 1;
}

/** How far the plane has gone on over the horizon (0 … 1) as the destinations chapter ends. */
export function departureAt(phase: Phase, progress: number): number {
  const { id, t } = chapterAt('pre', progress);
  if (phase !== 'browse' || id === 'sky') return 0;
  return id === 'destinations' ? smoothstep(t, ARRIVAL.leaves.from, ARRIVAL.leaves.to) : 1;
}

/**
 * Leaving `at` (globe frame), `k` of the way: it turns away from the globe's middle as the camera sees it (`facing`,
 * globe frame) and flies over the nearest horizon, gathering speed — slow while it crosses the face of the globe.
 */
export function leaving(at: { position: Vector3; heading: Vector3 }, k: number, facing: Vector3): { position: Vector3; heading: Vector3 } {
  if (k <= 0) return at;
  const up = at.position.clone().normalize();
  const away = awayFrom(at, facing);
  const axis = up.clone().cross(away).normalize();
  const ahead = ARRIVAL.leaves.angle * k ** 2;
  // the nose comes round to the way out over the first stretch
  const nose = at.heading.clone().lerp(away, smoothstep(k, 0, 0.3)).normalize();
  return { position: at.position.clone().applyAxisAngle(axis, ahead), heading: nose.applyAxisAngle(axis, ahead) };
}

/** The way from `at` away from the globe's middle as the camera sees it (`facing`, globe frame): to the nearest horizon. */
function awayFrom(at: { position: Vector3; heading: Vector3 }, facing: Vector3): Vector3 {
  const up = at.position.clone().normalize();
  const away = up.clone().multiplyScalar(up.dot(facing)).sub(facing);
  return (away.lengthSq() < 1e-8 ? at.heading.clone() : away).normalize();
}

/**
 * On its way to `at` (globe frame), `k` of the way: in from behind the horizon beyond it — on the far side of the
 * globe from the camera (`facing`, globe frame), wherever `at` is — slowing down, its nose coming round to `at`'s.
 */
export function arriving(at: { position: Vector3; heading: Vector3 }, k: number, facing: Vector3): { position: Vector3; heading: Vector3 } {
  if (k >= 1) return at;
  const up = at.position.clone().normalize();
  const away = awayFrom(at, facing);
  const axis = up.clone().cross(away).normalize();
  const out = ARRIVAL.angle * (1 - k) ** 2;
  const position = at.position.clone().applyAxisAngle(axis, out);
  // flying in: towards `at`, the nose turning to its own over the last stretch
  const inward = away.clone().negate().applyAxisAngle(axis, out);
  return { position, heading: turnNose(inward, at.heading.clone().applyAxisAngle(axis, out), position.clone().normalize(), smoothstep(k, 0.7, 1)) };
}

/**
 * The plane over the globe in the world while it is there: from coming over the horizon to having gone back over it
 * (then, still hidden by the globe, it leaves for the next chapter); undefined elsewhere.
 */
export function planeOverGlobe(
  phase: Phase,
  progress: number,
  flight: ArcFlight | null,
  chosen: LatLon,
  now: number,
): { position: Vector3; heading: Vector3; up: Vector3 } | undefined {
  if (phase !== 'browse' || chapterAt('pre', progress).id !== 'destinations') return undefined;
  const gone = departureAt(phase, progress);
  if (gone >= 1) return undefined;
  const turn = globeTurnAt(flight, chosen, now);
  const facing = GLOBE.facing.clone().applyQuaternion(turn.clone().invert());
  const there = arriving(planeOnGlobe(flight, chosen, now), arrivalAt(phase, progress), facing);
  return toWorld(leaving(there, gone, facing), turn);
}

