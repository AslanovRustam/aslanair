import { describe, expect, test } from 'vitest';
import {
  nearestWindowStation,
  rowStation,
  seatWorldPosition,
  sideOf,
  stationToX,
  windowStations,
} from '@/experience/geometry';

describe('aircraft geometry', () => {
  test('stations map to world X with the nose at +X', () => {
    expect(stationToX(0)).toBe(18.8);
    expect(stationToX(37.6)).toBeCloseTo(-18.8);
  });

  test('rows start at station 7.3 with a 0.78 m pitch', () => {
    expect(rowStation(1)).toBe(7.3);
    expect(rowStation(30)).toBeCloseTo(29.92);
  });

  test('cabin windows match the livery texture', () => {
    expect(windowStations()).toHaveLength(43);
    expect(windowStations()[0]).toBe(6.55);
    expect(nearestWindowStation(16.0)).toBeCloseTo(16.144, 3);
  });

  test('seats A–C sit on the port (−Z) side', () => {
    expect(sideOf('A')).toBe(-1);
    expect(sideOf('F')).toBe(1);
    expect(seatWorldPosition(1, 'A')).toEqual([11.5, -0.45, -1.42]);
  });
});
