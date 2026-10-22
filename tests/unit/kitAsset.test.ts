import { readFileSync, statSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { BIN, CURTAIN, EXIT_SIGN, GALLEY, SEAT_KIT } from '@/experience/cabinLayout';
import { ROWS, rowStation, SEAT_FOOTPRINT } from '@/experience/geometry';
import { glbNodeNames } from './glb';
import { linerHalfWidthAt } from './linerProfile';

const KIT = 'public/models/cabin-kit.glb';
const kit = JSON.parse(readFileSync('public/models/cabin-kit.meta.json', 'utf8'));
const aircraftMeta = JSON.parse(readFileSync('public/models/airliner.meta.json', 'utf8'));
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

  test('bins stay inside the hull along the whole cabin, tail taper included', () => {
    const inset = aircraftMeta.linerInset;
    for (let row = 1; row <= ROWS; row++) {
      for (const s of [rowStation(row) - kit.bin.length / 2, rowStation(row), rowStation(row) + kit.bin.length / 2]) {
        for (const [z, y] of kit.bin.profile) {
          expect(z, `row ${row} y ${y}`).toBeLessThanOrEqual(linerHalfWidthAt(aircraftMeta, s, y) + inset - 0.01);
        }
      }
    }
  });

  test('bin section matches cabinLayout and its budget', () => {
    expect(kit.bin).toMatchObject({ length: BIN.length, bottomY: BIN.bottomY, aisleZ: BIN.aisleZ });
    expect(glbNodeNames(KIT)).toEqual(expect.arrayContaining(['BinPort', 'BinStarboard']));
    expect(kit.triangles.BinPort).toBeLessThanOrEqual(600);
  });

  test('entry zone parts match cabinLayout', () => {
    expect(kit.galley).toEqual({ ...GALLEY });
    expect(kit.curtain).toEqual({ ...CURTAIN });
    expect(kit.exitSign).toEqual({ ...EXIT_SIGN, placements: EXIT_SIGN.placements.map((p) => [...p]) });
    expect(glbNodeNames(KIT)).toEqual(expect.arrayContaining(['GalleyPanels', 'GalleySteel', 'GalleyWorktop', 'Curtain', 'ExitSign']));
    expect(statSync(KIT).size).toBeLessThanOrEqual(400_000);
  });
});
