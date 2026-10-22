import { expect, test, type Page } from '@playwright/test';

type StoreWindow = Window & { __aslan: { store: { getState(): { progress: number; phase: string } } } };
const progress = (page: Page) => page.evaluate(() => (window as unknown as StoreWindow).__aslan.store.getState().progress);
/** The scene (and its test hook) loads via a client-only dynamic import, after `goto` resolves. */
const waitForStore = (page: Page) => page.waitForFunction(() => !!(window as unknown as Partial<StoreWindow>).__aslan);

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
  await expect(page.getByText(/WebGL2/i)).toBeVisible();
});
