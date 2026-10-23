import { expect, test } from '@playwright/test';
import { progress, scrollToEnd, settledProgress, visibleLights, waitForAircraft, waitForStore } from './helpers';

test('rotating a phone keeps the story position', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await waitForStore(page);
  for (let i = 0; i < 2; i++) await page.mouse.wheel(0, 600);
  const before = await settledProgress(page);
  // somewhere in the journey, clear of both ends
  expect(before).toBeGreaterThan(0.1);
  expect(before).toBeLessThan(0.6);
  await page.setViewportSize({ width: 844, height: 390 });
  await page.waitForTimeout(800);
  expect(Math.abs((await progress(page)) - before)).toBeLessThan(0.02);
});

test('scroll restoration stays manual after a resize and a confirmed seat', async ({ page }) => {
  const mode = () => page.evaluate(() => history.scrollRestoration);
  await page.goto('/');
  await waitForStore(page);
  expect(await mode()).toBe('manual');
  await page.setViewportSize({ width: 1200, height: 700 });
  await page.waitForTimeout(500);
  expect(await mode()).toBe('manual');
  await scrollToEnd(page);
  await page.getByRole('button', { name: /pick for me/i }).click();
  await page.getByRole('button', { name: /choose this seat/i }).click();
  await page.waitForTimeout(500);
  expect(await mode()).toBe('manual');
});

test('the aisle is the GLB cabin shell, not the placeholder box', async ({ page }) => {
  await page.goto('/');
  await waitForStore(page);
  await waitForAircraft(page);
  await scrollToEnd(page);
  const found = await page.evaluate(() => {
    const scene = (window as unknown as { __aslan: { scene: { getObjectByName(n: string): { visible: boolean } | undefined } } }).__aslan.scene;
    return { shell: scene.getObjectByName('CabinShell')?.visible ?? false, placeholder: !!scene.getObjectByName('PlaceholderCabin') };
  });
  expect(found).toEqual({ shell: true, placeholder: false });
});

test('the visible light count never changes (no shader recompiles on entry)', async ({ page }) => {
  await page.goto('/');
  await waitForStore(page);
  await waitForAircraft(page);
  const atSky = await visibleLights(page);
  await scrollToEnd(page);
  expect(await visibleLights(page)).toBe(atSky);
});

test('scrolling walks from the sky into the aisle', async ({ page }) => {
  await page.goto('/');
  await waitForStore(page);
  await expect.poll(() => progress(page)).toBe(0);
  for (let i = 0; i < 40; i++) await page.mouse.wheel(0, 600);
  await expect.poll(() => progress(page), { timeout: 15_000 }).toBeGreaterThan(0.95);
  await page.screenshot({ path: 'test-results/aisle.png' });
});

test('the aisle offers "Pick for me"', async ({ page }) => {
  await page.goto('/');
  await waitForStore(page);
  for (let i = 0; i < 40; i++) await page.mouse.wheel(0, 600);
  await expect.poll(() => progress(page), { timeout: 15_000 }).toBeGreaterThan(0.95);
  await expect(page.getByRole('button', { name: /pick for me/i })).toBeVisible();
});

test('reload mid-page restarts at the sky', async ({ page }) => {
  await page.goto('/');
  await waitForStore(page);
  for (let i = 0; i < 10; i++) await page.mouse.wheel(0, 600);
  await expect.poll(() => progress(page)).toBeGreaterThan(0);
  await page.reload();
  await waitForStore(page);
  await expect.poll(() => progress(page)).toBe(0);
});

test('resize keeps rendering', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await page.goto('/');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.setViewportSize({ width: 1440, height: 800 });
  await expect(page.locator('canvas')).toBeVisible();
  expect(errors).toEqual([]);
});

test('no WebGL2 shows the fallback', async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    // @ts-expect-error test shim: hide WebGL2 only
    HTMLCanvasElement.prototype.getContext = function (type: string, ...rest: unknown[]) {
      return type === 'webgl2' ? null : original.call(this, type as '2d', ...(rest as []));
    };
  });
  await page.goto('/');
  const message = page.getByText(/WebGL2/i);
  await expect(message).toBeVisible();
  // visible to the visitor, not just in the layout: nothing (such as the loader) covers it
  await expect(page.locator('#loader')).toBeHidden();
  await expect
    .poll(() =>
      message.evaluate((el) => {
        const r = el.getBoundingClientRect();
        return el.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
      }),
    )
    .toBe(true);
});
