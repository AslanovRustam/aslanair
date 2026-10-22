import { expect, test } from '@playwright/test';
import { scrollToEnd, state, waitForStore } from './helpers';

test('pick, reconsider, confirm', async ({ page }) => {
  await page.goto('/');
  await waitForStore(page);
  await scrollToEnd(page);

  await page.getByRole('button', { name: /pick for me/i }).click();
  await expect.poll(async () => (await state(page)).phase).toBe('seated');

  // Momentum while seated must not move us.
  const seatedAt = (await state(page)).progress;
  await page.mouse.wheel(0, 2000);
  await page.waitForTimeout(500);
  expect((await state(page)).progress).toBe(seatedAt);

  await page.getByRole('button', { name: /another/i }).click();
  await expect.poll(async () => (await state(page)).phase).toBe('browse');

  // Keyboard path.
  await page.getByRole('button', { name: /pick for me/i }).focus();
  await page.keyboard.press('Enter');
  await page.getByRole('button', { name: /choose this seat/i }).click();
  await expect.poll(async () => (await state(page)).phase).toBe('confirmed');
  await expect(page.getByRole('button', { name: /change seat/i })).toBeVisible();
  await page.waitForTimeout(1200);
  await page.screenshot({ path: 'test-results/pass.png' });
});

test('the outro panels can be wheel-scrolled on a short window', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 480 });
  await page.goto('/');
  await waitForStore(page);
  await scrollToEnd(page);
  await page.getByRole('button', { name: /pick for me/i }).click();
  await page.getByRole('button', { name: /choose this seat/i }).click();
  await expect.poll(async () => (await state(page)).phase).toBe('confirmed');
  await scrollToEnd(page);

  const outro = page.locator('section', { has: page.getByRole('heading', { name: /have a nice flight/i }) });
  await expect(outro).toBeVisible();
  await page.mouse.move(720, 240);
  await page.mouse.wheel(0, 300);
  await expect.poll(() => outro.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
});

test('take off, fill the form, start again', async ({ page }) => {
  const posts: string[] = [];
  page.on('request', (r) => {
    if (r.method() === 'POST') posts.push(r.url());
  });
  await page.goto('/');
  await waitForStore(page);
  await scrollToEnd(page);
  await page.getByRole('button', { name: /pick for me/i }).click();
  await page.getByRole('button', { name: /choose this seat/i }).click();
  await expect.poll(async () => (await state(page)).phase).toBe('confirmed');

  await scrollToEnd(page);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'test-results/outro.png' });

  await page.getByLabel(/name/i).fill('Test');
  await page.getByLabel(/e-mail/i).fill('t@example.com');
  await page.getByRole('button', { name: /^buy$/i }).click();
  await expect(page.getByText(/concept/i).first()).toBeVisible();
  // The footer also says "concept" on every chapter, so prove the form was replaced.
  await expect(page.getByRole('button', { name: /^buy$/i })).toHaveCount(0);
  expect(posts).toEqual([]);

  await page.getByRole('button', { name: /start again/i }).click();
  await expect.poll(async () => (await state(page)).phase).toBe('browse');
  await expect.poll(async () => (await state(page)).progress).toBe(0);
});
