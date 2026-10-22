import { readFileSync, statSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { SEAT_KIT } from '@/experience/cabinLayout';
import { SEAT_FOOTPRINT } from '@/experience/geometry';
import { glbNodeNames } from './glb';

const KIT = 'public/models/cabin-kit.glb';
const kit = JSON.parse(readFileSync('public/models/cabin-kit.meta.json', 'utf8'));
const SEAT_PARTS = ['SeatFabric', 'SeatShell', 'SeatCover', 'SeatArm', 'SeatLegs'];

describe('cabin kit', () => {
  test('kit seat matches the site footprint', () => {
    expect(kit.seat).toMatchObject({ depth: SEAT_FOOTPRINT.depth, width: SEAT_FOOTPRINT.width });
    expect(kit.seat).toMatchObject(SEAT_KIT);
  });

  test('kit keeps the seat nodes and fits its budget', () => {
    for (const n of SEAT_PARTS) expect(glbNodeNames(KIT)).toContain(n);
    const seatTris = SEAT_PARTS.reduce((t, n) => t + kit.triangles[n], 0);
    expect(seatTris).toBeLessThanOrEqual(1500);
    expect(statSync(KIT).size).toBeLessThanOrEqual(400_000);
  });
});
