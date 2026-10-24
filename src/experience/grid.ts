import { MathUtils } from 'three';
import { chapterAt } from './chapters';
import type { Phase } from './store';

/**
 * The grid backdrop of the dark chapters (spec r4 §4, after speca-team.vercel.app): 64 px cells drawn in faint lines;
 * the lines within `glowRadius` of the cursor light up in the accent, and the cells it crosses glow for `trailMs`.
 */
export const GRID = { cell: 64, line: 'rgba(242, 239, 232, 0.045)', glowRadius: 220, trailMs: 600 } as const;

/** 1 on every dark chapter before boarding; fading out early in the door flight, before the camera is inside. */
export function gridOpacity(phase: Phase, progress: number): number {
  if (phase !== 'browse') return 0;
  const { id, t } = chapterAt('pre', progress);
  if (id === 'aisle') return 0;
  if (id === 'door') return 1 - MathUtils.smoothstep(t, 0.2, 0.45);
  return 1;
}

/** How bright a cell the cursor crossed `ageMs` ago still is: 1 → 0, easing out. */
export function trailAlpha(ageMs: number): number {
  const k = MathUtils.clamp(1 - ageMs / GRID.trailMs, 0, 1);
  return k * k;
}

/** The cell (column, row) holding a point in CSS pixels. */
export function cellOf(x: number, y: number): [col: number, row: number] {
  return [Math.floor(x / GRID.cell), Math.floor(y / GRID.cell)];
}
