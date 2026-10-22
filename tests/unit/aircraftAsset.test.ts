import { readFileSync, statSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { CABIN_WALL_Z, CEILING_Y, DOOR_1L, FLOOR_Y, WINDOW } from '@/experience/geometry';
import { glbImageSizes, glbNodeNames } from './glb';

const GLB = 'public/models/airliner.glb';
const meta = JSON.parse(readFileSync('public/models/airliner.meta.json', 'utf8'));

describe('aircraft asset ↔ site constants', () => {
  test('cabin and window dimensions match geometry.ts', () => {
    expect(meta.floorY).toBeCloseTo(FLOOR_Y, 4);
    expect(meta.ceilingY).toBeCloseTo(CEILING_Y, 4);
    expect(meta.cabinWallZ).toBeCloseTo(CABIN_WALL_Z, 3);
    expect(meta.window).toMatchObject({ y: WINDOW.y, firstStation: WINDOW.firstStation, pitch: WINDOW.pitch, lastStation: WINDOW.lastStation });
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

  test('textures are at most 2048 px per side', () => {
    const sizes = glbImageSizes(GLB);
    expect(sizes.length).toBeGreaterThan(0);
    expect(Math.max(...sizes.flat())).toBeLessThanOrEqual(2048);
  });
});
