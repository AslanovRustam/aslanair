import { expect, test, type Page } from '@playwright/test';
import { waitForStore } from './helpers';

type RevealWindow = Window & { __aslan: { store: { getState(): { setProgress(p: number): void } } } };

async function open(page: Page) {
  await page.goto('/');
  await waitForStore(page);
  await page.waitForFunction(() => document.getElementById('loader')?.dataset.ready === 'true', null, { timeout: 60_000 });
}

/** Puts the scroll position straight into the store and lets two frames draw it. */
const showAt = (page: Page, id: string, t: number) =>
  page.evaluate(
    ([i, v]) =>
      new Promise<void>((done) => {
        (window as unknown as RevealWindow).__aslan.store.getState().setProgress(__pre(i as 'sky', v as number));
        requestAnimationFrame(() => requestAnimationFrame(() => done()));
      }),
    [id, t] as const,
  );

const title = (page: Page) => page.locator('[data-heading="destinations"]');

/** Each word of the destinations title: its animation's delay, keyframe properties, duration and opacity. */
const words = (page: Page) =>
  title(page)
    .locator('[data-part="reveal"]')
    .evaluateAll((els) =>
      els.map((el) => {
        const a = el.getAnimations()[0];
        const props = a ? (a.effect as KeyframeEffect).getKeyframes().flatMap((k) => Object.keys(k).filter((x) => !['offset', 'easing', 'composite', 'computedOffset'].includes(x))) : [];
        const timing = a?.effect?.getTiming();
        return { delay: Number(timing?.delay ?? -1), duration: Number(timing?.duration ?? -1), props, opacity: Number(getComputedStyle(el).opacity) };
      }),
    );

test('chapter titles come in word by word, staggered, and settle', async ({ page }) => {
  await open(page);
  await showAt(page, 'destinations', 0.45);
  const first = await words(page);
  expect(first.length).toBeGreaterThan(2);
  for (let i = 1; i < first.length; i++) expect(first[i].delay, `word ${i}`).toBeGreaterThan(first[i - 1].delay);
  for (const w of first) expect(w.props.every((p) => p === 'transform' || p === 'opacity'), w.props.join(',')).toBe(true);
  await page.waitForTimeout(1600);
  for (const w of await words(page)) expect(w.opacity).toBe(1);
});

test('a wobble at the edge does not replay the entrance', async ({ page }) => {
  await open(page);
  await showAt(page, 'destinations', 0.29);
  await page.waitForTimeout(300);
  const mark = () =>
    title(page)
      .locator('[data-part="reveal"]')
      .first()
      .evaluate((el) => {
        const a = el.getAnimations()[0] as Animation & { mark?: number };
        if (!a) return null;
        a.mark ??= Math.random();
        return { mark: a.mark, start: a.startTime };
      });
  const before = await mark();
  expect(before).not.toBeNull();
  await showAt(page, 'destinations', 0.27);
  await showAt(page, 'destinations', 0.29);
  expect(await mark()).toEqual(before);
});

test('scrolling away and back replays it', async ({ page }) => {
  await open(page);
  await showAt(page, 'destinations', 0.45);
  await page.waitForTimeout(1600);
  await showAt(page, 'transfer', 0.75);
  await page.waitForTimeout(300);
  await showAt(page, 'destinations', 0.45);
  const now = await title(page)
    .locator('[data-part="reveal"]')
    .first()
    .evaluate((el) => Number(el.getAnimations()[0]?.currentTime ?? 1e9));
  expect(now).toBeLessThan(300);
});

test('reduced motion: opacity only, quick', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await open(page);
  await showAt(page, 'destinations', 0.45);
  const all = await words(page);
  expect(all.length).toBeGreaterThan(2);
  for (const w of all) {
    expect(w.duration).toBeGreaterThan(0);
    expect(w.props).not.toContain('transform');
    expect(w.duration).toBeLessThanOrEqual(300);
  }
});

test('the departures rows rise in one after another', async ({ page }) => {
  await open(page);
  await showAt(page, 'destinations', 0.45);
  const delays = await page
    .getByTestId('departures')
    .locator('[data-stagger]')
    .evaluateAll((els) => els.slice(0, 3).map((el) => Number(el.getAnimations()[0]?.effect?.getTiming().delay ?? -1)));
  expect(delays).toHaveLength(3);
  expect(delays[1]).toBeGreaterThan(delays[0]);
  expect(delays[2]).toBeGreaterThan(delays[1]);
});
