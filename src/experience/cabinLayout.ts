// Where the cabin kit's parts go. Pure: instance matrices and boxes, no rendering.
import { Matrix4 } from 'three';
import { FLOOR_Y, ROWS, rowX, SEAT_Z, seatWorldPosition } from './geometry';
import type { Seat } from './seats';

/** Kit seat (metres above the floor / along the seat's facing), mirrored from public/models/cabin-kit.meta.json. */
export const SEAT_KIT = { depth: 0.5, width: 0.44, panTop: 0.45, armTop: 0.65, height: 1.08, backFrontTopX: -0.3 } as const;

export function seatMatrices(seats: Seat[]): Matrix4[] {
  return seats.map((s) => new Matrix4().makeTranslation(...seatWorldPosition(s.row, s.letter)));
}

/** Armrests across a row: both ends of each triple and midway between neighbouring seats. */
const ARM_Z = [
  SEAT_Z.A - SEAT_KIT.width / 2,
  (SEAT_Z.A + SEAT_Z.B) / 2,
  (SEAT_Z.B + SEAT_Z.C) / 2,
  SEAT_Z.C + SEAT_KIT.width / 2,
  SEAT_Z.D - SEAT_KIT.width / 2,
  (SEAT_Z.D + SEAT_Z.E) / 2,
  (SEAT_Z.E + SEAT_Z.F) / 2,
  SEAT_Z.F + SEAT_KIT.width / 2,
];

export function armMatrices(): Matrix4[] {
  const out: Matrix4[] = [];
  for (let row = 1; row <= ROWS; row++) for (const z of ARM_Z) out.push(new Matrix4().makeTranslation(rowX(row), FLOOR_Y, z));
  return out;
}
