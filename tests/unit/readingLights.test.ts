import { describe, expect, test } from 'vitest';
import { readingLightSeats } from '@/experience/readingLights';
import { generateSeatMap } from '@/experience/seats';

describe('reading lights', () => {
  test('a deterministic quarter of the occupied seats read at night', () => {
    const seats = generateSeatMap();
    const lit = readingLightSeats(seats);
    expect(readingLightSeats(generateSeatMap())).toEqual(lit);
    const occupied = new Set(seats.filter((s) => s.status === 'occupied').map((s) => s.id));
    expect(lit.length).toBe(Math.round(occupied.size / 4));
    for (const id of lit) expect(occupied.has(id), id).toBe(true);
    expect(new Set(lit).size).toBe(lit.length);
  });
});
