import { expect, type Page } from '@playwright/test';
import { trackProgress, type ChapterId } from '@/experience/chapters';

declare global {
  /** Installed in the page by the dev test hooks: pre-track progress of chapter `id` at local `t`. */
  function __pre(id: ChapterId, t: number): number;
}

/** Pre-track progress of chapter `id` at local `t` (node side). */
export const pre = (id: ChapterId, t: number) => trackProgress('pre', id, t);

export interface StoreSnapshot {
  phase: 'browse' | 'seated' | 'confirmed' | 'thanks';
  progress: number;
  selectedSeatId: string | null;
  hoveredSeatId: string | null;
}

interface SceneLike {
  traverseVisible(cb: (o: { isLight?: boolean }) => void): void;
  getObjectByName(name: string): unknown;
}

type StoreWindow = Window & { __aslan: { store: { getState(): StoreSnapshot }; scene?: SceneLike } };

/** The scene (and its test hook) loads via a client-only dynamic import, after `goto` resolves. */
export const waitForStore = (page: Page) => page.waitForFunction(() => !!(window as unknown as Partial<StoreWindow>).__aslan);

export const state = (page: Page) =>
  page.evaluate(() => {
    const s = (window as unknown as StoreWindow).__aslan.store.getState();
    return { phase: s.phase, progress: s.progress, selectedSeatId: s.selectedSeatId };
  });

export const progress = async (page: Page) => (await state(page)).progress;

export const hoveredSeat = (page: Page) =>
  page.evaluate(() => (window as unknown as StoreWindow).__aslan.store.getState().hoveredSeatId);

/** Waits until Lenis has finished easing: two reads 300 ms apart agree. */
export async function settledProgress(page: Page): Promise<number> {
  let last = -1;
  for (let i = 0; i < 30; i++) {
    const now = await progress(page);
    if (Math.abs(now - last) < 1e-4) return now;
    last = now;
    await page.waitForTimeout(300);
  }
  return last;
}

/** Waits for the aircraft (and everything mounted with it) to be in the scene. */
export const waitForAircraft = (page: Page) =>
  page.waitForFunction(() => !!(window as unknown as StoreWindow).__aslan?.scene?.getObjectByName('Fuselage'));

export const visibleLights = (page: Page) =>
  page.evaluate(() => {
    let n = 0;
    (window as unknown as StoreWindow).__aslan.scene!.traverseVisible((o) => {
      if ((o as { isLight?: boolean }).isLight) n++;
    });
    return n;
  });

/** Moves the pointer over a grid on the lower screen until a seat is hovered; returns it and the pointer position. */
export async function scanForHoveredSeat(page: Page): Promise<{ id: string; x: number; y: number }> {
  // under a busy GPU the cabin kit can still be loading when the scroll settles
  await page.waitForFunction(() => !!(window as unknown as StoreWindow).__aslan?.scene?.getObjectByName('SeatHit'));
  for (let y = 440; y < 760; y += 40) {
    for (let x = 140; x < 1300; x += 60) {
      await page.mouse.move(x, y);
      const id = await hoveredSeat(page);
      if (id) return { id, x, y };
    }
  }
  throw new Error('no seat under the pointer grid');
}

/** Real wheel scrolling (through Lenis) until the progress reaches `target`; returns where it settled. */
export async function wheelTo(page: Page, target: number): Promise<number> {
  let at = await progress(page);
  for (let i = 0; i < 40 && at < target; i++) {
    // a notch at a time, each left to settle, so the scroll stops just past `target` rather than overshooting
    await page.mouse.wheel(0, 300);
    let last = -1;
    for (let k = 0; k < 20 && Math.abs(at - last) > 1e-4; k++) {
      last = at;
      await page.waitForTimeout(150);
      at = await progress(page);
    }
  }
  return at;
}

/** Wheel until the current scroll track reaches its end. */
export async function scrollToEnd(page: Page) {
  for (let i = 0; i < 40; i++) await page.mouse.wheel(0, 600);
  await expect.poll(() => progress(page), { timeout: 15_000 }).toBeGreaterThan(0.95);
}
