import { chapterAt } from './chapters';
import { trackOf, type Phase } from './store';
import { cameraInsideCabin } from './worldState';

/** On the way out (and behind the outro) the sky fills a fast-moving view, looking down into the thick of the
 * layer where every ray takes all its steps: blurred clouds lose nothing at this, the GPU saves ~2 ms. */
const EXIT_SCALE = 0.5;

/**
 * Fraction of the drawing buffer the clouds are raymarched at. While the walking camera is inside the cabin
 * (late in the door flight and along the aisle) clouds only show through small windows, so half the
 * resolution is enough and frees the frame for the cabin; outside, at the seat and on the pass it stays at
 * `base`; through the exit and the outro it is `base` × EXIT_SCALE, which keeps the exit inside the frame budget.
 */
export function cloudScale(phase: Phase, progress: number, base = 0.5): number {
  if (trackOf(phase) === 'post') return chapterAt('post', progress).id === 'pass' ? base : base * EXIT_SCALE;
  if (phase !== 'browse') return base;
  return cameraInsideCabin(phase, progress) ? base / 2 : base;
}
