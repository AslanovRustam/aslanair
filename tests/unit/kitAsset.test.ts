import { readFileSync, statSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { AFT_GALLEY, BIN, COCKPIT_DOOR, COCKPIT_PLACARD, CURTAIN, EXIT_ARROWS, EXIT_SIGN, GALLEY, GALLEY_CART, JUMP_SEAT, LAVATORY, SEAT_KIT } from '@/experience/cabinLayout';
import { ROWS, rowStation, SEAT_FOOTPRINT } from '@/experience/geometry';
import { glbNodeNames } from './glb';
import { linerHalfWidthAt } from './linerProfile';

const KIT = 'public/models/cabin-kit.glb';
const kit = JSON.parse(readFileSync('public/models/cabin-kit.meta.json', 'utf8'));
const aircraftMeta = JSON.parse(readFileSync('public/models/airliner.meta.json', 'utf8'));
const SEAT_PARTS = ['SeatFabric', 'SeatShell', 'SeatCover', 'SeatArm', 'SeatLegs', 'SeatBelt', 'SeatBuckle'];

describe('cabin kit', () => {
  test('kit seat matches the site footprint', () => {
    expect(kit.seat).toMatchObject({ depth: SEAT_FOOTPRINT.depth, width: SEAT_FOOTPRINT.width });
    expect(kit.seat).toMatchObject(SEAT_KIT);
  });

  test('kit keeps the seat nodes and fits its budget', () => {
    for (const n of SEAT_PARTS) expect(glbNodeNames(KIT)).toContain(n);
    const seatTris = SEAT_PARTS.reduce((t, n) => t + kit.triangles[n], 0);
    expect(seatTris).toBeLessThanOrEqual(3000);
    expect(statSync(KIT).size).toBeLessThanOrEqual(600_000);
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

  test('every bin door has a latch handle on its face, just above the bottom lip, and a seam at its edge', () => {
    expect(glbNodeNames(KIT)).toEqual(expect.arrayContaining(['BinTrimPort', 'BinTrimStarboard']));
    expect(kit.triangles.BinTrimPort).toBeLessThanOrEqual(120);
    const { width, height, y, z } = kit.binLatch;
    expect(width).toBeGreaterThan(0.1);
    expect(width).toBeLessThan(BIN.length / 2);
    expect(y - height / 2).toBeGreaterThan(BIN.bottomY);
    expect(y + height / 2).toBeLessThan(BIN.bottomY + 0.1);
    // the door face at the latch's height, from the bin profile's door points (|z| falls as y rises)
    const door = (kit.bin.profile as [number, number][]).slice(0, 7);
    const k = door.findIndex(([, py]) => py >= y);
    const [z0, y0] = door[k - 1];
    const [z1, y1] = door[k];
    const face = z0 + ((z1 - z0) * (y - y0)) / (y1 - y0);
    expect(Math.abs(z - face), 'sits on the door').toBeLessThan(0.008);
  });

  test('entry zone parts match cabinLayout', () => {
    expect(kit.galley).toEqual({ ...GALLEY });
    expect(kit.curtain).toEqual({ ...CURTAIN });
    expect(kit.exitSign).toEqual({ ...EXIT_SIGN, placements: EXIT_SIGN.placements.map((p) => [...p]) });
    expect(glbNodeNames(KIT)).toEqual(expect.arrayContaining(['GalleyPanels', 'GalleySteel', 'GalleyWorktop', 'Curtain', 'ExitSign']));
    expect(statSync(KIT).size).toBeLessThanOrEqual(600_000);
  });

  test('the galley is equipment: steel doors, red latches, dark glass and plates, within its budget', () => {
    expect(glbNodeNames(KIT)).toEqual(expect.arrayContaining(['GalleySteel', 'GalleyLatches', 'GalleyDark']));
    expect(kit.triangles.GalleySteel + kit.triangles.GalleyLatches + kit.triangles.GalleyDark).toBeLessThanOrEqual(4000);
    expect(statSync(KIT).size).toBeLessThanOrEqual(600_000);
  });

  test('the flight-deck placard is the size the site letters', () => {
    expect(kit.placard).toEqual({ ...COCKPIT_PLACARD });
  });

  test('nose parts match cabinLayout', () => {
    expect(kit.cockpitDoor).toEqual({ ...COCKPIT_DOOR });
    expect(kit.jumpSeat).toEqual({ ...JUMP_SEAT });
    expect(kit.exitArrows).toEqual({ ...EXIT_ARROWS });
    expect(glbNodeNames(KIT)).toEqual(expect.arrayContaining(['CockpitDoor', 'CockpitDoorHardware', 'JumpSeat', 'JumpSeatFrame']));
  });

  test('tail parts match cabinLayout and stay inside the tapering hull', () => {
    expect(kit.aftGalley).toEqual({ ...AFT_GALLEY });
    expect(kit.galleyCart).toEqual({ ...GALLEY_CART });
    expect(kit.lavatory).toMatchObject({ ...LAVATORY });
    expect(glbNodeNames(KIT)).toEqual(expect.arrayContaining(['AftGalley', 'AftGalleySteel', 'AftGalleyWorktop', 'Lavatories', 'LavatoryDoors', 'LavatoryTrim', 'GalleyCart']));
    const inset = aircraftMeta.linerInset;
    // the lavatories' outer sides follow the liner through the taper
    for (const [s, outline] of kit.lavatory.outline as [number, [number, number][]][]) {
      expect(s).toBeGreaterThanOrEqual(LAVATORY.s0);
      expect(s).toBeLessThanOrEqual(LAVATORY.s1);
      for (const [z, y] of outline) expect(z, `s ${s} y ${y}`).toBeLessThanOrEqual(linerHalfWidthAt(aircraftMeta, s, y) + inset - 0.01);
    }
    // the lavatory doors and their occupancy signs sit on the blocks' forward faces, inside the cabin wall
    const face = (y: number) => linerHalfWidthAt(aircraftMeta, LAVATORY.s0, y) - 0.02 + 1e-4;
    for (const [y, z] of kit.lavatory.door.outer as [number, number][]) expect(z, `door edge at y ${y}`).toBeLessThanOrEqual(face(y));
    const [z0, z1, , y1] = kit.lavatory.door.sign as number[];
    expect(z0).toBeGreaterThanOrEqual(LAVATORY.innerZ);
    expect(z1, 'occupancy sign').toBeLessThanOrEqual(face(y1));
    for (const s of [AFT_GALLEY.s0, AFT_GALLEY.s1]) {
      expect(AFT_GALLEY.halfWidth).toBeLessThanOrEqual(linerHalfWidthAt(aircraftMeta, s, AFT_GALLEY.topY) + inset - 0.01);
    }
  });
});
