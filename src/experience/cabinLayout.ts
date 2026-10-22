// Where the cabin kit's parts go. Pure: instance matrices and boxes, no rendering.
import { Box3, Matrix4, Ray, Vector3 } from 'three';
import { CABIN_WALL_Z, CEILING_Y, FLOOR_Y, ROWS, rowX, SEAT_LETTERS, SEAT_Z, seatWorldPosition, stationToX, type SeatLetter } from './geometry';
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
/** Closer than this to a seat's centre, the camera sits in that seat: the seated eye is 0.62 m from its own seat's
 * centre, 0.77 m from the neighbour's and ≥ 0.85 m from the seat in front. */
const INSIDE_SEAT = 0.7;
const SEAT_CENTRE_Y = 0.55;

/** Whether a camera at `p` sits inside seat `id` (e.g. '14F'): its own seat would fill the edge of the view. */
export function isInsideSeat(p: Vector3, id: string, radius = INSIDE_SEAT): boolean {
  const [x, y, z] = seatWorldPosition(Number(id.slice(0, -1)), id.at(-1) as SeatLetter);
  return p.distanceTo(new Vector3(x, y + SEAT_CENTRE_Y, z)) < radius;
}

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

/** Entry zone, mirrored from the kit meta: galley (starboard, opposite door 1L), curtain drapes, exit signs. */
export const GALLEY = { s0: 4.05, s1: 5.75, innerZ: 0.32, topY: 1.4, worktopY: 0.1 } as const;
export const CURTAIN = { station: 6.45, innerZ: 0.62, outerZ: 0.95, bottomY: -0.25 } as const;
export const EXIT_SIGN = {
  w: 0.3,
  h: 0.11,
  d: 0.05,
  y: 1.58,
  placements: [[5.85, 'aft'], [16.45, 'aft'], [16.45, 'fore'], [30.25, 'fore']] as [number, 'aft' | 'fore'][],
} as const;

/** Where the walking camera must keep clear: bins, galley, curtain drapes, exit signs, row-1 seats. */
export function furnishingBoxes(): Box3[] {
  const box = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number) =>
    new Box3(new Vector3(Math.min(x0, x1), y0, Math.min(z0, z1)), new Vector3(Math.max(x0, x1), y1, Math.max(z0, z1)));
  const boxes = binBoxes();
  boxes.push(box(stationToX(GALLEY.s1), FLOOR_Y, GALLEY.innerZ, stationToX(GALLEY.s0), GALLEY.topY, CABIN_WALL_Z));
  const cx = stationToX(CURTAIN.station);
  for (const side of [-1, 1]) boxes.push(box(cx - 0.06, CURTAIN.bottomY, side * CURTAIN.innerZ, cx + 0.06, CEILING_Y, side * CURTAIN.outerZ));
  for (const [s] of EXIT_SIGN.placements) {
    const x = stationToX(s);
    boxes.push(box(x - EXIT_SIGN.d / 2, EXIT_SIGN.y - EXIT_SIGN.h / 2, -EXIT_SIGN.w / 2, x + EXIT_SIGN.d / 2, EXIT_SIGN.y + EXIT_SIGN.h / 2, EXIT_SIGN.w / 2));
  }
  for (const letter of SEAT_LETTERS) {
    const x = rowX(1);
    const z = SEAT_Z[letter];
    // the reclined back overhangs ~0.15 m aft of the footprint
    boxes.push(box(x - SEAT_KIT.depth / 2 - 0.15, FLOOR_Y, z - SEAT_KIT.width / 2, x + SEAT_KIT.depth / 2, FLOOR_Y + SEAT_KIT.height, z + SEAT_KIT.width / 2));
  }
  return boxes;
}

/** True when the segment a→b passes through any box. */
export function segmentHitsBoxes(a: Vector3, b: Vector3, boxes: Box3[]): boolean {
  const dir = b.clone().sub(a);
  const length = dir.length();
  const ray = new Ray(a, dir.normalize());
  const hit = new Vector3();
  return boxes.some((box) => box.containsPoint(a) || (ray.intersectBox(box, hit) !== null && hit.distanceTo(a) <= length));
}
