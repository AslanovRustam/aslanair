import { CatmullRomCurve3, MathUtils, Vector3, type PerspectiveCamera } from 'three';
import { chapterAt, trackProgress } from './chapters';
import { COCKPIT_DOOR } from './cabinLayout';
import { GLOBE } from './globe';
import { HERO_PICTURE, heroScale, INTRO } from './introState';
import {
  CABIN_WALL_Z,
  DOOR_1L,
  FLOOR_Y,
  EYE_SEATED,
  EYE_STANDING,
  SEATED_EYE_AFT,
  SEAT_Z,
  WINDOW,
  rowX,
  seatWindowStation,
  sideOf,
  stationToX,
  type SeatLetter,
} from './geometry';

export interface CameraPose {
  position: Vector3;
  target: Vector3;
  fov: number;
  /** Lens shift: the frame's centre moves up by this many frame heights (0 when absent). */
  lift?: number;
}

/** Puts a pose's lens on the camera for a `width` × `height` frame: field of view and lens shift. */
export function applyLens(camera: PerspectiveCamera, pose: CameraPose, width: number, height: number): void {
  camera.fov = pose.fov;
  camera.aspect = width / height;
  const lift = pose.lift ?? 0;
  if (lift) camera.setViewOffset(width, height, 0, lift * height, width, height);
  else camera.clearViewOffset();
  camera.updateProjectionMatrix();
}

type SeatRef = { row: number; letter: SeatLetter };

const { lerp, smoothstep, clamp } = MathUtils;
const v = (x: number, y: number, z: number) => new Vector3(x, y, z);
const UP = v(0, 1, 0);

// --- sky: the hero frame (the capture pose, zoomed and lens-shifted) held in place; the gaze turns down and left
// while the plane climbs away up the frame (stage.ts), so the plane leaves at any aspect
const SKY = {
  position: INTRO.swapPose.position,
  target: INTRO.swapPose.target,
  fov: INTRO.swapPose.fov,
  gazeDown: MathUtils.degToRad(28),
  gazeLeft: MathUtils.degToRad(10),
};
/** Where the door flight sets off: the camera's position and the point it looks at. */
const DOOR_START = { position: v(34, 4.5, -30), target: v(8, 0.5, -1) };

// --- door: one curve from the sky shot, through door 1L, to the aisle start
const DOOR_CURVE = new CatmullRomCurve3(
  [DOOR_START.position, v(24, 2.2, -16), v(17, 1.0, -7.5), v(13.9, 0.95, -4.2), v(13.9, 1.1, -2.4), v(13.9, 1.2, -0.9), v(13.1, 1.2, -0.15), v(12.6, 1.2, 0)],
  false,
  'centripetal',
);
const DOOR_CENTRE = v(stationToX(DOOR_1L.station), DOOR_1L.y, DOOR_1L.hinge[2]);
/** Straight in through door 1L, across the cabin: the gaze moves on here before the camera passes the doorway. */
const DOOR_ACROSS = DOOR_CENTRE.clone().add(v(0, 0, 2.5));
/** On entry the camera looks at the flight-deck door, up at the panel and peephole: its top, the jump seat and the
 * arrowed exit sign stay in frame. */
export const COCKPIT_LOOK = v(stationToX(COCKPIT_DOOR.station), FLOOR_Y + 1.4, COCKPIT_DOOR.z);

// --- aisle: stops level with row 26 so rows 27–30 stay in view ahead
const AISLE = { startX: 12.6, endX: rowX(26) + 0.6, lookAhead: v(-6, -0.15, 0), fov: 60 };
/** Where the door flight hands over to the aisle walk. */
const CABIN_LOOK = v(AISLE.startX, EYE_STANDING, 0).add(AISLE.lookAhead);

const span = (id: 'ready' | 'door') => trackProgress('pre', id, 1) - trackProgress('pre', id, 0);

/** The hero lens for this aspect: the capture camera's field of view opened to the hero picture's size. */
function heroFov(aspect: number): number {
  return (2 * Math.atan(Math.tan(MathUtils.degToRad(SKY.fov / 2)) / heroScale(aspect)) * 180) / Math.PI;
}

/**
 * The first screen. The camera is the capture camera zoomed out to the hero's picture size and lens-shifted up (the
 * loader's picture to the pixel); it stays put while its gaze turns down and to the left, from rest to rest.
 */
function skyPose(t: number, aspect: number): CameraPose {
  const k = smoothstep(t, 0.05, 1);
  const gaze = SKY.target.clone().sub(SKY.position).applyAxisAngle(UP, SKY.gazeLeft * k);
  gaze.applyAxisAngle(gaze.clone().cross(UP).normalize(), -SKY.gazeDown * k);
  return { position: SKY.position.clone(), target: SKY.position.clone().add(gaze), fov: heroFov(aspect), lift: HERO_PICTURE.lift };
}

