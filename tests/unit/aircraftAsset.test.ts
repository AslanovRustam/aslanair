import { readFileSync, statSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import {
  CABIN_WALL_Z,
  CEILING_Y,
  DOOR_1L,
  FLOOR_Y,
  NIGHT_LIGHTS,
  OVERWING_EXIT_STATIONS,
  ROWS,
  rowStation,
  SEAT_FOOTPRINT,
  SEAT_Z,
  WINDOW,
} from '@/experience/geometry';
import { glbImageSizes, glbNodeNames, glbParentsOf, glbPrimitiveSize } from './glb';
import { linerHalfWidthAt } from './linerProfile';

const GLB = 'public/models/airliner.glb';
const meta = JSON.parse(readFileSync('public/models/airliner.meta.json', 'utf8'));

describe('aircraft asset ↔ site constants', () => {
  test('cabin and window dimensions match geometry.ts', () => {
    expect(meta.floorY).toBeCloseTo(FLOOR_Y, 4);
    expect(meta.ceilingY).toBeCloseTo(CEILING_Y, 4);
    expect(meta.cabinWallZ).toBeCloseTo(CABIN_WALL_Z, 3);
    expect(meta.window).toMatchObject({ y: WINDOW.y, firstStation: WINDOW.firstStation, pitch: WINDOW.pitch, lastStation: WINDOW.lastStation });
  });

  test('night lights sit at the wing tips, the tail and on the fuselage, matching geometry.ts', () => {
    expect(Object.keys(meta.lights).sort()).toEqual(Object.keys(NIGHT_LIGHTS).sort());
    for (const [name, at] of Object.entries(NIGHT_LIGHTS)) {
      at.forEach((v, k) => expect(meta.lights[name][k], `${name}[${k}]`).toBeCloseTo(v, 2));
    }
    expect(meta.lights.navPort[2]).toBeLessThan(0);
    expect(meta.lights.navStarboard[2]).toBeGreaterThan(0);
    expect(Math.min(Math.abs(meta.lights.navPort[2]), meta.lights.navStarboard[2])).toBeGreaterThanOrEqual(16);
  });

  test('over-wing exits match geometry.ts', () => {
    expect(meta.overwingExits).toEqual([...OVERWING_EXIT_STATIONS]);
  });

  test('outboard seats stand inside the cabin wall, tail taper included', () => {
    const outboard = SEAT_Z.F + SEAT_FOOTPRINT.width / 2;
    for (let row = 1; row <= ROWS; row++) {
      for (const s of [rowStation(row) - SEAT_FOOTPRINT.depth / 2, rowStation(row) + SEAT_FOOTPRINT.depth / 2]) {
        expect(linerHalfWidthAt(meta, s, FLOOR_Y) - outboard, `row ${row} at station ${s.toFixed(2)}`).toBeGreaterThanOrEqual(0.02);
      }
    }
  });

  test('the liner grid covers the cabin floor to ceiling', () => {
    expect(meta.cabin.liner.heights[0]).toBeCloseTo(FLOOR_Y);
    expect(meta.cabin.liner.heights.at(-1)).toBeCloseTo(CEILING_Y);
    expect(linerHalfWidthAt(meta, 15, 0.62)).toBeCloseTo(CABIN_WALL_Z, 2); // bilinear on a 0.1 m grid: ~0.6 mm low on the curve
    expect(() => linerHalfWidthAt(meta, 40, 0)).toThrow();
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

  test('the closed door fills its doorway with no gap; a painted seam outlines it', () => {
    const [w, h] = glbPrimitiveSize(GLB, 'Door1L', 'Livery');
    expect(Math.abs(w - meta.door1L.width), 'width').toBeLessThan(0.002);
    expect(Math.abs(h - meta.door1L.height), 'height').toBeLessThan(0.002);
    const [sw, sh] = glbPrimitiveSize(GLB, 'Door1LSeam', 'DoorSeam');
    expect(sw - meta.door1L.width).toBeGreaterThan(0.004);
    expect(sw - meta.door1L.width).toBeLessThan(0.02);
    expect(sh - meta.door1L.height).toBeGreaterThan(0.004);
  });

  test('keeps the nodes the site animates and swaps', () => {
    const names = glbNodeNames(GLB);
    for (const n of ['Fuselage', 'Door1L', 'CabinShell', 'CabinFloor', 'CabinPlinth', 'WindowGlass', 'Lettering_L', 'Lettering_R']) {
      expect(names).toContain(n);
    }
    expect(glbNodeNames(GLB), 'the cockpit door comes from the cabin kit now').not.toContain('CockpitDoor');
  });

  test("door 1L's window is geometry riding on the door, not livery pixels", () => {
    expect(glbParentsOf(GLB, 'Door1LWindow')).toEqual(['Door1L']);
  });

  test('cockpit glazing is geometry, not livery pixels', () => {
    const names = glbNodeNames(GLB);
    for (const n of ['CockpitGlass', 'CockpitFrame']) expect(names).toContain(n);
  });

  test('textures are at most 2048 px per side', () => {
    const sizes = glbImageSizes(GLB);
    expect(sizes.length).toBeGreaterThan(0);
    expect(Math.max(...sizes.flat())).toBeLessThanOrEqual(2048);
  });
});
