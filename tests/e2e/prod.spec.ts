import { expect, test } from '@playwright/test';

// Against the production build: `npm run build && npm run start -- -p 3300`, then
// `npx playwright test --project=prod`. Test hooks are off in production: the DOM only.

test('production renders, caches the models, images and sounds, and logs no errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  let modelBytes = 0;
  const cache: string[] = [];
  page.on('response', async (r) => {
    const path = new URL(r.url()).pathname;
    if (!/^\/(models|images|sounds)\//.test(path)) return;
    cache.push(`${path} ${r.headers()['cache-control'] ?? ''}`);
    if (path.startsWith('/models/') && path.endsWith('.glb')) modelBytes += (await r.body()).length;
  });
  await page.goto('/');
  await expect(page.locator('#loader')).toBeHidden({ timeout: 30_000 });
  await expect(page.locator('canvas')).toBeVisible();
  expect(errors).toEqual([]);
  expect(cache.length).toBeGreaterThan(0);
  for (const c of cache) expect(c).toContain('max-age=86400');
  expect(modelBytes).toBeLessThanOrEqual(2_100_000);
});

test('production: the capture mode and the test hooks are off', async ({ page }) => {
  await page.goto('/?capture=plane');
  await expect(page.locator('#loader')).toBeHidden({ timeout: 30_000 });
  expect(await page.evaluate(() => 'store' in ((window as unknown as { __aslan?: object }).__aslan ?? {}))).toBe(false);
  await expect(page.getByTestId('hero')).toBeAttached();
});