// --- destinations: from the same spot the camera turns to the globe and closes in, the lens shift easing out
const GLOBE_SHARE = { height: 0.6, width: 0.85 };
/** Narrower than this the chapter's words go above and below the globe: it is smaller and rides higher. */
const NARROW = { below: 1.2, height: 0.45, lift: 0.1 };

/** The lens that shows the globe at GLOBE_SHARE of the frame height — or of its width on a narrow screen. */
function globeFov(aspect: number): number {
  const grazing = Math.tan(Math.asin(GLOBE.radius / GLOBE.center.distanceTo(SKY.position)));
  const height = aspect < NARROW.below ? NARROW.height : GLOBE_SHARE.height;
  return (2 * Math.atan(grazing / Math.min(height, GLOBE_SHARE.width * aspect)) * 180) / Math.PI;
}

function destinationsPose(t: number, aspect: number): CameraPose {
  const from = skyPose(1, aspect);
  const k = smoothstep(t, 0, 0.35);
  const lift = HERO_PICTURE.lift * (1 - k) + (aspect < NARROW.below ? NARROW.lift : 0) * k;
  return {
    position: from.position,
    target: from.target.lerp(GLOBE.center, k),
    fov: lerp(from.fov, globeFov(aspect), k),
    ...(lift ? { lift } : {}),
  };
}

// --- transfer: the camera turns up from the globe to the plane waiting beside the choices — on the right on a wide
// screen, across the top on a narrow one — smaller than in the hero
const TRANSFER = {
  from: v(52, 9, -46).normalize(),
  distance: 130,
  /** Below this aspect the camera stands back so the plane stays in the right half. */
  fit: 16 / 9,
  /** Where the plane's middle sits across a wide frame. */
  place: 0.72,
  narrow: { distance: 175, lift: 0.28 },
  /** The share of the chapter the camera takes to turn up from the globe. */
  turn: 0.6,
};

function transferFrame(aspect: number): CameraPose {
  if (aspect < NARROW.below) {
    return { position: TRANSFER.from.clone().multiplyScalar(TRANSFER.narrow.distance), target: v(0, 0, 0), fov: SKY.fov, lift: TRANSFER.narrow.lift };
  }
  const distance = TRANSFER.distance * Math.max(1, TRANSFER.fit / aspect);
  const position = TRANSFER.from.clone().multiplyScalar(distance);
  // look to the left of the plane by as much as puts it at `place` across the frame
  const left = UP.clone().cross(position).normalize().negate();
  const aside = (TRANSFER.place - 0.5) * 2 * distance * Math.tan(MathUtils.degToRad(SKY.fov / 2)) * aspect;
  return { position, target: left.multiplyScalar(aside), fov: SKY.fov };
}

function transferPose(t: number, aspect: number): CameraPose {
  const from = destinationsPose(1, aspect);
  const to = transferFrame(aspect);
  // slow to a stop: the plane comes into view over the second half of the turn
  const k = smoothstep(t, 0, TRANSFER.turn);
  const lift = lerp(from.lift ?? 0, to.lift ?? 0, k);
  return {
    position: from.position.clone().lerp(to.position, k),
    target: from.target.clone().lerp(to.target, k),
    fov: lerp(from.fov, to.fov, k),
    ...(lift ? { lift } : {}),
  };
}

/** The door curve's starting speed, in metres per unit of track progress. */
const DOOR_START_SPEED = (() => {
  const h = 1e-4;
  return DOOR_CURVE.getPoint(h).distanceTo(DOOR_CURVE.getPoint(0)) / h / span('door');
})();

/**
 * Ready to choose your seat: from the transfer's frame the camera closes in to the door flight's start, the lens
 * becoming the capture camera's and the gaze coming round to the door, while the plane turns to face it (stage.ts).
 */
function readyPose(t: number, aspect: number): CameraPose {
  const from = transferPose(1, aspect);
  // from rest to the door curve's own starting speed (for this screen's frame): f(0) = 0, f'(0) = 0, f(1) = 1, f'(1) = k
  const k = (DOOR_START_SPEED * span('ready')) / from.position.distanceTo(DOOR_START.position);
  const f = (k - 2) * t ** 3 + (3 - k) * t ** 2;
  const open = smoothstep(t, 0, 1);
  const lift = (from.lift ?? 0) * (1 - open);
  return {
    position: from.position.clone().lerp(DOOR_START.position, f),
    target: from.target.clone().lerp(DOOR_START.target, open),
    fov: lerp(from.fov, SKY.fov, open),
    ...(lift ? { lift } : {}),
  };
}

/**
 * The target `k` of the way through turning the gaze from `a` to `b` about the vertical, pitch and distance blended.
 * Lerping the points themselves would swing the gaze through the eye when they lie on opposite sides of it.
 * `starboard` turns through +z whichever way is shorter.
 */
