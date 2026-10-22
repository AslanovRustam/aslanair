import { chapterAt } from './chapters';
import type { Phase } from './store';

/**
 * Fraction of the drawing buffer the clouds are raymarched at. Walking the aisle, clouds only show through
 * small windows, so half that resolution is enough and frees the frame for the cabin; everywhere the sky
 * fills the view (outside, at the seat, on the pass, through the exit) it stays at `base`.
 */
export function cloudScale(phase: Phase, progress: number, base = 0.5): number {
  return phase === 'browse' && chapterAt('pre', progress).id === 'aisle' ? base / 2 : base;
}
