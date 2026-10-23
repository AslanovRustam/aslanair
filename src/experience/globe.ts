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

/** The plane's flight over the globe: this long (s), eased in and out, cruising this high above the surface (m). */
export const FLIGHT = { seconds: 1.6, cruise: 1.5 };

/** A flight to `to`, started at `startedAt` (s) from wherever the plane and the globe were then. */
export interface ArcFlight {
  from: Vector3;
  to: LatLon;
  startedAt: number;
  turnFrom: Quaternion;
}

const easeInOut = (u: number) => (u < 0.5 ? 4 * u ** 3 : 1 - (-2 * u + 2) ** 3 / 2);
const NORTH = new Vector3(0, 1, 0);

/** The way from the flight's start to its city, `e` (0 … 1) along it: the great circle, lifted like an arc. */
function along(f: ArcFlight, e: number): { position: Vector3; heading: Vector3 } {
  const fromDir = f.from.clone().normalize();
  const toDir = latLonToVector(f.to.lat, f.to.lon);
  const angle = fromDir.angleTo(toDir);
  const axis = angle > 1e-9 ? fromDir.clone().cross(toDir).normalize() : null;
  const dir = axis ? fromDir.applyAxisAngle(axis, angle * e) : toDir;
  const start = f.from.length() - GLOBE.radius;
  const height = start + (FLIGHT.cruise - start) * e + GLOBE.radius * ((ARC_RISE * angle) / Math.PI) * Math.sin(Math.PI * e);
  // level, along the great circle (or towards the north when there is nowhere to go)
  const heading = axis ? axis.clone().cross(dir) : NORTH.clone().sub(dir.clone().multiplyScalar(dir.y));
  return { position: dir.clone().multiplyScalar(GLOBE.radius + height), heading: heading.normalize() };
}

/** Where the plane is on the flight at `now` (globe frame), its nose level along its way, and whether it has landed. */
export function flightAt(flight: ArcFlight, now: number): { position: Vector3; heading: Vector3; done: boolean } {
  // a hair of slack: a flight is over at startedAt + seconds, whatever the rounding
  const done = now - flight.startedAt >= FLIGHT.seconds - 1e-9;
  const u = done ? 1 : MathUtils.clamp((now - flight.startedAt) / FLIGHT.seconds, 0, 1);
  return { ...along(flight, easeInOut(u)), done };
}

/** How much of the chosen flight's arc is drawn (0 … 1): it draws with the plane, eased the same way; all of it at rest. */
export function arcDrawn(flight: ArcFlight | null, now: number): number {
  if (!flight) return 1;
  return easeInOut(MathUtils.clamp((now - flight.startedAt) / FLIGHT.seconds, 0, 1));
}

/** The plane over the globe (its frame): on its flight, or before any pick waiting over Chișinău, nose to `chosen`. */
export function planeOnGlobe(flight: ArcFlight | null, chosen: LatLon, now: number): { position: Vector3; heading: Vector3 } {
  if (flight) {
    const { position, heading } = flightAt(flight, now);
    return { position, heading };
  }
  const waiting = { from: latLonToVector(HOME.lat, HOME.lon, GLOBE.radius + FLIGHT.cruise), to: chosen, startedAt: 0, turnFrom: new Quaternion() };
  return along(waiting, 0);
}

/** The globe's turn at `now`: easing with the flight from where it stood to the new flight's, else facing `chosen`. */
export function globeTurnAt(flight: ArcFlight | null, chosen: LatLon, now: number): Quaternion {
  if (!flight) return globeTurnFor(HOME, chosen);
  const u = MathUtils.clamp((now - flight.startedAt) / FLIGHT.seconds, 0, 1);
  return flight.turnFrom.clone().slerp(globeTurnFor(HOME, flight.to), easeInOut(u));
}

/** A flight to `to` picked at `now`: from the plane and the globe as they are, mid-flight or not. */
export function nextFlight(current: ArcFlight | null, chosen: LatLon, to: LatLon, now: number): ArcFlight {
  return { from: planeOnGlobe(current, chosen, now).position, to, startedAt: now, turnFrom: globeTurnAt(current, chosen, now) };
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
  const away = up.clone().multiplyScalar(up.dot(facing)).sub(facing);
  if (away.lengthSq() < 1e-8) away.copy(at.heading);
  away.normalize();
  const axis = up.clone().cross(away).normalize();
  const ahead = ARRIVAL.leaves.angle * k ** 2;
  // the nose comes round to the way out over the first stretch
  const nose = at.heading.clone().lerp(away, smoothstep(k, 0, 0.3)).normalize();
  return { position: at.position.clone().applyAxisAngle(axis, ahead), heading: nose.applyAxisAngle(axis, ahead) };
}

/** On its way to `at` (globe frame), `k` of the way: along its own heading from behind the horizon, slowing down. */
export function arriving(at: { position: Vector3; heading: Vector3 }, k: number): { position: Vector3; heading: Vector3 } {
  const axis = at.position.clone().cross(at.heading).normalize();
  const back = -ARRIVAL.angle * (1 - k) ** 2;
  return { position: at.position.clone().applyAxisAngle(axis, back), heading: at.heading.clone().applyAxisAngle(axis, back) };
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
  const there = arriving(planeOnGlobe(flight, chosen, now), arrivalAt(phase, progress));
  return toWorld(leaving(there, gone, GLOBE.facing.clone().applyQuaternion(turn.clone().invert())), turn);
}