function turnGaze(eye: Vector3, a: Vector3, b: Vector3, k: number, starboard = false): Vector3 {
  if (k <= 0) return a.clone();
  if (k >= 1) return b.clone();
  const da = a.clone().sub(eye);
  const db = b.clone().sub(eye);
  const yawA = Math.atan2(da.z, da.x);
  let turn = Math.atan2(db.z, db.x) - yawA;
  if (starboard) turn = ((turn % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  else turn = Math.atan2(Math.sin(turn), Math.cos(turn));
  const yaw = yawA + turn * k;
  const pitch = lerp(Math.atan2(da.y, Math.hypot(da.x, da.z)), Math.atan2(db.y, Math.hypot(db.x, db.z)), k);
  const dir = v(Math.cos(yaw) * Math.cos(pitch), Math.sin(pitch), Math.sin(yaw) * Math.cos(pitch));
  return eye.clone().addScaledVector(dir, lerp(da.length(), db.length(), k));
}

function doorPose(t: number): CameraPose {
  const position = DOOR_CURVE.getPoint(t);
  // the approach: from the first look at the plane to the doorway, then on across the cabin
  const approach = DOOR_START.target.clone().lerp(DOOR_CENTRE, smoothstep(t, 0, 0.35)).lerp(DOOR_ACROSS, smoothstep(t, 0.35, 0.55));
  // inside: a look at the flight-deck door, held, then a turn across the galley down the aisle
  const nose = turnGaze(position, approach, COCKPIT_LOOK, smoothstep(t, 0.62, 0.76));
  return {
    position,
    target: turnGaze(position, nose, CABIN_LOOK, smoothstep(t, 0.8, 1), true),
    fov: lerp(30, AISLE.fov, smoothstep(t, 0.55, 0.76)),
  };
}

function aislePose(t: number): CameraPose {
  const position = v(lerp(AISLE.startX, AISLE.endX, t), EYE_STANDING, 0);
  return { position, target: position.clone().add(AISLE.lookAhead), fov: AISLE.fov };
}

export function poseOnPreTrack(progress: number, aspect = 16 / 9): CameraPose {
  const { id, t } = chapterAt('pre', progress);
  if (id === 'sky') return skyPose(t, aspect);
  if (id === 'door') return doorPose(t);
  if (id === 'aisle') return aislePose(t);
  if (id === 'destinations') return destinationsPose(t, aspect);
  if (id === 'transfer') return transferPose(t, aspect);
  return readyPose(t, aspect);
}

export function aisleProgressForRow(row: number): number {
  const x = rowX(row) + 0.6;
  return trackProgress('pre', 'aisle', (AISLE.startX - x) / (AISLE.startX - AISLE.endX));
}

function windowX(row: number): number {
  return stationToX(seatWindowStation(row));
}

export function seatedPose(seat: SeatRef): CameraPose {
  const side = sideOf(seat.letter);
  const eye = v(rowX(seat.row) - SEATED_EYE_AFT, EYE_SEATED, SEAT_Z[seat.letter]);
  // level gaze through the middle of the row's window (up to ~0.27 m along the aisle from the eye)
  const toWindow = v(windowX(seat.row), 0, side * CABIN_WALL_Z).sub(v(eye.x, 0, eye.z));
  const target = eye.clone().addScaledVector(toWindow, 3.4 / Math.abs(toWindow.z));
  target.y = WINDOW.y - 0.05;
  return { position: eye, target, fov: 55 };
}

export function exitControlPoints(seat: SeatRef): Vector3[] {
  const side = sideOf(seat.letter);
  const wx = windowX(seat.row);
  return [
    seatedPose(seat).position,
    v(wx, WINDOW.y, side * CABIN_WALL_Z),
    v(wx + 0.5, 0.9, side * 7),
    v(wx + 16, 7, side * 44),
  ];
}

/** Post-track progress where the way out reaches the window: the exit curve's second of four points, at t = 1/3. */
export const WINDOW_ON_EXIT = trackProgress('post', 'exit', 1 / 3);

export function aircraftFlyAway(postProgress: number): { offsetX: number; climb: number; bank: number } {
  const u = clamp((postProgress - 0.6) / 0.4, 0, 1);
  // `|| 0` keeps −0 out of the results
  return { offsetX: 900 * u * u, climb: 60 * u * u, bank: -0.22 * Math.sin(Math.PI * u) || 0 };
}

export function poseOnPostTrack(progress: number, seat: SeatRef): CameraPose {
  const { id, t } = chapterAt('post', progress);
  if (id === 'pass') return seatedPose(seat);
  const points = exitControlPoints(seat);
  const fly = aircraftFlyAway(progress);
  const aircraft = v(fly.offsetX, fly.climb, 0);
  if (id === 'exit') {
    const curve = new CatmullRomCurve3(points, false, 'centripetal');
    return {
      position: curve.getPoint(t),
      target: seatedPose(seat).target.lerp(aircraft, smoothstep(t, 0.35, 0.75)),
      fov: lerp(55, 35, smoothstep(t, 0.2, 0.9)),
    };
  }
  return { position: points[3].clone(), target: aircraft, fov: 35 };
}
