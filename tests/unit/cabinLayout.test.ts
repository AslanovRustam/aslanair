import { Vector3 } from 'three';
import { describe, expect, test } from 'vitest';
import { trackProgress } from '@/experience/chapters';
import {
  armMatrices,
  binBoxes,
  distanceToBoxes,
  AFT_GALLEY,
  COCKPIT_DOOR,
  EXIT_ARROWS,
  EXIT_SIGN,
  furnishingBoxes,
  GALLEY,
  GALLEY_CART,
  JUMP_SEAT,
  LAVATORY,
  isInsideSeat,
  SEAT_KIT,
  SEAT_TRACK_Z,
  seatMatrices,
  segmentHitsBoxes,
} from '@/experience/cabinLayout';
import { poseOnPreTrack, seatedPose } from '@/experience/cameraPoses';
import {
  CABIN_WALL_Z,
  EYE_SEATED,
  FLOOR_Y,
  rowStation,
  rowX,
  SEATED_EYE_AFT,
  SEAT_Z,
  seatWindowStation,
  seatWorldPosition,
  stationToX,
  WINDOW,
} from '@/experience/geometry';
import { generateSeatMap } from '@/experience/seats';

describe('seats', () => {
  test('the seated eye clears its own seat', () => {
    expect(EYE_SEATED - FLOOR_Y - SEAT_KIT.height).toBeGreaterThanOrEqual(0.05);
    expect(-SEATED_EYE_AFT - SEAT_KIT.backFrontTopX).toBeGreaterThanOrEqual(0.1);
  });

  test('each seat instance stands on its floor position', () => {
    const seats = generateSeatMap();
    const at = seatMatrices(seats).map((m) => new Vector3().setFromMatrixPosition(m).toArray());
    expect(at).toHaveLength(180);
    expect(at[0]).toEqual(seatWorldPosition(1, 'A'));
    expect(at[179]).toEqual(seatWorldPosition(30, 'F'));
  });

  test('armrests at both ends of every triple and between neighbours', () => {
    const arms = armMatrices().map((m) => new Vector3().setFromMatrixPosition(m));
    expect(arms).toHaveLength(240);
    expect(arms.filter((p) => Math.abs(p.x - rowX(1)) < 1e-6).map((p) => +p.z.toFixed(2)).sort((a, b) => a - b))
      .toEqual([-1.64, -1.18, -0.7, -0.24, 0.24, 0.7, 1.18, 1.64]);
  });
});

describe('bins', () => {
  test('the walking camera keeps clear of the bins', () => {
    const boxes = binBoxes();
    expect(boxes).toHaveLength(60);
    for (let i = 0; i <= 2000; i++) {
      const cam = poseOnPreTrack(i / 2000).position;
      expect(distanceToBoxes(cam, boxes), `p=${i / 2000}`).toBeGreaterThanOrEqual(0.3);
    }
  });
});

