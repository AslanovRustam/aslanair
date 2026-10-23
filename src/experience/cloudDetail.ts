import type { Phase } from './store';
import { cameraInsideCabin } from './worldState';

/**
 * Fraction of the drawing buffer the clouds are raymarched at. While the walking camera is inside the cabin
 * (late in the door flight and along the aisle) clouds only show through small windows, so half the
 * resolution is enough and frees the frame for the cabin; where the sky fills the view (outside, at the
 * seat, on the pass, through the exit) it stays at `base`.
 */
export function cloudScale(phase: Phase, progress: number, base = 0.5): number {
  if (phase !== 'browse') return base;
  return cameraInsideCabin(phase, progress) ? base / 2 : base;
}
