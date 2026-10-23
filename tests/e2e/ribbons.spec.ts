import { expect, test, type Page } from '@playwright/test';
import type { ChapterId } from '@/experience/chapters';
import { waitForStore } from './helpers';

type StoreWindow = { __aslan: { store: { getState(): { setProgress(p: number): void } } } };

async function open(page: Page) {
  await page.goto('/');
  await waitForStore(page);
  await page.waitForFunction(() => document.getElementById('loader')?.dataset.ready === 'true');
}

/** Straight to a point of the pre track, then two frames. */
async function showAt(page: Page, id: ChapterId, t: number) {
  await page.evaluate(
    ([id, t]) =>
      new Promise<void>((done) => {
        (window as unknown as StoreWindow).__aslan.store.getState().setProgress(__pre(id as ChapterId, t as number));
        requestAnimationFrame(() => requestAnimationFrame(() => done()));
      }),
    [id, t] as const,
  );
}

/** How much of each ribbon is on screen (0 … 1 of its visible width) and whether it is shown at all. */
const ribbons = (page: Page) =>
  page.getByTestId('ribbon').evaluateAll((els) =>
    els.map((el) => {
      const r = el.getBoundingClientRect();
      const across = Math.max(0, Math.min(innerWidth, r.right) - Math.max(0, r.left)) / innerWidth;
      return { shown: getComputedStyle(el).visibility === 'visible', across };
    }),
  );

test('the ribbons sweep across the seams of the journey and stay out of the chapters', async ({ page }) => {
  await open(page);
  await expect(page.getByTestId('ribbon')).toHaveCount(2);
  for (const [id, t] of [
    ['sky', 0.3],
    ['destinations', 0.5],
    ['transfer', 0.5],
  ] as const) {
    await showAt(page, id, t);
    for (const r of await ribbons(page)) expect(r.shown, `${id} ${t}`).toBe(false);
  }
  for (const id of ['destinations', 'transfer', 'ready'] as const) {
    await showAt(page, id, 0);
    for (const r of await ribbons(page)) {
      expect(r.shown, `seam into ${id}`).toBe(true);
      expect(r.across, `seam into ${id}`).toBeGreaterThan(0.9);
    }
  }
  // they carry the flight's phrases, the chosen route among them
  await expect(page.getByTestId('ribbon').first()).toContainText('RMO → LIS');
  const props = await page.getByTestId('ribbon').evaluateAll((els) =>
    els.flatMap((el) =>
      el.getAnimations({ subtree: true }).flatMap((a) =>
        (a.effect as KeyframeEffect).getKeyframes().flatMap((k) => Object.keys(k).filter((x) => !['offset', 'easing', 'composite', 'computedOffset'].includes(x))),
      ),
    ),
  );
  expect(props.length, 'the marquee runs').toBeGreaterThan(0);
  expect(props.every((p) => p === 'transform'), props.join(',')).toBe(true);
});

test('with reduced motion the ribbons do not run', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await open(page);
  await showAt(page, 'transfer', 0);
  await expect(page.getByTestId('ribbon')).toHaveCount(2);
  for (const r of await ribbons(page)) expect(r.shown).toBe(true);
  const running = await page
    .getByTestId('ribbon')
    .evaluateAll((els) => els.flatMap((el) => el.getAnimations({ subtree: true })).filter((a) => a.playState === 'running').length);
  expect(running).toBe(0);
});
