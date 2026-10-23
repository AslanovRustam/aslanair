import { PerspectiveCamera, Vector3 } from 'three';
import { describe, expect, test } from 'vitest';
import {
  aircraftFlyAway,
  aisleProgressForRow,
  COCKPIT_LOOK,
  exitControlPoints,
  poseOnPostTrack,
  poseOnPreTrack,
  seatedPose,
  WINDOW_ON_EXIT,
} from '@/experience/cameraPoses';
import { trackProgress } from '@/experience/chapters';
import { INTRO } from '@/experience/introState';
import { COCKPIT_DOOR, EXIT_ARROWS, JUMP_SEAT } from '@/experience/cabinLayout';
import { CABIN_WALL_Z, FLOOR_Y, ROWS, rowX, seatWindowStation, stationToX, WINDOW } from '@/experience/geometry';

describe('pre-track camera', () => {
  test('starts on the sky shot with a narrow lens', () => {
    expect(poseOnPreTrack(0).position.toArray()).toEqual([42, 6.5, -36]);
    expect(poseOnPreTrack(0).fov).toBe(30);
  });

  test('the camera holds the capture pose until the swap', () => {
    expect(poseOnPreTrack(trackProgress('pre', 'sky', 0.3)).position.equals(INTRO.swapPose.position)).toBe(true);
  });

  test('the camera stays on the capture pose until the picture has faded, then eases off it', () => {
    const hold = INTRO.swapAt + INTRO.crossfade;
    for (const t of [0, INTRO.swapAt, hold]) {
      const pose = poseOnPreTrack(trackProgress('pre', 'sky', t));
      expect(pose.position.distanceTo(INTRO.swapPose.position), `t=${t}`).toBeLessThan(1e-9);
      expect(pose.target.distanceTo(INTRO.swapPose.target), `t=${t}`).toBeLessThan(1e-9);
      expect(pose.fov).toBe(INTRO.swapPose.fov);
    }
    // it sets off from rest: the first step past the hold is far shorter than an even share of the way
    const step = 0.01;
    const moved = poseOnPreTrack(trackProgress('pre', 'sky', hold + step)).position.distanceTo(INTRO.swapPose.position);
    const total = poseOnPreTrack(trackProgress('pre', 'sky', 1)).position.distanceTo(INTRO.swapPose.position);
    expect(moved).toBeLessThan((total * step) / (1 - hold) / 4);
  });

  test('the sky shot meets the door flight at the speed the door flight starts with', () => {
    const at = trackProgress('pre', 'door', 0);
    const h = 1e-5;
    const before = poseOnPreTrack(at - h).position.distanceTo(poseOnPreTrack(at - 2 * h).position) / h;
    const after = poseOnPreTrack(at + 2 * h).position.distanceTo(poseOnPreTrack(at + h).position) / h;
    expect(Math.abs(before - after) / after).toBeLessThan(0.05);
  });

  test('the door flight ends at the aisle start and threads the door', () => {
    const doorEnd = poseOnPreTrack(trackProgress('pre', 'door', 1));
    expect(doorEnd.position.distanceTo(new Vector3(12.6, 1.2, 0))).toBeLessThan(1e-6);
    const samples = Array.from({ length: 401 }, (_, i) => poseOnPreTrack(trackProgress('pre', 'door', i / 400)).position);
    expect(Math.min(...samples.map((p) => p.distanceTo(new Vector3(13.9, 1.1, -2.4))))).toBeLessThan(0.02);
  });

  test('entering, the camera looks at the cockpit door before turning to the aisle', () => {
    for (const t of [0.76, 0.78, 0.8]) {
      const p = poseOnPreTrack(trackProgress('pre', 'door', t));
      const view = p.target.clone().sub(p.position).normalize();
      const toDoor = COCKPIT_LOOK.clone().sub(p.position).normalize();
      expect(view.angleTo(toDoor), `t=${t}`).toBeLessThan((12 * Math.PI) / 180);
    }
  });

  test('the look at the nose frames the door top, the jump seat and the exit sign', () => {
    const p = poseOnPreTrack(trackProgress('pre', 'door', 0.78));
    const camera = new PerspectiveCamera(p.fov, 1440 / 800, 0.05, 100);
    camera.position.copy(p.position);
    camera.lookAt(p.target);
    camera.updateMatrixWorld();
    const inView = (point: Vector3) => {
      const ndc = point.clone().project(camera);
      return Math.abs(ndc.x) < 0.95 && Math.abs(ndc.y) < 0.95 && ndc.z < 1;
    };
    const door = stationToX(COCKPIT_DOOR.station);
    expect(inView(new Vector3(door, FLOOR_Y + COCKPIT_DOOR.height, COCKPIT_DOOR.z)), 'door top').toBe(true);
    expect(inView(new Vector3(stationToX(JUMP_SEAT.station), FLOOR_Y + JUMP_SEAT.height, JUMP_SEAT.z)), 'jump seat top').toBe(true);
    for (const dy of [-0.055, 0.055]) {
      expect(inView(new Vector3(stationToX(EXIT_ARROWS.station), EXIT_ARROWS.y + dy, 0)), `exit sign edge ${dy}`).toBe(true);
    }
  });

  test('the door flight turns its gaze smoothly, never swinging through the eye', () => {
    let previous: Vector3 | null = null;
    for (let i = 0; i <= 400; i++) {
      const p = poseOnPreTrack(trackProgress('pre', 'door', i / 400));
      const view = p.target.clone().sub(p.position).normalize();
      if (previous) expect(view.angleTo(previous), `t=${i / 400}`).toBeLessThan((4 * Math.PI) / 180);
      previous = view;
    }
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

  test('every window seat looks out through the middle of its own window', () => {
    for (let row = 1; row <= ROWS; row++) {
      for (const letter of ['A', 'F'] as const) {
        const { position: eye, target } = seatedPose({ row, letter });
        const wallZ = Math.sign(eye.z) * CABIN_WALL_Z;
        const hit = eye.clone().lerp(target, (wallZ - eye.z) / (target.z - eye.z));
        expect(Math.abs(hit.x - stationToX(seatWindowStation(row))), `${row}${letter} along`).toBeLessThan(0.02);
        expect(Math.abs(hit.y - WINDOW.y), `${row}${letter} height`).toBeLessThan(WINDOW.h / 4);
        const obliquity = Math.atan2(Math.abs(target.x - eye.x), Math.abs(target.z - eye.z));
        expect(obliquity, `${row}${letter} looks at its window face-on enough`).toBeLessThan((36 * Math.PI) / 180);
      }
    }
  });

  test('exits through the nearest window on the seat side', () => {
    expect(exitControlPoints(seat)[1].toArray()).toEqual([stationToX(seatWindowStation(14)), 0.62, -CABIN_WALL_Z]);
  });

  test('post track starts seated and ends on the pull-back', () => {
    expect(poseOnPostTrack(0, seat).position.equals(seatedPose(seat).position)).toBe(true);
    expect(poseOnPostTrack(1, seat).position.equals(exitControlPoints(seat)[3])).toBe(true);
  });
});

describe('aisle end', () => {
  test('the walk stops with the last rows still ahead, well clear of the aft bulkhead', () => {
    const end = poseOnPreTrack(1).position.x;
    expect(end - stationToX(30.5)).toBeGreaterThan(3);
    expect(end).toBeGreaterThan(rowX(30) + 2.5);
  });
});

describe('continuity at chapter boundaries', () => {
  // Tiny step: the fly-away target already moves ~1 km per unit of progress at 0.7.
  const eps = 1e-9;
  const seat = { row: 14, letter: 'A' as const };
  const close = (a: ReturnType<typeof poseOnPreTrack>, b: ReturnType<typeof poseOnPreTrack>) => {
    expect(a.position.distanceTo(b.position)).toBeLessThan(1e-3);
    expect(a.target.distanceTo(b.target)).toBeLessThan(1e-3);
    expect(Math.abs(a.fov - b.fov)).toBeLessThan(1e-3);
  };
  for (const b of [0.2, 0.45]) {
    test(`pre track is continuous at ${b}`, () => close(poseOnPreTrack(b - eps), poseOnPreTrack(b)));
  }
  for (const b of [0.15, 0.7]) {
    test(`post track is continuous at ${b}`, () => close(poseOnPostTrack(b - eps, seat), poseOnPostTrack(b, seat)));
  }
});

describe('take-off', () => {
  test('the take-off stop puts the camera at the window, on the way out', () => {
    for (const seat of [{ row: 14, letter: 'A' as const }, { row: 3, letter: 'F' as const }]) {
      const at = poseOnPostTrack(WINDOW_ON_EXIT, seat).position;
      expect(at.distanceTo(exitControlPoints(seat)[1])).toBeLessThan(1e-6);
    }
    expect(WINDOW_ON_EXIT).toBeGreaterThan(trackProgress('post', 'exit', 0));
    expect(WINDOW_ON_EXIT).toBeLessThan(trackProgress('post', 'exit', 1));
  });
});

describe('aircraft fly-away', () => {
  test('waits until 60% of the post track, then flies 900 m away', () => {
    expect(aircraftFlyAway(0.5)).toEqual({ offsetX: 0, climb: 0, bank: 0 });
    expect(aircraftFlyAway(1).offsetX).toBe(900);
  });
});
