import { CatmullRomCurve3, MathUtils, Vector3 } from 'three';
import { chapterAt, trackProgress } from './chapters';
import {
  CABIN_WALL_Z,
  EYE_SEATED,
  EYE_STANDING,
  SEAT_Z,
  WINDOW,
  nearestWindowStation,
  rowStation,
  rowX,
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

// --- sky
const SKY = { from: v(42, 6.5, -36), to: v(34, 4.5, -30), targetFrom: v(0, 0, 0), targetTo: v(8, 0.5, -1), fov: 30 };

// --- door: one curve from the sky shot, through door 1L, to the aisle start
const DOOR_CURVE = new CatmullRomCurve3(
  [v(34, 4.5, -30), v(24, 2.2, -16), v(17, 1.0, -7.5), v(13.9, 0.95, -4.2), v(13.9, 1.1, -2.4), v(13.9, 1.2, -0.9), v(13.1, 1.2, -0.15), v(12.6, 1.2, 0)],
  false,
  'centripetal',
);
const DOOR_CENTRE = v(13.9, 0.6, -1.9);
const CABIN_LOOK = v(5, 1.1, 0);

// --- aisle
const AISLE = { startX: 12.6, endX: -11.6, lookAhead: v(-6, -0.15, 0), fov: 60 };

function skyPose(t: number): CameraPose {
  return {
    position: SKY.from.clone().lerp(SKY.to, t),
    target: SKY.targetFrom.clone().lerp(SKY.targetTo, t),
    fov: SKY.fov,
  };
}

function doorPose(t: number): CameraPose {
  return {
    position: DOOR_CURVE.getPoint(t),
    target: DOOR_CENTRE.clone().lerp(CABIN_LOOK, smoothstep(t, 0.7, 1)),
    fov: lerp(30, AISLE.fov, smoothstep(t, 0.55, 0.9)),
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
  return aislePose(t);
}

export function aisleProgressForRow(row: number): number {
  const x = rowX(row) + 0.6;
  return trackProgress('pre', 'aisle', (AISLE.startX - x) / (AISLE.startX - AISLE.endX));
}

function windowX(row: number): number {
  return stationToX(nearestWindowStation(rowStation(row)));
}

export function seatedPose(seat: SeatRef): CameraPose {
  const side = sideOf(seat.letter);
  return {
    position: v(rowX(seat.row) - 0.15, EYE_SEATED, SEAT_Z[seat.letter]),
    target: v(windowX(seat.row), WINDOW.y - 0.05, side * (CABIN_WALL_Z + 3)),
    fov: 55,
  };
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

export function aircraftFlyAway(postProgress: number): { offsetX: number; climb: number; bank: number } {
  const u = clamp((postProgress - 0.6) / 0.4, 0, 1);
  // `|| 0` keeps −0 out of the results
  return { offsetX: 900 * u * u, climb: 60 * u * u, bank: -0.22 * Math.sin(Math.PI * u) || 0 };
}

export function poseOnPostTrack(progress: number, seat: SeatRef): CameraPose {
  const { id, t } = chapterAt('post', progress);
  if (id === 'pass') return seatedPose(seat);
  const points = exitControlPoints(seat);
  if (id === 'exit') {
    const curve = new CatmullRomCurve3(points, false, 'centripetal');
    return {
      position: curve.getPoint(t),
      target: seatedPose(seat).target.lerp(v(0, 0, 0), smoothstep(t, 0.35, 0.75)),
      fov: lerp(55, 35, smoothstep(t, 0.2, 0.9)),
    };
  }
  const fly = aircraftFlyAway(progress);
  return { position: points[3].clone(), target: v(fly.offsetX, fly.climb, 0), fov: 35 };
}
