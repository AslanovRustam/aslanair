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
