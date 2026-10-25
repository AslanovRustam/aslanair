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

test('the page shares well: title, description, a 1200 × 630 picture and an icon', async ({ page, request }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/AslanAir/);
  const meta = (selector: string) => page.locator(selector).getAttribute('content');
  expect(await meta('meta[name="description"]')).toMatch(/concept/i);
  const image = new URL((await meta('meta[property="og:image"]'))!);
  expect(image.pathname).toBe('/og.png');
  expect(await meta('meta[property="og:image:width"]')).toBe('1200');
  expect(await meta('meta[property="og:image:height"]')).toBe('630');
  expect(await meta('meta[name="twitter:card"]')).toBe('summary_large_image');
  expect((await request.get('/og.png')).status()).toBe(200);
  const icon = await page.locator('link[rel="icon"][type="image/svg+xml"]').getAttribute('href');
  expect((await request.get(icon!)).status()).toBe(200);
});
