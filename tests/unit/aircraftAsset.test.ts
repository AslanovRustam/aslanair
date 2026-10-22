import { readFileSync, statSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { CABIN_WALL_Z, CEILING_Y, DOOR_1L, FLOOR_Y, ROWS, rowStation, SEAT_FOOTPRINT, SEAT_Z, WINDOW } from '@/experience/geometry';
import { glbImageSizes, glbNodeNames, glbParentsOf } from './glb';

const GLB = 'public/models/airliner.glb';
const meta = JSON.parse(readFileSync('public/models/airliner.meta.json', 'utf8'));

describe('aircraft asset ↔ site constants', () => {
  test('cabin and window dimensions match geometry.ts', () => {
    expect(meta.floorY).toBeCloseTo(FLOOR_Y, 4);
    expect(meta.ceilingY).toBeCloseTo(CEILING_Y, 4);
    expect(meta.cabinWallZ).toBeCloseTo(CABIN_WALL_Z, 3);
    expect(meta.window).toMatchObject({ y: WINDOW.y, firstStation: WINDOW.firstStation, pitch: WINDOW.pitch, lastStation: WINDOW.lastStation });
  });

  test('outboard seats stand inside the cabin wall, tail taper included', () => {
    const profile: [number, number][] = meta.cabin.floorHalfWidth;
    const halfWidthAt = (s: number) => {
      const i = profile.findIndex(([station]) => station >= s);
      const [s0, w0] = profile[i - 1];
      const [s1, w1] = profile[i];
      return w0 + ((w1 - w0) * (s - s0)) / (s1 - s0);
    };
    const outboard = SEAT_Z.F + SEAT_FOOTPRINT.width / 2;
    for (let row = 1; row <= ROWS; row++) {
      for (const s of [rowStation(row) - SEAT_FOOTPRINT.depth / 2, rowStation(row) + SEAT_FOOTPRINT.depth / 2]) {
        expect(halfWidthAt(s) - outboard, `row ${row} at station ${s.toFixed(2)}`).toBeGreaterThanOrEqual(0.02);
      }
    }
  });

  test('door 1L matches geometry.ts', () => {
    expect(meta.door1L.station).toBe(DOOR_1L.station);
    expect(meta.door1L.width).toBe(DOOR_1L.width);
    expect(meta.door1L.height).toBe(DOOR_1L.height);
    expect(meta.door1L.hinge).toEqual(DOOR_1L.hinge);
    expect(meta.door1L.open).toEqual(DOOR_1L.open);
  });
});

describe('aircraft asset budget', () => {
  test('fits the triangle and size budget', () => {
    expect(meta.triangles).toBeLessThanOrEqual(120_000);
    expect(statSync(GLB).size).toBeLessThanOrEqual(1_500_000);
  });

  test('keeps the nodes the site animates and swaps', () => {
    const names = glbNodeNames(GLB);
    for (const n of ['Fuselage', 'Door1L', 'CabinShell', 'CabinFloor', 'WindowGlass', 'Lettering_L', 'Lettering_R']) {
      expect(names).toContain(n);
    }
  });

  test("door 1L's window is geometry riding on the door, not livery pixels", () => {
    expect(glbParentsOf(GLB, 'Door1LWindow')).toEqual(['Door1L']);
  });

  test('textures are at most 2048 px per side', () => {
    const sizes = glbImageSizes(GLB);
    expect(sizes.length).toBeGreaterThan(0);
    expect(Math.max(...sizes.flat())).toBeLessThanOrEqual(2048);
  });
});
