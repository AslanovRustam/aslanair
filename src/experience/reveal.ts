/**
 * Whether a chapter's words and cards show (spec r4 §5): on inside its `window` (fractions of the chapter), and once
 * on, off only `slack` past either edge — a wobble of the scroll at an edge never restarts the entrance. `t` is the
 * chapter's own progress, or null when the visitor is in another chapter.
 */
export function nextShown(prev: boolean, t: number | null, window: { from: number; to: number }, slack = 0.03): boolean {
  if (t === null) return false;
  if (prev) return t >= window.from - slack && t <= window.to + slack;
  return t >= window.from && t <= window.to;
}
