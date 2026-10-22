import { expect, type Page } from '@playwright/test';

export interface StoreSnapshot {
  phase: 'browse' | 'seated' | 'confirmed' | 'thanks';
  progress: number;
  selectedSeatId: string | null;
}

type StoreWindow = Window & { __aslan: { store: { getState(): StoreSnapshot } } };

/** The scene (and its test hook) loads via a client-only dynamic import, after `goto` resolves. */
export const waitForStore = (page: Page) => page.waitForFunction(() => !!(window as unknown as Partial<StoreWindow>).__aslan);

export const state = (page: Page) =>
  page.evaluate(() => {
    const s = (window as unknown as StoreWindow).__aslan.store.getState();
    return { phase: s.phase, progress: s.progress, selectedSeatId: s.selectedSeatId };
  });

export const progress = async (page: Page) => (await state(page)).progress;

/** Wheel until the current scroll track reaches its end. */
export async function scrollToEnd(page: Page) {
  for (let i = 0; i < 40; i++) await page.mouse.wheel(0, 600);
  await expect.poll(() => progress(page), { timeout: 15_000 }).toBeGreaterThan(0.95);
}
