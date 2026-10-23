import { CatmullRomCurve3, MathUtils, Vector3 } from 'three';
import { chapterAt, trackProgress } from './chapters';
import { COCKPIT_DOOR } from './cabinLayout';
import { INTRO } from './introState';
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
}

type SeatRef = { row: number; letter: SeatLetter };

const { lerp, smoothstep, clamp } = MathUtils;
const v = (x: number, y: number, z: number) => new Vector3(x, y, z);

// --- sky: holds the pose the hero picture was captured at until the picture has handed over, then sets off
const SKY = {
  from: INTRO.swapPose.position,
  to: v(34, 4.5, -30),
  targetFrom: INTRO.swapPose.target,
  targetTo: v(8, 0.5, -1),
  fov: INTRO.swapPose.fov,
  hold: INTRO.swapAt + INTRO.crossfade,
};

// --- door: one curve from the sky shot, through door 1L, to the aisle start
const DOOR_CURVE = new CatmullRomCurve3(
  [v(34, 4.5, -30), v(24, 2.2, -16), v(17, 1.0, -7.5), v(13.9, 0.95, -4.2), v(13.9, 1.1, -2.4), v(13.9, 1.2, -0.9), v(13.1, 1.2, -0.15), v(12.6, 1.2, 0)],
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

const span = (id: 'sky' | 'door') => trackProgress('pre', id, 1) - trackProgress('pre', id, 0);
/**
 * The camera's speed leaving the sky shot, in lengths of the sky move per unit of it, so that it meets the door
 * curve at the curve's own starting speed.
 */
const SKY_EXIT_SPEED = (() => {
  const h = 1e-4;
  const doorSpeed = DOOR_CURVE.getPoint(h).distanceTo(DOOR_CURVE.getPoint(0)) / h / span('door');
  return (doorSpeed * span('sky') * (1 - SKY.hold)) / SKY.from.distanceTo(SKY.to);
})();

function skyPose(t: number): CameraPose {
  const u = clamp((t - SKY.hold) / (1 - SKY.hold), 0, 1);
  // from rest to the door curve's speed: f(0) = 0, f'(0) = 0, f(1) = 1, f'(1) = SKY_EXIT_SPEED
  const k = SKY_EXIT_SPEED;
  const f = (k - 2) * u ** 3 + (3 - k) * u ** 2;
  return {
    position: SKY.from.clone().lerp(SKY.to, f),
    // the door flight's gaze starts at rest, so this one comes to rest
    target: SKY.targetFrom.clone().lerp(SKY.targetTo, smoothstep(u, 0, 1)),
    fov: SKY.fov,
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
  // the approach: from the sky shot's target to the doorway, then on across the cabin
  const approach = SKY.targetTo.clone().lerp(DOOR_CENTRE, smoothstep(t, 0, 0.35)).lerp(DOOR_ACROSS, smoothstep(t, 0.35, 0.55));
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

export function poseOnPreTrack(progress: number): CameraPose {
  const { id, t } = chapterAt('pre', progress);
  if (id === 'sky') return skyPose(t);
  if (id === 'door') return doorPose(t);
  if (id === 'aisle') return aislePose(t);
  // the journey's chapters (destinations, transfer, ready) hold the sky shot's end until they get poses of their own
  return skyPose(1);
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
