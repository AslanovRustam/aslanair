import { poseOnPreTrack } from './cameraPoses';
import { CABIN_WALL_Z, stationToX } from './geometry';
import type { Phase } from './store';

const CABIN_FRONT_X = stationToX(4.0);

/**
 * Fraction of the drawing buffer the clouds are raymarched at. While the walking camera is inside the cabin
 * (late in the door flight and along the aisle) clouds only show through small windows, so half the
 * resolution is enough and frees the frame for the cabin; where the sky fills the view (outside, at the
 * seat, on the pass, through the exit) it stays at `base`.
 */
export function cloudScale(phase: Phase, progress: number, base = 0.5): number {
  if (phase !== 'browse') return base;
  const { x, z } = poseOnPreTrack(progress).position;
  const inside = Math.abs(z) < CABIN_WALL_Z - 0.1 && x < CABIN_FRONT_X;
  return inside ? base / 2 : base;
}
