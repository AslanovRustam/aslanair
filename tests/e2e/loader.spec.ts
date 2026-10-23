import { expect, test } from '@playwright/test';

for (const viewport of [
  { width: 1440, height: 800 },
  { width: 412, height: 915 },
]) {
  test(`the loader paints first, shows progress and hands the plane picture to the hero at ${viewport.width}×${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.route('**/models/*.glb', async (r) => {
      await new Promise((f) => setTimeout(f, 1500));
      await r.continue();
    });
    await page.goto('/');
    const loader = page.locator('#loader');
    await expect(loader).toBeVisible();
    await expect(loader).toHaveAttribute('role', 'progressbar');
    // the hero mounts while the models are still held back: it waits behind the loader, its entrance not played
    await page.getByTestId('hero').waitFor({ state: 'attached' });
    const waiting = await page.getByTestId('hero').evaluate((hero) => ({
      loading: document.getElementById('loader')!.dataset.ready === 'false',
      paused: hero.getAnimations({ subtree: true }).every((a) => a.playState === 'paused'),
    }));
    expect(waiting).toEqual({ loading: true, paused: true });
    await expect.poll(async () => Number(await loader.getAttribute('aria-valuenow'))).toBeGreaterThan(0);
    const before = (await loader.locator('img').boundingBox())!;
    await expect(loader).toBeHidden({ timeout: 30_000 });
    const after = (await page.getByTestId('intro-plane').locator('img').boundingBox())!;
    for (const k of ['x', 'y', 'width', 'height'] as const) expect(Math.abs(before[k] - after[k]), k).toBeLessThanOrEqual(2);
    await expect(page.getByTestId('hero').getByRole('heading', { name: 'Night flight' })).toBeVisible();
  });
}

test('the loader and the plane picture preload come with the server response, before any script runs', async ({ request }) => {
  const response = await request.get('/');
  const html = await response.text();
  expect(html).toContain('id="loader"');
  expect(html).toContain('Preparing your night flight');
  // Next 16 sends resource hints as a Link header; a <link> tag in the HTML would do as well
  const header = response.headers()['link'] ?? '';
  const tag = /<link[^>]*rel="preload"[^>]*plane-hero\.png|<link[^>]*plane-hero\.png[^>]*rel="preload"/.test(html);
  expect(tag || /<\/images\/plane-hero\.png>;\s*rel=preload;\s*as="image"/.test(header)).toBe(true);
});
