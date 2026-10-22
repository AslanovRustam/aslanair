import { expect, test } from '@playwright/test';

test('home renders a WebGL canvas without console errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await page.goto('/');
  await expect(page.locator('canvas')).toBeVisible();
  expect(errors).toEqual([]);
});
