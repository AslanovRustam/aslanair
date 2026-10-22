// Aircraft and cabin dimensions in metres, mirrored from tools/blender/airliner.py.
// World axes (three.js, Y up): the nose points to +X, the port (left) side is −Z.

export const FUSELAGE_LENGTH = 37.6;

/** Fuselage station (metres from the nose) → world X. */
export function stationToX(s: number): number {
  return FUSELAGE_LENGTH / 2 - s;
}

export const FLOOR_Y = -0.45;
export const EYE_STANDING = 1.2;
export const EYE_SEATED = 0.7;
export const CEILING_Y = 1.75;
/** Inner cabin wall at window height (|z|); from public/models/airliner.meta.json (cabinWallZ). */
export const CABIN_WALL_Z = 1.7931;

export const ROWS = 30;
export const FIRST_ROW_STATION = 7.0;
export const ROW_PITCH = 0.76; // ≈30 in, A320 economy; row 30 stays ahead of the tail taper

export function rowStation(row: number): number {
  return FIRST_ROW_STATION + (row - 1) * ROW_PITCH;
}

export function rowX(row: number): number {
  return stationToX(rowStation(row));
}

export type SeatLetter = 'A' | 'B' | 'C' | 'D' | 'E' | 'F';
export const SEAT_LETTERS: SeatLetter[] = ['A', 'B', 'C', 'D', 'E', 'F'];
export const SEAT_Z: Record<SeatLetter, number> = { A: -1.42, B: -0.94, C: -0.46, D: 0.46, E: 0.94, F: 1.42 };

/** Seat footprint on the floor (metres): depth along the aisle, width across. */
export const SEAT_FOOTPRINT = { depth: 0.5, width: 0.44 } as const;

export function sideOf(letter: SeatLetter): -1 | 1 {
  return SEAT_Z[letter] < 0 ? -1 : 1;
}

export const WINDOW = { y: 0.62, firstStation: 6.55, pitch: 0.533, lastStation: 29.0, w: 0.23, h: 0.33 } as const;

export function windowStations(): number[] {
  const out: number[] = [];
  for (let k = 0; WINDOW.firstStation + k * WINDOW.pitch < WINDOW.lastStation; k++) {
    out.push(WINDOW.firstStation + k * WINDOW.pitch);
  }
  return out;
}

export function nearestWindowStation(s: number): number {
  return windowStations().reduce((best, w) => (Math.abs(w - s) < Math.abs(best - s) ? w : best));
}

/** Over-wing emergency exits (stations), from public/models/airliner.meta.json; rows 13 and 14 sit beside them. */
export const OVERWING_EXIT_STATIONS = [16.05, 16.8] as const;

/** Door 1L, from public/models/airliner.meta.json: a plug door that slides out, then forward. */
export const DOOR_1L = {
  station: 4.9,
  y: 0.525, // centre: sill −0.40 + height / 2
  width: 0.82,
  height: 1.85,
  side: -1,
  hinge: [14.31, 0.525, -1.7932] as [number, number, number],
  open: { outward: 0.35, forward: 1.0 },
} as const;

/** The seated eye sits this far aft of the row's station (head against the backrest). */
export const SEATED_EYE_AFT = 0.15;

/** The window a seated passenger of this row looks out of: the one nearest their eye. */
export function seatWindowStation(row: number): number {
  return nearestWindowStation(rowStation(row) + SEATED_EYE_AFT);
}

export function seatWorldPosition(row: number, letter: SeatLetter): [number, number, number] {
  return [rowX(row), FLOOR_Y, SEAT_Z[letter]];
}
