import { Vector3 } from 'three';
import { describe, expect, test } from 'vitest';
import {
  aircraftFlyAway,
  aisleProgressForRow,
  exitControlPoints,
  poseOnPostTrack,
  poseOnPreTrack,
  seatedPose,
} from '@/experience/cameraPoses';
import { trackProgress } from '@/experience/chapters';
import { nearestWindowStation, rowStation, rowX, stationToX } from '@/experience/geometry';

describe('pre-track camera', () => {
  test('starts on the sky shot with a narrow lens', () => {
    expect(poseOnPreTrack(0).position.toArray()).toEqual([42, 6.5, -36]);
    expect(poseOnPreTrack(0).fov).toBe(30);
  });

  test('the door flight ends at the aisle start and threads the door', () => {
    const doorEnd = poseOnPreTrack(trackProgress('pre', 'door', 1));
    expect(doorEnd.position.distanceTo(new Vector3(12.6, 1.2, 0))).toBeLessThan(1e-6);
    const samples = Array.from({ length: 401 }, (_, i) => poseOnPreTrack(trackProgress('pre', 'door', i / 400)).position);
    expect(Math.min(...samples.map((p) => p.distanceTo(new Vector3(13.9, 1.1, -2.4))))).toBeLessThan(0.02);
  });

  test('the aisle walk can stop level with any row, with a wide lens', () => {
    expect(poseOnPreTrack(aisleProgressForRow(14)).position.x).toBeCloseTo(rowX(14) + 0.6, 3);
    expect(poseOnPreTrack(0.9).fov).toBe(60);
  });
});

describe('seated and post-track camera', () => {
  const seat = { row: 14, letter: 'A' as const };

  test('sits at seated eye height in the seat', () => {
    expect(seatedPose(seat).position.toArray().map((v) => +v.toFixed(3))).toEqual([+(rowX(14) - 0.15).toFixed(3), 0.7, -1.42]);
  });

  test('exits through the nearest window on the seat side', () => {
    expect(exitControlPoints(seat)[1].toArray()).toEqual([stationToX(nearestWindowStation(rowStation(14))), 0.62, -1.8]);
  });

  test('post track starts seated and ends on the pull-back', () => {
    expect(poseOnPostTrack(0, seat).position.equals(seatedPose(seat).position)).toBe(true);
    expect(poseOnPostTrack(1, seat).position.equals(exitControlPoints(seat)[3])).toBe(true);
  });
});

describe('aircraft fly-away', () => {
  test('waits until 60% of the post track, then flies 900 m away', () => {
    expect(aircraftFlyAway(0.5)).toEqual({ offsetX: 0, climb: 0, bank: 0 });
    expect(aircraftFlyAway(1).offsetX).toBe(900);
  });
});
