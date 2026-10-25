import { expect, test, type Page } from '@playwright/test';
import { waitForStore } from './helpers';

type V3 = { x: number; y: number; z: number; clone(): V3; sub(v: V3): V3; applyQuaternion(q: unknown): V3 };
type PassWindow = {
  __aslan: {
    store: { getState(): { setProgress(p: number): void; seats: { id: string; status: string }[]; sit(id: string): boolean; confirmedAt: number | null } };
    scene: { getObjectByName(n: string): { getWorldPosition(v: V3): V3; position: V3 } | undefined };
    camera: { position: V3; quaternion: { clone(): { invert(): unknown } } };
  };
};

/** Sits in 14F and lets the camera settle there. */
async function seated(page: Page) {
  await page.goto('/');
  await waitForStore(page);
  await page.evaluate(() => {
    const s = (window as unknown as PassWindow).__aslan.store.getState();
    s.setProgress(__pre('aisle', 0.27));
    s.seats.find((x) => x.id === '14F')!.status = 'free';
    s.sit('14F');
  });
  await page.waitForTimeout(2500);
}

/** Every frame until `ms` after the lock (t < 0 before it): ms since the lock, the eye's height and the pass's height in the view. */
const record = (page: Page, ms: number) =>
  page.evaluate(
    (ms) =>
      new Promise<{ t: number; eye: number; pass: number | null }[]>((done) => {
        const w = (window as unknown as PassWindow).__aslan;
        const out: { t: number; eye: number; pass: number | null }[] = [];
        const tick = () => {
          const at = w.store.getState().confirmedAt;
          const t = at === null ? -1 : performance.now() - at; // before the click: t < 0
          const holder = w.scene.getObjectByName('BoardingPass');
          const local = holder ? holder.position.clone().sub(w.camera.position).applyQuaternion(w.camera.quaternion.clone().invert()) : null;
          out.push({ t, eye: w.camera.position.y, pass: local ? local.y : null });
          if (t > ms) return done(out);
          requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }),
    ms,
  );

test('choosing the seat: the eye settles into it, then the pass rises into view', async ({ page }) => {
  await seated(page);
  const samples = record(page, 1700);
  await page.getByRole('button', { name: /choose this seat/i }).click();
  const frames = await samples;
  const eyeAt = (from: number, to: number) => frames.filter((f) => f.t >= from && f.t <= to).map((f) => f.eye);
  const rest = frames.filter((f) => f.t < 0).at(-1)!.eye; // the last frame before the lock
  expect(rest - Math.min(...eyeAt(100, 300)), 'the eye dips as the seat locks').toBeGreaterThan(0.02);
  expect(Math.abs(eyeAt(800, 1700).at(-1)! - rest), 'and comes back').toBeLessThan(0.003);
  const passAt = (t: number) => frames.reduce((a, b) => (Math.abs(b.t - t) < Math.abs(a.t - t) ? b : a)).pass!;
  expect(passAt(1600) - passAt(300), 'the pass rises from below').toBeGreaterThan(0.2);
});

type CardWindow = {
  __aslan: {
    store: { getState(): { progress: number } };
    camera: unknown;
    scene: {
      getObjectByName(n: string): {
        rotation: { y: number };
        matrixWorld: unknown;
        position: { constructor: new (x: number, y: number, z: number) => { applyMatrix4(m: unknown): { project(c: unknown): { x: number; y: number } } } };
        geometry: { computeBoundingBox(): void; boundingBox: { min: { x: number }; max: { x: number } } };
      };
    };
  };
};
const turn = (page: Page) => page.evaluate(() => (window as unknown as CardWindow).__aslan.scene.getObjectByName('BoardingPassFlipper').rotation.y);
const progress = (page: Page) => page.evaluate(() => (window as unknown as CardWindow).__aslan.store.getState().progress);

test('dragging the pass turns it over, a tap turns it back, and the page stays put meanwhile', async ({ page }) => {
  await seated(page);
  await page.getByRole('button', { name: /choose this seat/i }).click();
  await page.waitForTimeout(1800); // the lock and the entrance
  // the card on screen: its left and right edges, through its middle
  const card = await page.evaluate(() => {
    const { scene, camera } = (window as unknown as CardWindow).__aslan;
    const front = scene.getObjectByName('BoardingPassFront');
    front.geometry.computeBoundingBox();
    const V = front.position.constructor;
    const { min, max } = front.geometry.boundingBox;
    const [a, b] = [new V(min.x, 0, 0), new V(max.x, 0, 0)].map((p) => p.applyMatrix4(front.matrixWorld).project(camera));
    return { x0: ((a.x + 1) / 2) * innerWidth, x1: ((b.x + 1) / 2) * innerWidth, y: ((1 - a.y) / 2) * innerHeight };
  });
  const width = Math.abs(card.x1 - card.x0);
  const middle = (card.x0 + card.x1) / 2;
  const at = await progress(page);
  await page.mouse.move(middle - 0.3 * width, card.y);
  await page.mouse.down();
  for (let i = 1; i <= 12; i++) {
    await page.mouse.move(middle - 0.3 * width + (i / 12) * 0.6 * width, card.y);
    await page.waitForTimeout(16);
  }
  expect(await turn(page), 'it follows the pointer').toBeGreaterThan(Math.PI / 2);
  await page.mouse.up();
  await page.waitForTimeout(1000);
  expect(Math.abs((await turn(page)) - Math.PI), 'turned over').toBeLessThan(0.05);
  expect(await progress(page), 'the page did not move').toBe(at);
  await page.mouse.click(middle, card.y);
  await page.waitForTimeout(1000);
  const back = (await turn(page)) % (2 * Math.PI);
  expect(Math.min(back, 2 * Math.PI - back), 'a tap turns it back').toBeLessThan(0.05);
});

test('on a phone a finger turns the pass and the page does not scroll; a tap turns it back', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 412, height: 915 }, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  await seated(page);
  await page.getByRole('button', { name: /choose this seat/i }).tap();
  await page.waitForTimeout(1800);
  const card = await page.evaluate(() => {
    const { scene, camera } = (window as unknown as CardWindow).__aslan;
    const front = scene.getObjectByName('BoardingPassFront');
    front.geometry.computeBoundingBox();
    const V = front.position.constructor;
    const { min, max } = front.geometry.boundingBox;
    const [a, b] = [new V(min.x, 0, 0), new V(max.x, 0, 0)].map((p) => p.applyMatrix4(front.matrixWorld).project(camera));
    return { x0: ((a.x + 1) / 2) * innerWidth, x1: ((b.x + 1) / 2) * innerWidth, y: ((1 - a.y) / 2) * innerHeight };
  });
  const width = Math.abs(card.x1 - card.x0);
  const middle = (card.x0 + card.x1) / 2;
  const at = await progress(page);
  const touch = await context.newCDPSession(page);
  const finger = (type: 'touchStart' | 'touchMove' | 'touchEnd', x: number) =>
    touch.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x: Math.round(x), y: Math.round(card.y) }] });
  await finger('touchStart', middle - 0.3 * width);
  for (let i = 1; i <= 12; i++) {
    await finger('touchMove', middle - 0.3 * width + (i / 12) * 0.6 * width);
    await page.waitForTimeout(16);
  }
  await finger('touchEnd', 0);
  await page.waitForTimeout(1000);
  expect(Math.abs((await turn(page)) - Math.PI), 'turned over').toBeLessThan(0.05);
  expect(await progress(page), 'the page did not move').toBe(at);
  await finger('touchStart', middle);
  await finger('touchEnd', 0);
  await page.waitForTimeout(1000);
  const back = (await turn(page)) % (2 * Math.PI);
  expect(Math.min(back, 2 * Math.PI - back), 'a tap turns it back').toBeLessThan(0.05);
  await context.close();
});

test('with reduced motion the eye stays still and the pass fades in where it rests', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await seated(page);
  const samples = record(page, 1300);
  await page.getByRole('button', { name: /choose this seat/i }).click();
  const frames = await samples;
  const eyes = frames.map((f) => f.eye);
  expect(Math.max(...eyes) - Math.min(...eyes), 'no dip').toBeLessThan(0.002);
  const passes = frames.filter((f) => f.t > 600).map((f) => f.pass!);
  expect(Math.max(...passes) - Math.min(...passes), 'no rise').toBeLessThan(0.002);
});
