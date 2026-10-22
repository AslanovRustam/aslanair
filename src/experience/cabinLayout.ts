// Where the cabin kit's parts go. Pure: instance matrices and boxes, no rendering.
import { Box3, Matrix4, Vector3 } from 'three';
import { CABIN_WALL_Z, CEILING_Y, FLOOR_Y, ROWS, rowX, SEAT_Z, seatWorldPosition } from './geometry';
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

/** Overhead bin section (one row long), mirrored from the kit meta; the aisle door bulges `doorBulge` inwards. */
export const BIN = { length: 0.76, bottomY: 1.1, aisleZ: 0.98, doorBulge: 0.03 } as const;

/** One bin section per row, centred on the row; the side lives in the node (BinPort / BinStarboard). */
export function binMatrices(): Matrix4[] {
  return Array.from({ length: ROWS }, (_, i) => new Matrix4().makeTranslation(rowX(i + 1), 0, 0));
}

/** Bounding boxes of every bin section (both sides), out to the cabin wall. */
export function binBoxes(): Box3[] {
  const inner = BIN.aisleZ - BIN.doorBulge;
  const boxes: Box3[] = [];
  for (const side of [-1, 1]) {
    for (let row = 1; row <= ROWS; row++) {
      const x = rowX(row);
      const [z0, z1] = side < 0 ? [-CABIN_WALL_Z, -inner] : [inner, CABIN_WALL_Z];
      boxes.push(new Box3(new Vector3(x - BIN.length / 2, BIN.bottomY, z0), new Vector3(x + BIN.length / 2, CEILING_Y, z1)));
    }
  }
  return boxes;
}

export function distanceToBoxes(p: Vector3, boxes: Box3[]): number {
  return boxes.reduce((d, b) => Math.min(d, b.distanceToPoint(p)), Infinity);
}

/** Warm light strips along the ceiling next to the bin tops, from row 1 to row 30. */
export const CEILING_STRIPS = ([-1, 1] as const).map((side) => ({
  side,
  x0: rowX(ROWS) - BIN.length / 2,
  x1: rowX(1) + BIN.length / 2,
  z0: side * 0.86,
  z1: side * 0.94,
  y: CEILING_Y - 0.005,
}));
