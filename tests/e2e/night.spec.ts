import { expect, test, type Page } from '@playwright/test';
import { waitForStore } from './helpers';

type StoreWindow = Window & {
  __aslan: {
    scene?: { getObjectByName(n: string): unknown };
    store: { getState(): { setProgress(p: number): void; seats: { id: string; status: string }[]; sit(id: string): boolean; confirm(): void } };
  };
};

async function ready(page: Page) {
  await page.goto('/');
  await waitForStore(page);
  await page.waitForFunction(() => !!(window as unknown as StoreWindow).__aslan.scene?.getObjectByName('GalleyPanels'));
}

/** Luminance statistics and channel means of a screen box, from a screenshot. */
async function boxStats(page: Page, box: { x: number; y: number; width: number; height: number }) {
  const png = (await page.screenshot({ clip: box })).toString('base64');
  return page.evaluate(async (b64) => {
    const img = new Image();
    img.src = `data:image/png;base64,${b64}`;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = img.width;
    c.height = img.height;
    const ctx = c.getContext('2d')!;
    ctx.drawImage(img, 0, 0);
    const d = ctx.getImageData(0, 0, c.width, c.height).data;
    let r = 0, g = 0, b = 0, sum = 0, sq = 0, max = 0, bright = 0;
    const n = d.length / 4;
    for (let i = 0; i < d.length; i += 4) {
      const l = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
      r += d[i]; g += d[i + 1]; b += d[i + 2];
      sum += l; sq += l * l; max = Math.max(max, l);
      if (l > 120) bright++;
    }
    return { r: r / n, g: g / n, b: b / n, mean: sum / n, variance: sq / n - (sum / n) ** 2, max, bright };
  }, png);
}

test('before boarding the background is the plain dark of the site', async ({ page }) => {
  await ready(page);
  await page.evaluate(() => (window as unknown as StoreWindow).__aslan.store.getState().setProgress(0.05));
  await page.waitForTimeout(2500);
  for (const box of [{ x: 0, y: 0 }, { x: 1420, y: 0 }, { x: 0, y: 390 }, { x: 1420, y: 390 }]) {
    const s = await boxStats(page, { ...box, width: 20, height: 20 });
    expect(Math.max(s.r, s.g, s.b), `corner ${box.x},${box.y}`).toBeLessThanOrEqual(16);
  }
});

test('from a window seat the night sky is dark blue with moonlit clouds', async ({ page }) => {
  await ready(page);
  await page.evaluate(() => {
    const s = (window as unknown as StoreWindow).__aslan.store.getState();
    s.setProgress(0.6);
    s.seats.find((x) => x.id === '14F')!.status = 'free';
    s.sit('14F');
  });
  await page.waitForTimeout(3000);
  const s = await boxStats(page, { x: 560, y: 300, width: 240, height: 260 }); // through the window
  console.log('window', JSON.stringify(s));
  expect(s.b).toBeGreaterThan(s.r);
  expect(s.mean).toBeLessThanOrEqual(110);
  expect(s.bright, 'moon or moonlit cloud tops').toBeGreaterThan(0);
});

test('out through the window the clouds below are lit by the moon', async ({ page }) => {
  await ready(page);
  await page.evaluate(() => {
    const s = (window as unknown as StoreWindow).__aslan.store.getState();
    s.setProgress(0.6);
    s.seats.find((x) => x.id === '14F')!.status = 'free';
    s.sit('14F');
    s.confirm();
    s.setProgress(0.45);
  });
  await page.waitForTimeout(3000);
  const s = await boxStats(page, { x: 0, y: 420, width: 1440, height: 380 });
  console.log('exit clouds', JSON.stringify(s));
  expect(s.variance).toBeGreaterThan(40);
  expect(s.mean, 'a night sky, not daylight').toBeLessThan(120);
});