describe('entry zone and signs', () => {
  test('the door flight and the aisle walk keep 0.3 m clear of every furnishing', () => {
    const boxes = furnishingBoxes();
    for (let i = 0; i <= 2000; i++) {
      const cam = poseOnPreTrack(i / 2000).position;
      expect(distanceToBoxes(cam, boxes), `p=${i / 2000}`).toBeGreaterThanOrEqual(0.3);
    }
  });

  test('the seated sight line to the window crosses no furnishing', () => {
    for (const seat of [{ row: 1, letter: 'A' }, { row: 14, letter: 'F' }, { row: 30, letter: 'A' }] as const) {
      const { position: eye } = seatedPose(seat);
      const window = new Vector3(stationToX(seatWindowStation(seat.row)), WINDOW.y, Math.sign(eye.z) * CABIN_WALL_Z);
      expect(segmentHitsBoxes(eye, window, furnishingBoxes()), `${seat.row}${seat.letter}`).toBe(false);
    }
  });

  test('a segment through a box is caught', () => {
    const [box] = furnishingBoxes();
    const c = box.getCenter(new Vector3());
    expect(segmentHitsBoxes(c.clone().add(new Vector3(0, 0, -5)), c.clone().add(new Vector3(0, 0, 5)), [box])).toBe(true);
  });

  test('exit signs hang at the over-wing exits and the aft door; the arrows sign at door 1L', () => {
    expect(EXIT_SIGN.placements.map(([s]) => s)).toEqual([16.45, 16.45, 30.25]);
    expect(EXIT_ARROWS.station).toBeLessThan(4.49); // just forward of door 1L, between it and the flight deck
    expect(EXIT_ARROWS.y + EXIT_SIGN.h / 2).toBeLessThan(1.576); // under the ceiling there
  });

  test('the cockpit door and jump seat stand on the front bulkhead, clear of the galley and of each other', () => {
    expect(COCKPIT_DOOR.z + COCKPIT_DOOR.width / 2).toBeLessThanOrEqual(GALLEY.innerZ - 0.02 + 1e-9);
    expect(JUMP_SEAT.z + JUMP_SEAT.width / 2).toBeLessThanOrEqual(COCKPIT_DOOR.z - COCKPIT_DOOR.width / 2);
    const boxes = furnishingBoxes();
    const at = (x: number, y: number, z: number) => boxes.some((b) => b.containsPoint(new Vector3(x, y, z)));
    expect(at(stationToX(COCKPIT_DOOR.station + 0.02), FLOOR_Y + 1, COCKPIT_DOOR.z), 'door box').toBe(true);
    expect(at(stationToX(JUMP_SEAT.station + 0.05), FLOOR_Y + 0.5, JUMP_SEAT.z), 'jump seat box').toBe(true);
    expect(at(stationToX(EXIT_ARROWS.station), EXIT_ARROWS.y, 0), 'arrows sign box').toBe(true);
  });

  test('the seated camera is inside its own seat and no other', () => {
    const eye = seatedPose({ row: 14, letter: 'F' }).position;
    expect(isInsideSeat(eye, '14F')).toBe(true);
    expect(isInsideSeat(eye, '13F')).toBe(false);
    expect(isInsideSeat(eye, '14E')).toBe(false);
    expect(isInsideSeat(poseOnPreTrack(trackProgress('pre', 'aisle', 0.27)).position, '14F')).toBe(false);
  });

  test('seat tracks run under the seat legs, two per triple', () => {
    expect(SEAT_TRACK_Z).toHaveLength(4);
    const legs = Object.values(SEAT_Z).flatMap((z) => [z - 0.15, z + 0.15]);
    for (const z of SEAT_TRACK_Z) expect(Math.min(...legs.map((l) => Math.abs(l - z)))).toBeLessThan(1e-9);
    expect(SEAT_TRACK_Z.filter((z) => z < 0)).toHaveLength(2);
  });

  test('the tail zone clears row 30 and stays inside the hull', () => {
    const row30Back = stationToX(rowStation(30) + SEAT_KIT.depth / 2 + 0.15); // reclined back overhang
    expect(row30Back - stationToX(GALLEY_CART.station + GALLEY_CART.depth / 2)).toBeGreaterThanOrEqual(0.3);
    // the cart stands in the aisle, out of its bay, beside row 30's backs, never in a seat's footprint
    expect(GALLEY_CART.station - GALLEY_CART.depth / 2).toBeGreaterThanOrEqual(rowStation(30) + SEAT_KIT.depth / 2);
    expect(GALLEY_CART.station + GALLEY_CART.depth / 2).toBeLessThan(AFT_GALLEY.s0);
    expect(GALLEY_CART.width / 2).toBeLessThan(SEAT_Z.D - SEAT_KIT.width / 2);
    // the galley spans the aisle end between the lavatories, under the aft exit sign
    expect(AFT_GALLEY.halfWidth).toBeLessThanOrEqual(LAVATORY.innerZ);
    expect(AFT_GALLEY.topY).toBeLessThan(EXIT_SIGN.y - EXIT_SIGN.h / 2);
    const boxes = furnishingBoxes();
    const at = (s: number, y: number, z: number) => boxes.some((b) => b.containsPoint(new Vector3(stationToX(s), y, z)));
    expect(at(30.1, FLOOR_Y + 1, 0), 'galley box').toBe(true);
    expect(at(30.1, FLOOR_Y + 1, -1.2) && at(30.1, FLOOR_Y + 1, 1.2), 'lavatory boxes').toBe(true);
    expect(at(GALLEY_CART.station, FLOOR_Y + 0.5, 0), 'cart box').toBe(true);
  });
});
