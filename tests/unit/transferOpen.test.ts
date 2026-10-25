import { describe, expect, test } from 'vitest';
import { openTransfer, PREVIEW, previewCard } from '@/experience/transferOpen';

describe('which transfer card is open', () => {
  test('scrolling through the middle of the chapter shows each card in turn, in their order on screen', () => {
    expect(PREVIEW).toEqual({ from: 0.2, to: 0.85 });
    expect(previewCard(0.1)).toBeNull();
    expect(previewCard(0.25)).toBe('home');
    expect(previewCard(0.45)).toBe('hotel');
    expect(previewCard(0.6)).toBe('express');
    expect(previewCard(0.8)).toBe('own');
    expect(previewCard(0.9)).toBeNull();
  });

  test('the preview shows; a pick, the pointer and the focus win over it', () => {
    const base = { t: 0.45, picked: false, chosen: 'own' as const, hovered: null, focused: null };
    expect(openTransfer(base)).toBe('hotel');
    expect(openTransfer({ ...base, picked: true })).toBe('own');
    expect(openTransfer({ ...base, hovered: 'home' })).toBe('home');
    expect(openTransfer({ ...base, picked: true, hovered: 'home' })).toBe('home');
    expect(openTransfer({ ...base, focused: 'express' })).toBe('express');
    expect(openTransfer({ ...base, t: null })).toBe('own');
    expect(openTransfer({ ...base, t: 0.1 })).toBe('own');
  });
});
