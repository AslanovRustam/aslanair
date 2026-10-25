import { expect, test, type Page } from '@playwright/test';
import { loaderGone, waitForStore } from './helpers';

type PhoneWindow = {
  __aslan: { store: { getState(): { quality: string; phase: string; selectedSeatId: string | null; setProgress(p: number): void } } };
};
const store = (page: Page) => page.evaluate(() => {
  const s = (window as unknown as PhoneWindow).__aslan.store.getState();
  return { quality: s.quality, phase: s.phase, seat: s.selectedSeatId };
});

async function intoTheAisle(page: Page) {
  await page.goto('/');
  await waitForStore(page);
  await loaderGone(page);
  await page.evaluate(() => (window as unknown as PhoneWindow).__aslan.store.getState().setProgress(__pre('aisle', 0.27)));
  await page.waitForTimeout(1500);
}

/**
 * Taps across the cabin, above the bottom bar, until a seat's card shows; checks the card is wholly on screen; taps
 * the same seat again to sit. Returns the seat — and every card's box it saw on the way.
 */
async function tapScanForSeat(page: Page): Promise<{ id: string; cards: { x: number; y: number; width: number; height: number }[] }> {
  const { width, height } = page.viewportSize()!;
  const cards: { x: number; y: number; width: number; height: number }[] = [];
  for (let y = Math.round(height * 0.4); y < height - 200; y += 40) {
    for (let x = 30; x < width - 30; x += 44) {
      await page.touchscreen.tap(x, y);
      await page.waitForTimeout(120);
      const card = page.getByTestId('seat-card');
      if (!(await card.isVisible())) continue;
      cards.push((await card.boundingBox())!);
      await page.touchscreen.tap(x, y); // the second tap sits
      await page.waitForTimeout(300);
      const s = await store(page);
      if (s.phase === 'seated') return { id: s.seat!, cards };
    }
  }
  throw new Error('no seat found by tapping');
}

test('phone: the low tier; a first tap shows a seat card on screen, the second sits; nothing overflows', async ({ page }) => {
  await intoTheAisle(page);
  expect((await store(page)).quality).toBe('low');
  await expect(page.getByRole('button', { name: 'Menu' })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Sound (on|off)$/ })).toBeVisible();
  const { id, cards } = await tapScanForSeat(page);
  expect(id).toMatch(/^\d+[A-F]$/);
  const { width, height } = page.viewportSize()!;
  for (const c of cards) {
    expect(c.x, 'card inside the left edge').toBeGreaterThanOrEqual(0);
    expect(c.x + c.width, 'card inside the right edge').toBeLessThanOrEqual(width);
    expect(c.y, 'card below the top').toBeGreaterThanOrEqual(0);
  }
  for (const sel of ['main', 'body']) expect(await page.evaluate((s) => document.querySelector(s)!.scrollWidth <= innerWidth, sel), sel).toBe(true);
  const bar = (await page.getByRole('button', { name: 'Choose this seat' }).boundingBox())!;
  expect(bar.y + bar.height).toBeLessThanOrEqual(height);
});

test('phone: the menu keeps the focus while open, says so, and gives it back', async ({ page }) => {
  await page.goto('/');
  await waitForStore(page);
  const menu = page.getByRole('button', { name: 'Menu' });
  await expect(menu).toHaveAttribute('aria-expanded', 'false');
  await menu.click();
  await expect(menu).toHaveAttribute('aria-expanded', 'true');
  const sheet = page.getByRole('dialog', { name: 'Menu' });
  await expect(sheet.getByRole('button', { name: 'Close' })).toBeFocused();
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press('Tab');
    expect(await sheet.evaluate((el) => el.contains(document.activeElement)), `tab ${i + 1} stays in the menu`).toBe(true);
  }
  await page.keyboard.press('Shift+Tab');
  expect(await sheet.evaluate((el) => el.contains(document.activeElement)), 'shift-tab stays too').toBe(true);
  await page.keyboard.press('Escape');
  await expect(sheet).toHaveCount(0);
  await expect(menu).toBeFocused();
  await expect(menu).toHaveAttribute('aria-expanded', 'false');
});

test('phone: the boarding pass is wholly in view, and the aisle speaks of taps', async ({ page }) => {
  await intoTheAisle(page);
  await expect(page.getByText(/tap a seat/i)).toBeVisible();
  await page.evaluate(() => {
    const s = (window as unknown as { __aslan: { store: { getState(): { seats: { id: string; status: string }[]; sit(id: string): boolean } } } }).__aslan.store.getState();
    s.seats.find((x) => x.id === '14F')!.status = 'free';
    s.sit('14F');
  });
  await page.waitForTimeout(1500);
  await page.getByRole('button', { name: /choose this seat/i }).tap();
  await page.waitForTimeout(2000);
  const box = await page.evaluate(() => {
    type O = { matrixWorld: unknown; position: { constructor: new (x: number, y: number, z: number) => { applyMatrix4(m: unknown): { project(c: unknown): { x: number; y: number } } } }; geometry: { computeBoundingBox(): void; boundingBox: { min: { x: number; y: number }; max: { x: number; y: number } } } };
    const w = (window as unknown as { __aslan: { scene: { getObjectByName(n: string): O }; camera: unknown } }).__aslan;
    const front = w.scene.getObjectByName('BoardingPassFront');
    front.geometry.computeBoundingBox();
    const { min, max } = front.geometry.boundingBox;
    const V = front.position.constructor;
    const ps = [new V(min.x, min.y, 0), new V(max.x, max.y, 0)].map((p) => p.applyMatrix4(front.matrixWorld).project(w.camera));
    return { x0: Math.min(ps[0].x, ps[1].x), x1: Math.max(ps[0].x, ps[1].x), y0: Math.min(ps[0].y, ps[1].y), y1: Math.max(ps[0].y, ps[1].y) };
  });
  expect(box.x0, 'left edge in view').toBeGreaterThanOrEqual(-1);
  expect(box.x1, 'right edge in view').toBeLessThanOrEqual(1);
  expect(box.y0).toBeGreaterThanOrEqual(-1);
  expect(box.y1).toBeLessThanOrEqual(1);
});

test('the page has one main landmark holding the journey', async ({ page }) => {
  await page.goto('/');
  await waitForStore(page);
  await expect(page.getByRole('main')).toHaveCount(1);
  await expect(page.getByRole('main').getByRole('heading', { name: 'Night flight' })).toHaveCount(1);
});
