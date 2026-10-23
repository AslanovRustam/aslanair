import { poseOnPreTrack } from './cameraPoses';
import { CABIN_WALL_Z, stationToX } from './geometry';
import type { Phase } from './store';

const CABIN_FRONT_X = stationToX(4.0);

/**
 * Whether the camera is aboard: the pre-track camera inside the liner and aft of the front bulkhead. Every phase
 * past browsing counts as aboard — seated, on the pass, out through the window and on.
 */
export function cameraInsideCabin(phase: Phase, progress: number): boolean {
  if (phase !== 'browse') return true;
  const { x, z } = poseOnPreTrack(progress).position;
  return Math.abs(z) < CABIN_WALL_Z - 0.1 && x < CABIN_FRONT_X;
}

export type WorldMode = 'showcase' | 'night';

/**
 * The site's dark showcase until the camera is inside the cabin — plain dark background, no clouds, the plane
 * lit like a product; from then on (and through the exit) the night sky. The switch happens where only the
 * windows show the outside, so it is never seen.
 */
export function worldMode(phase: Phase, progress: number): WorldMode {
  return cameraInsideCabin(phase, progress) ? 'night' : 'showcase';
}
