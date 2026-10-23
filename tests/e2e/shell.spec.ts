import { expect, test, type Page } from '@playwright/test';
import { settledProgress, waitForStore } from './helpers';

type StoreWindow = Window & {
  __aslan: {
    store: {
      getState(): {
        phase: string;
        progress: number;
        seats: { id: string; status: string }[];
        setProgress(p: number): void;
        sit(id: string): boolean;
        confirm(): void;
      };
    };
  };
};

const state = (page: Page) =>
  page.evaluate(() => {
    const s = (window as unknown as StoreWindow).__aslan.store.getState();
    return { phase: s.phase, progress: s.progress };
  });

async function open(page: Page) {
  await page.goto('/');
  await waitForStore(page);
}

test('header, chapter rail and footer frame the experience from the start', async ({ page }) => {
  await open(page);
  await expect(page.getByRole('banner')).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Chapters' })).toBeVisible();
  await expect(page.getByRole('contentinfo')).toContainText('fictional');
  await expect(page.getByRole('button', { name: 'Choose your seat' })).toBeVisible();
});

test('Cabin takes the visitor into the aisle', async ({ page }) => {
  await open(page);
  await page.getByRole('banner').getByRole('button', { name: 'Cabin' }).click();
  await expect.poll(async () => (await state(page)).progress, { timeout: 10_000 }).toBeGreaterThanOrEqual(0.45);
});

test('after confirming a seat the cabin is out of reach and the call to action is gone', async ({ page }) => {
  await open(page);
  await page.evaluate(() => {
    const s = (window as unknown as StoreWindow).__aslan.store.getState();
    s.setProgress(0.6);
    s.seats.find((x) => x.id === '14F')!.status = 'free';
    s.sit('14F');
    s.confirm();
  });
  await settledProgress(page);
  const cabin = page.getByRole('banner').getByRole('button', { name: 'Cabin' });
  await expect(cabin).toBeDisabled();
  const before = await state(page);
  await cabin.click({ force: true });
  await page.waitForTimeout(800);
  expect(await state(page)).toEqual(before);
  await expect(page.getByRole('button', { name: 'Choose your seat' })).toBeHidden();
});

test("How it's made opens from the header and the footer and closes with Escape", async ({ page }) => {
  await open(page);
  for (const where of ['banner', 'contentinfo'] as const) {
    const opener = page.getByRole(where).getByRole('button', { name: "How it's made" });
    await opener.click();
    const dialog = page.getByRole('dialog', { name: "How it's made" });
    await expect(dialog).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(opener).toBeFocused();
  }
});

test('on a phone the navigation folds into a menu and nothing overflows', async ({ page }) => {
  await page.setViewportSize({ width: 412, height: 915 });
  await open(page);
  await expect(page.getByRole('button', { name: 'Menu' })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Chapters' })).toBeHidden();
  expect(await page.evaluate(() => document.body.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Menu' }).click();
  await expect(page.getByRole('dialog', { name: 'Menu' }).getByRole('button', { name: 'Cabin' })).toBeVisible();
});
