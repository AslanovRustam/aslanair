import type { TransferId } from './destinations';
import { TRANSFERS } from './destinations';

/**
 * Transfer by scroll (spec r5 §5): until the visitor picks a card, scrolling through this stretch of the chapter
 * opens the four cards in turn, in their order on screen, each over an equal share of it — it shows them, it chooses
 * nothing.
 */
export const PREVIEW = { from: 0.2, to: 0.85 } as const;

/** The card the scroll shows at transfer-chapter share `t`, or null outside the preview's stretch. */
export function previewCard(t: number): TransferId | null {
  if (t < PREVIEW.from || t >= PREVIEW.to) return null;
  const share = (PREVIEW.to - PREVIEW.from) / TRANSFERS.length;
  return TRANSFERS[Math.min(TRANSFERS.length - 1, Math.floor((t - PREVIEW.from) / share))].id;
}

/**
 * The open card: the one under the pointer, else the focused one, else — until the visitor has picked one, while in
 * the chapter (`t` not null) — the preview's, else the chosen one.
 */
export function openTransfer(s: { t: number | null; picked: boolean; chosen: TransferId; hovered: TransferId | null; focused: TransferId | null }): TransferId {
  return s.hovered ?? s.focused ?? (s.picked || s.t === null ? s.chosen : (previewCard(s.t) ?? s.chosen));
}
