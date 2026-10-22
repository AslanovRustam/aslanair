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
/** Inner cabin wall at window height (|z|). */
export const CABIN_WALL_Z = 1.8;

export const ROWS = 30;
export const FIRST_ROW_STATION = 7.3;
export const ROW_PITCH = 0.78;

export function rowStation(row: number): number {
  return FIRST_ROW_STATION + (row - 1) * ROW_PITCH;
}

export function rowX(row: number): number {
  return stationToX(rowStation(row));
}

export type SeatLetter = 'A' | 'B' | 'C' | 'D' | 'E' | 'F';
export const SEAT_LETTERS: SeatLetter[] = ['A', 'B', 'C', 'D', 'E', 'F'];
export const SEAT_Z: Record<SeatLetter, number> = { A: -1.42, B: -0.94, C: -0.46, D: 0.46, E: 0.94, F: 1.42 };

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

export const DOOR_1L = { station: 4.9, y: 0.05, width: 0.82, height: 1.86, side: -1 } as const;

export function seatWorldPosition(row: number, letter: SeatLetter): [number, number, number] {
  return [rowX(row), FLOOR_Y, SEAT_Z[letter]];
}
