import { describe, expect, test } from 'vitest';
import { cardPlacement } from '@/experience/cardPlacement';

const view = { width: 412, height: 839 };
const card = { width: 190, height: 96 };

describe('the seat card stays on the screen (plan 5 Task 6)', () => {
  test('over its seat where there is room', () => {
    expect(cardPlacement({ x: 200, y: 500 }, card, view, 70)).toEqual({ x: 200, y: 500, below: false, stem: 0 });
  });

  test('pushed in from a side edge, its stem still pointing at the seat', () => {
    const p = cardPlacement({ x: 30, y: 500 }, card, view, 70);
    expect(p.x - card.width / 2).toBeGreaterThanOrEqual(12);
    expect(p.x + p.stem).toBeCloseTo(30);
    const q = cardPlacement({ x: 380, y: 500 }, card, view, 70);
    expect(q.x + card.width / 2).toBeLessThanOrEqual(view.width - 12);
    expect(q.x + q.stem).toBeCloseTo(380);
  });

  test('turned under its seat when it would rise into the header', () => {
    const p = cardPlacement({ x: 200, y: 120 }, card, view, 70);
    expect(p.below).toBe(true);
    expect(p.y).toBe(120);
  });

  test('the stem never leaves the card', () => {
    const p = cardPlacement({ x: -40, y: 500 }, card, view, 70);
    expect(Math.abs(p.stem)).toBeLessThanOrEqual(card.width / 2 - 16);
  });
});
