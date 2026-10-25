import { expect, test, type Page } from '@playwright/test';
import { loaderGone, waitForStore } from './helpers';

type GridWindow = Window & {
  __aslan: {
    store: { getState(): { setProgress(p: number): void; seats: { id: string; status: string }[]; sit(id: string): boolean; confirm(): void } };
  };
};

async function open(page: Page, at: number | null = null) {
  await page.setViewportSize({ width: 1440, height: 800 });
  await page.goto('/');
  await waitForStore(page);
  await loaderGone(page);
  await page.addStyleTag({ content: 'nextjs-portal { display: none !important; }' });
  if (at !== null) await page.evaluate((p) => (window as unknown as GridWindow).__aslan.store.getState().setProgress(p), at);
  await page.waitForTimeout(600);
}

/** Mean red-minus-green and luminance of the grid's line pixels (x ≡ 0 mod 64) and of the gaps (x ≡ 32) in a box. */
async function lines(page: Page, box: { x: number; y: number; width: number; height: number }) {
  const png = (await page.screenshot({ clip: box })).toString('base64');
  return page.evaluate(
    async ([src, x0]) => {
      const img = new Image();
      img.src = `data:image/png;base64,${src}`;
      await img.decode();
      const c = document.createElement('canvas');
      [c.width, c.height] = [img.width, img.height];
      const ctx = c.getContext('2d')!;
      ctx.drawImage(img, 0, 0);
      const d = ctx.getImageData(0, 0, c.width, c.height).data;
      const acc = { line: { lum: 0, warm: 0, n: 0 }, gap: { lum: 0, warm: 0, n: 0 } };
      for (let y = 0; y < c.height; y++)
        for (let x = 0; x < c.width; x++) {
          const m = (((x0 + x) % 64) + 64) % 64;
          const k = m === 0 ? acc.line : m === 32 ? acc.gap : null;
          if (!k) continue;
          const i = (y * c.width + x) * 4;
          k.lum += 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
          k.warm += d[i] - d[i + 1];
          k.n++;
        }
      return {
        line: { lum: acc.line.lum / acc.line.n, warm: acc.line.warm / acc.line.n },
        gap: { lum: acc.gap.lum / acc.gap.n, warm: acc.gap.warm / acc.gap.n },
      };
    },
    [png, box.x] as const,
  );
}

const pre = (page: Page, id: string, t: number) => page.evaluate(([i, v]) => __pre(i as 'sky', v as number), [id, t] as const);

test('the grid lies behind the plane and the title, and lets clicks through', async ({ page }) => {
  await open(page);
  await page.evaluate((p) => (window as unknown as GridWindow).__aslan.store.getState().setProgress(p), await pre(page, 'sky', 0.25));
  await page.waitForTimeout(600);
  const grid = page.getByTestId('grid');
  const style = await grid.evaluate((el) => ({ z: Number(getComputedStyle(el).zIndex), pointer: getComputedStyle(el).pointerEvents }));
  expect(style.z).toBeLessThan(-1);
  expect(style.pointer).toBe('none');
  // an empty band under the plane, clear of the horizontal lines (y = 576, 640)
  const r = await lines(page, { x: 40, y: 590, width: 360, height: 40 });
  console.log('grid lines', JSON.stringify(r));
  expect(r.line.lum - r.gap.lum).toBeGreaterThanOrEqual(4);
});

test('the lines near the cursor glow terracotta', async ({ page }) => {
  await open(page);
  await page.evaluate((p) => (window as unknown as GridWindow).__aslan.store.getState().setProgress(p), await pre(page, 'sky', 0.25));
  await page.mouse.move(300, 610);
  await page.waitForTimeout(250);
  const near = await lines(page, { x: 260, y: 590, width: 80, height: 40 });
  const far = await lines(page, { x: 760, y: 590, width: 80, height: 40 });
  console.log('glow', JSON.stringify({ near, far }));
  expect(near.line.warm).toBeGreaterThanOrEqual(12);
  expect(far.line.warm).toBeLessThanOrEqual(4);
});

test('the glow fades when the pointer leaves', async ({ page }) => {
  await open(page);
  await page.evaluate((p) => (window as unknown as GridWindow).__aslan.store.getState().setProgress(p), await pre(page, 'sky', 0.25));
  await page.mouse.move(300, 610);
  await page.waitForTimeout(250);
  expect((await lines(page, { x: 260, y: 590, width: 80, height: 40 })).line.warm, 'glowing first').toBeGreaterThanOrEqual(12);
  await page.evaluate(() => document.documentElement.dispatchEvent(new PointerEvent('pointerleave', { pointerType: 'mouse' })));
  await page.waitForTimeout(900);
  const near = await lines(page, { x: 260, y: 590, width: 80, height: 40 });
  expect(near.line.warm).toBeLessThanOrEqual(4);
});

test('inside the cabin the grid is gone', async ({ page }) => {
  await open(page);
  await page.evaluate((p) => (window as unknown as GridWindow).__aslan.store.getState().setProgress(p), await pre(page, 'aisle', 0.3));
  await page.waitForTimeout(400);
  expect(await page.getByTestId('grid').evaluate((el) => Number(getComputedStyle(el).opacity))).toBe(0);
  // nor does its trail keep drawing, unseen, as the pointer moves over the seats
  for (let x = 100; x <= 400; x += 20) await page.mouse.move(x, 610);
  await page.waitForTimeout(100);
  const painted = await page.getByTestId('grid-trail').evaluate((el) => {
    const c = el as HTMLCanvasElement;
    const d = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data;
    let n = 0;
    for (let i = 3; i < d.length; i += 4) if (d[i] > 0) n++;
    return n;
  });
  expect(painted).toBe(0);
});

test('with reduced motion the cells leave no trail', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await open(page);
  await page.evaluate((p) => (window as unknown as GridWindow).__aslan.store.getState().setProgress(p), await pre(page, 'sky', 0.25));
  for (let x = 100; x <= 400; x += 20) await page.mouse.move(x, 610);
  await page.waitForTimeout(100);
  const painted = await page.getByTestId('grid-trail').evaluate((el) => {
    const c = el as HTMLCanvasElement;
    const d = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data;
    let n = 0;
    for (let i = 3; i < d.length; i += 4) if (d[i] > 0) n++;
    return n;
  });
  expect(painted).toBe(0);
});

test('the outro panel has its grid', async ({ page }) => {
  await open(page);
  await page.evaluate((p) => {
    const s = (window as unknown as GridWindow).__aslan.store.getState();
    s.setProgress(p);
    s.seats.find((x) => x.id === '14F')!.status = 'free';
    s.sit('14F');
    s.confirm();
    s.setProgress(0.9);
  }, await pre(page, 'aisle', 0.27));
  const outro = page.locator('section', { has: page.getByRole('heading', { name: /have a nice flight/i }) });
  await expect(outro).toBeVisible();
  await expect(outro.getByTestId('grid-surface')).toBeVisible();
});
