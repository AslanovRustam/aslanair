import { readFileSync } from 'node:fs';
import { Euler, Vector3 } from 'three';
import { describe, expect, test } from 'vitest';
import { DOOR_ROTATION_ORDER, doorGlow, doorOpenAmount, doorPose } from '@/experience/aircraftAnimation';
import { poseOnPreTrack } from '@/experience/cameraPoses';
import { trackProgress } from '@/experience/chapters';
import { DOOR_1L, stationToX } from '@/experience/geometry';
import { gridHalfWidthAt, type SkinGrid } from '@/experience/linerProfile';

const meta = JSON.parse(readFileSync('public/models/airliner.meta.json', 'utf8'));
const skin: SkinGrid = meta.door1L.skin;
const hinge = new Vector3(...DOOR_1L.hinge);
const xToStation = (x: number) => stationToX(0) - x;
const sill = DOOR_1L.y - DOOR_1L.height / 2;
/** The closed panel's outer face, 3 × 3 points over the doorway, on the skin. */
const panel = [0.06, 0.5, 0.94].flatMap((u) =>
  [0.06, 0.5, 0.94].map((v) => {
    const station = DOOR_1L.station - DOOR_1L.width / 2 + u * DOOR_1L.width;
    const y = sill + v * DOOR_1L.height;
    return new Vector3(stationToX(station), y, DOOR_1L.side * gridHalfWidthAt(skin, station, y));
  }),
);
/** A panel point carried by a pose: turned about the hinge, then moved by the offset. */
function moved(point: Vector3, pose: { offset: [number, number, number]; rotation: [number, number, number] }): Vector3 {
  return point
    .clone()
    .sub(hinge)
    .applyEuler(new Euler(...pose.rotation, DOOR_ROTATION_ORDER))
    .add(hinge)
    .add(new Vector3(...pose.offset));
}
/** How far a point stands off the skin under it (negative: inside the hull). */
const standOff = (w: Vector3) => Math.abs(w.z) - gridHalfWidthAt(skin, xToStation(w.x), w.y);

describe('door 1L opening', () => {
  test('closed through the journey and the ready chapter; it opens over the door flight', () => {
    expect(doorOpenAmount('browse', trackProgress('pre', 'sky', 0.9))).toBe(0);
    expect(doorOpenAmount('browse', trackProgress('pre', 'transfer', 0.9))).toBe(0);
    expect(doorOpenAmount('browse', trackProgress('pre', 'ready', 0.2))).toBe(0);
    expect(doorOpenAmount('browse', trackProgress('pre', 'ready', 0.95))).toBe(0);
    expect(doorOpenAmount('browse', trackProgress('pre', 'door', 0.1))).toBe(0);
    expect(doorOpenAmount('browse', trackProgress('pre', 'door', 0.3))).toBeGreaterThan(0);
    expect(doorOpenAmount('browse', trackProgress('pre', 'door', 0.6))).toBe(1);
    expect(doorOpenAmount('browse', trackProgress('pre', 'aisle', 0.5))).toBe(1);
    expect(doorOpenAmount('seated', 0.9)).toBe(1);
    expect(doorOpenAmount('confirmed', 0.5)).toBe(0);
  });

  test('the door opens without a jump, from the ready chapter through the door flight', () => {
    let last = 0;
    for (let i = 0; i <= 200; i++) {
      const p = trackProgress('pre', 'ready', 0) + (i / 200) * (trackProgress('pre', 'aisle', 0) - trackProgress('pre', 'ready', 0));
      const now = doorOpenAmount('browse', p);
      expect(now, `step ${i}`).toBeGreaterThanOrEqual(last - 1e-12);
      expect(now - last, `step ${i}`).toBeLessThan(0.08);
      last = now;
    }
  });

  test('the doorway glows warm at its seams in the ready chapter and is gone before the camera reaches it', () => {
    expect(doorGlow('browse', trackProgress('pre', 'transfer', 0.9))).toBe(0);
    expect(doorGlow('browse', trackProgress('pre', 'ready', 0.95))).toBeGreaterThan(0.9);
    const seam = trackProgress('pre', 'door', 0);
    expect(Math.abs(doorGlow('browse', seam - 1e-9) - doorGlow('browse', seam))).toBeLessThan(1e-6);
    expect(doorGlow('browse', trackProgress('pre', 'door', 0.5))).toBe(0);
    expect(doorGlow('browse', trackProgress('pre', 'aisle', 0.5))).toBe(0);
    expect(doorGlow('seated', trackProgress('pre', 'aisle', 0.5))).toBe(0);
  });

  test('closed, the door is where the model has it', () => {
    expect(doorPose(0, skin)).toEqual({ offset: [0, 0, 0], rotation: [0, 0, 0] });
  });

  test('opening, it stands a few centimetres off the skin all the way forward (spec r5 §7)', () => {
    // its 0.06 m panel's inner face 0.02–0.12 m off the skin: the outer face 0.08–0.18 m
    for (let amount = 0.3; amount <= 1.0001; amount += 0.1) {
      const pose = doorPose(amount, skin);
      for (const [k, point] of panel.entries()) {
        const off = standOff(moved(point, pose));
        expect(off, `amount ${amount.toFixed(1)}, point ${k}`).toBeGreaterThanOrEqual(0.08);
        expect(off, `amount ${amount.toFixed(1)}, point ${k}`).toBeLessThanOrEqual(0.18);
      }
    }
  });

  test('it never goes into the skin, and open it is clear of the doorway', () => {
    for (let amount = 0; amount <= 1.0001; amount += 0.05) {
      const pose = doorPose(amount, skin);
      for (const [k, point] of panel.entries()) expect(standOff(moved(point, pose)), `amount ${amount.toFixed(2)}, point ${k}`).toBeGreaterThanOrEqual(-0.005);
    }
    expect(doorPose(1, skin).offset[0]).toBeGreaterThanOrEqual(0.95);
  });

  test('the moving panel never comes within 0.3 m of the camera at the same moment', () => {
    for (let i = 0; i <= 400; i++) {
      const p = trackProgress('pre', 'door', i / 400);
      const cam = poseOnPreTrack(p).position;
      const pose = doorPose(doorOpenAmount('browse', p), skin);
      const nearest = Math.min(...panel.map((point) => moved(point, pose).distanceTo(cam)));
      expect(nearest, `door t=${i / 400}`).toBeGreaterThan(0.3);
    }
  });
});
