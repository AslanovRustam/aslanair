import { MathUtils, Matrix4, Quaternion, Vector3 } from 'three';
import { chapterAt } from './chapters';
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
  if (id === 'destinations') return 1 - smoothstep(t, 0.9, 1);
  return 0;
}
