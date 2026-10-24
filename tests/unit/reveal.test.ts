import { describe, expect, test } from 'vitest';
import { nextShown } from '@/experience/reveal';

const W = { from: 0.28, to: 0.6 };

describe('a chapter shown with some slack at its edges', () => {
  test('it comes on inside its window and not before', () => {
    expect(nextShown(false, 0.3, W)).toBe(true);
    expect(nextShown(false, 0.27, W)).toBe(false);
    expect(nextShown(false, 0.61, W)).toBe(false);
  });

  test('once on, it holds through a small wobble past either edge', () => {
    expect(nextShown(true, 0.26, W)).toBe(true);
    expect(nextShown(true, 0.62, W)).toBe(true);
  });

  test('it goes off well past an edge, or in another chapter', () => {
    expect(nextShown(true, 0.24, W)).toBe(false);
    expect(nextShown(true, 0.64, W)).toBe(false);
    expect(nextShown(true, null, W)).toBe(false);
  });
});
