import { describe, expect, test } from 'vitest';
import {
  nearestWindowStation,
  ROWS,
  rowStation,
  SEATED_EYE_AFT,
  seatWindowStation,
  seatWorldPosition,
  sideOf,
  stationToX,
  WINDOW,
  windowStations,
} from '@/experience/geometry';

describe('aircraft geometry', () => {
  test('stations map to world X with the nose at +X', () => {
    expect(stationToX(0)).toBe(18.8);
    expect(stationToX(37.6)).toBeCloseTo(-18.8);
  });

  test('rows start at station 7.0 with a 0.76 m (≈30 in) pitch', () => {
    expect(rowStation(1)).toBe(7.0);
    expect(rowStation(30)).toBeCloseTo(29.04);
  });

  test('every row has its own window, the one nearest the seated eye', () => {
    const rows = Array.from({ length: ROWS }, (_, i) => i + 1);
    for (const r of rows) {
      const eye = rowStation(r) + SEATED_EYE_AFT;
      expect(Math.abs(seatWindowStation(r) - eye), `row ${r}`).toBeLessThanOrEqual(WINDOW.pitch / 2);
    }
    expect(new Set(rows.map(seatWindowStation)).size).toBe(ROWS);
  });

  test('cabin windows match the livery texture', () => {
    expect(windowStations()).toHaveLength(43);
    expect(windowStations()[0]).toBe(6.55);
    expect(nearestWindowStation(16.0)).toBeCloseTo(16.144, 3);
  });

  test('seats A–C sit on the port (−Z) side', () => {
    expect(sideOf('A')).toBe(-1);
    expect(sideOf('F')).toBe(1);
    expect(seatWorldPosition(1, 'A')).toEqual([11.8, -0.45, -1.42]);
  });
});
