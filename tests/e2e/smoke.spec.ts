import { expect, test } from '@playwright/test';

test('home renders a WebGL canvas without console errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await page.goto('/');
  await expect(page.locator('.stage canvas')).toBeVisible({ timeout: 30_000 }); // the dev server may still be compiling
  expect(errors).toEqual([]);
});
