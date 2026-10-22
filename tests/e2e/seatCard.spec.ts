import { expect, test, type Page } from '@playwright/test';
import { poseOnPreTrack } from '@/experience/cameraPoses';
import { seatCardAnchor } from '@/experience/seatCard';
import { scanForHoveredSeat, settledProgress, waitForStore } from './helpers';

type Store = {
  getState(): { phase: string; hoveredSeatId: string | null; setProgress(p: number): void; seats: { id: string; priceUsd: number }[] };
};
type R3FObject = { __r3f: { root: { getState(): { camera: { updateMatrixWorld(): void } } } } };
type CardWindow = Window & { __aslan: { store: Store; scene: { getObjectByName(n: string): R3FObject } } };

const AISLE = 0.6;

async function walkIntoAisle(page: Page) {
  await page.goto('/');
  await waitForStore(page);
  await page.waitForFunction(() => !!(window as unknown as CardWindow).__aslan.scene?.getObjectByName('SeatHit'));
  await page.evaluate((p) => (window as unknown as CardWindow).__aslan.store.getState().setProgress(p), AISLE);
  await settledProgress(page);
  // the camera eases into its pose after the progress settles (slowly when the GPU is shared): wait until it is there
  const pose = poseOnPreTrack(AISLE).position;
  await expect
    .poll(
      () =>
        page.evaluate(([x, y, z]) => {
          const hit = (window as unknown as CardWindow).__aslan.scene.getObjectByName('SeatHit') as unknown as {
            __r3f: { root: { getState(): { camera: { position: { x: number; y: number; z: number } } } } };
          };
          const p = hit.__r3f.root.getState().camera.position;
          return Math.hypot(p.x - x, p.y - y, p.z - z);
        }, [pose.x, pose.y, pose.z] as const),
      { timeout: 15_000 },
    )
    .toBeLessThan(0.005);
}

/** The seat card's anchor (seat top + 0.28 m) projected to CSS pixels with the scene camera. */
const anchorOnScreen = (page: Page, id: string, point = seatCardAnchor(id)) =>
  page.evaluate((anchor) => {
    const w = window as unknown as CardWindow;
    const hit = w.__aslan.scene.getObjectByName('SeatHit') as unknown as R3FObject & {
      position: { clone(): { set(x: number, y: number, z: number): { project(c: unknown): { x: number; y: number; z: number } } } };
    };
    const { camera } = hit.__r3f.root.getState();
    camera.updateMatrixWorld();
    const p = hit.position.clone().set(...anchor).project(camera);
    return { x: ((p.x + 1) / 2) * innerWidth, y: ((1 - p.y) / 2) * innerHeight, inFront: p.z < 1 };
  }, point);

test('the card floats above the hovered seat and follows it', async ({ page }) => {
  await walkIntoAisle(page);
  const seat = await scanForHoveredSeat(page);
  const card = page.getByTestId('seat-card');
  await expect(card).toBeVisible();
  const price = await page.evaluate((id) => (window as unknown as CardWindow).__aslan.store.getState().seats.find((s) => s.id === id)!.priceUsd, seat.id);
  await expect(card).toContainText(seat.id);
  await expect(card).toContainText(`$${price}`);
  await page.waitForTimeout(300); // let the entrance settle
  const box = (await card.boundingBox())!;
  const anchor = await anchorOnScreen(page, seat.id);
  expect(Math.abs(box.x + box.width / 2 - anchor.x), 'card centred over the seat').toBeLessThanOrEqual(40);
  expect(Math.abs(box.y + box.height - anchor.y), 'card bottom at the anchor').toBeLessThanOrEqual(40);
  expect(box.y + box.height / 2, 'card body above the anchor').toBeLessThan(anchor.y);
  await page.mouse.move(5, 5);
  await expect(card).toBeHidden({ timeout: 400 });
});

test('touch: first tap shows the card, second tap sits', async ({ browser }) => {
  const context = await browser.newContext({ hasTouch: true, viewport: { width: 1440, height: 800 } });
  const page = await context.newPage();
  await walkIntoAisle(page);
  const state = () =>
    page.evaluate(() => {
      const s = (window as unknown as CardWindow).__aslan.store.getState();
      return { phase: s.phase, focused: s.hoveredSeatId };
    });
  // a tap's click reaches the page a moment later (later still under load): count clicks as they bubble up to
  // the window, after R3F's handler on the canvas has run, and wait for each one
  await page.evaluate(() => {
    const w = window as unknown as { __clicks: number };
    w.__clicks = 0;
    window.addEventListener('click', () => w.__clicks++);
  });
  const tap = async (x: number, y: number) => {
    const before = await page.evaluate(() => (window as unknown as { __clicks: number }).__clicks);
    await page.touchscreen.tap(x, y);
    await page.waitForFunction((n) => (window as unknown as { __clicks: number }).__clicks > n, before);
  };
  const free = await page.evaluate(() =>
    (window as unknown as CardWindow).__aslan.store.getState().seats.filter((s) => (s as unknown as { status: string }).status === 'free').map((s) => s.id),
  );
  // tap the headrest covers of free seats near the camera until a tap focuses a seat
  let focused: { id: string; x: number; y: number } | null = null;
  const targets: { x: number; y: number }[] = [];
  for (const id of free) {
    const [x, y, z] = seatCardAnchor(id);
    const p = await anchorOnScreen(page, id, [x, y - 0.4, z]);
    if (p.inFront && p.x > 40 && p.x < 1400 && p.y > 40 && p.y < 680) targets.push(p);
  }
  targets.sort((a, b) => b.y - a.y); // nearest seats sit lowest on screen
  for (const p of targets.slice(0, 12)) {
    await tap(p.x, p.y);
    const s = await state();
    expect(s.phase, 'a first tap never sits').toBe('browse');
    if (s.focused) {
      // a nearer seat may take the tap: what matters is that this point now focuses s.focused
      focused = { id: s.focused, x: p.x, y: p.y };
      break;
    }
  }
  expect(focused, 'some tap focused a seat').not.toBeNull();
  await expect(page.getByTestId('seat-card')).toContainText(focused!.id);
  await expect(page.getByTestId('seat-card')).toContainText('Tap again to sit');
  await tap(focused!.x, focused!.y);
  await expect.poll(async () => (await state()).phase).toBe('seated');
  await context.close();
});
