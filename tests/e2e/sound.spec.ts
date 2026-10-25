import { expect, test, type Page } from '@playwright/test';
import { loaderGone, waitForStore } from './helpers';

type SoundWindow = Window & { __contexts?: number };

/** Counts AudioContexts made, from before any page script runs. */
const countContexts = (page: Page) =>
  page.addInitScript(() => {
    const Native = window.AudioContext;
    window.AudioContext = class extends Native {
      constructor(...args: ConstructorParameters<typeof AudioContext>) {
        super(...args);
        (window as SoundWindow).__contexts = ((window as SoundWindow).__contexts ?? 0) + 1;
      }
    };
  });
const contexts = (page: Page) => page.evaluate(() => (window as SoundWindow).__contexts ?? 0);

test('no sound before a gesture; the first gesture starts it; muting is remembered across a reload', async ({ page }) => {
  await countContexts(page);
  await page.goto('/');
  await waitForStore(page);
  await loaderGone(page);
  await page.mouse.move(720, 400);
  await page.mouse.wheel(0, 1200); // scrolling alone is no gesture
  await page.waitForTimeout(500);
  expect(await contexts(page), 'no audio before a gesture').toBe(0);

  const on = page.getByRole('button', { name: 'Sound on' });
  await expect(on).toHaveAttribute('aria-pressed', 'true');
  await on.click(); // the first gesture: the sound starts, and the click mutes it
  expect(await contexts(page)).toBe(1);
  const off = page.getByRole('button', { name: 'Sound off' });
  await expect(off).toHaveAttribute('aria-pressed', 'false');

  await page.reload();
  await waitForStore(page);
  await expect(page.getByRole('button', { name: 'Sound off' })).toBeVisible();
});

test('the recordings are fetched only once sound starts, all four, with no error', async ({ page }) => {
  const asked: string[] = [];
  const errors: string[] = [];
  page.on('requestfinished', async (r) => {
    if (r.url().includes('/sounds/')) asked.push(`${new URL(r.url()).pathname} ${(await r.response())?.status()}`);
  });
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto('/');
  await waitForStore(page);
  await loaderGone(page);
  await page.waitForTimeout(500);
  expect(asked, 'nothing before a gesture').toEqual([]);
  await page.getByRole('button', { name: /^Sound (on|off)$/ }).click();
  await expect.poll(() => asked.length, { timeout: 10_000 }).toBe(4);
  expect(asked.sort()).toEqual(['/sounds/airport-crowd.mp3 200', '/sounds/boarding-announcement.mp3 200', '/sounds/cabin-cruise.mp3 200', '/sounds/night-music.mp3 200']);
  await page.waitForTimeout(500); // decoded
  expect(errors).toEqual([]);
});

test('on a phone the sound switch stays in the header, outside the menu', async ({ page }) => {
  await page.setViewportSize({ width: 412, height: 915 });
  await page.goto('/');
  await waitForStore(page);
  const toggle = page.getByRole('banner').getByRole('button', { name: /^Sound (on|off)$/ });
  await expect(toggle).toBeVisible();
  const box = (await toggle.boundingBox())!;
  expect(box.x + box.width).toBeLessThanOrEqual(412);
  expect(box.height).toBeGreaterThanOrEqual(36);
});
