import { expect, test } from '@playwright/test';
import { heroPictureBox } from './helpers';

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
    const after = heroPictureBox(page); // where the live camera frames the plane at the top
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

test('the loader reveals the emblem bottom to top on the compositor, with no outline and no bar', async ({ page }) => {
  await page.route('**/models/*.glb', async (r) => {
    await new Promise((f) => setTimeout(f, 3000));
    await r.continue();
  });
  await page.goto('/');
  const loader = page.locator('#loader');
  await expect(loader).toBeVisible();
  await expect(loader.locator('[data-part="ring"]')).toHaveCount(0);
  await expect(loader.locator('[data-part="bar"]')).toHaveCount(0);
  const reveal = await loader.locator('[data-part="reveal"]').evaluate((el) => {
    const animations = el.getAnimations({ subtree: true });
    const properties = new Set<string>();
    for (const a of animations)
      for (const k of (a.effect as KeyframeEffect).getKeyframes())
        for (const key of Object.keys(k)) if (!['offset', 'easing', 'composite', 'computedOffset'].includes(key)) properties.add(key);
    const own = el.getAnimations()[0];
    return { count: animations.length, properties: [...properties], from: String((own.effect as KeyframeEffect).getKeyframes()[0].transform) };
  });
  // transform and opacity only: the compositor runs them even while the page's scripts keep the main thread busy
  expect(reveal.count).toBeGreaterThan(0);
  expect(reveal.properties.every((p) => p === 'transform' || p === 'opacity'), reveal.properties.join(',')).toBe(true);
  // the window over the emblem starts below it and rises
  expect(reveal.from).toMatch(/translateY\(100%\)|matrix\(1, 0, 0, 1, 0, [1-9]/);
});
