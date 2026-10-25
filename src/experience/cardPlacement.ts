/** Clear of the screen's sides (px). */
const MARGIN = 12;
/** The stem keeps this far (px) inside the card's rounded corners. */
const STEM_INSET = 16;

/**
 * Where the seat card sits on the screen (plan 5 Task 6): over its seat's anchor (`x`, `y` in px), its middle pushed in
 * from a side edge — the stem then shifts by `stem` px to keep pointing at the seat — and turned under the anchor
 * when above it the card would rise into the header (`top`, px).
 */
export function cardPlacement(
  anchor: { x: number; y: number },
  card: { width: number; height: number },
  view: { width: number; height: number },
  top: number,
): { x: number; y: number; below: boolean; stem: number } {
  const half = card.width / 2;
  const x = Math.min(Math.max(anchor.x, MARGIN + half), view.width - MARGIN - half);
  const reach = half - STEM_INSET;
  const stem = Math.min(Math.max(anchor.x - x, -reach), reach) || 0;
  return { x, y: anchor.y, below: anchor.y - card.height < top, stem };
}
