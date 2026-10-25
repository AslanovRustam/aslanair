import { expect, test, type Page } from '@playwright/test';
import { loaderGone, pre, waitForStore } from './helpers';

type V3 = { x: number; y: number; z: number; distanceTo(v: V3): number; clone(): V3 };
type ReducedWindow = {
  __aslan: {
    store: {
      getState(): {
        setProgress(p: number): void;
        seats: { id: string; status: string }[];
        sit(id: string): boolean;
        pickDestination(code: string, now: number): boolean;
      };
    };
    camera: { position: V3 };
    scene: { getObjectByName(n: string): { quaternion: { angleTo(q: unknown): number; clone(): unknown } } };
  };
};

async function reduced(page: Page) {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await waitForStore(page);
  await loaderGone(page);
}

/** Runs `act` in the page, then records each frame for `ms`: how far the camera moved since the last frame, and the
 * veil's opacity. */
const watch = (page: Page, ms: number, act: string, arg: number | string) =>
  page.evaluate(
    ([ms, act, arg]) =>
      new Promise<{ moved: number; veil: number }[]>((done) => {
        const w = (window as unknown as ReducedWindow).__aslan;
        const veil = document.querySelector('[data-veil]')!;
        const out: { moved: number; veil: number }[] = [];
        let last = w.camera.position.clone();
        const s = w.store.getState();
        if (act === 'progress') s.setProgress(arg as number);
        if (act === 'sit') {
          s.seats.find((x) => x.id === arg)!.status = 'free';
          s.sit(arg as string);
        }
        const t0 = performance.now();
        const tick = () => {
          out.push({ moved: w.camera.position.distanceTo(last), veil: Number(getComputedStyle(veil).opacity) });
          last = w.camera.position.clone();
          if (performance.now() - t0 < ms) requestAnimationFrame(tick);
          else done(out);
        };
        requestAnimationFrame(tick);
      }),
    [ms, act, arg] as const,
  );

test('reduced motion: from the sky into the door chapter the camera never flies — it cuts under the veil', async ({ page }) => {
  await reduced(page);
  const frames = [];
  // through the journey's keys, a few steps of the scroll at a time
  for (const p of [pre('sky', 0.7), pre('destinations', 0.95), pre('ready', 0.6), pre('door', 0.7)]) frames.push(...(await watch(page, 900, 'progress', p)));
  expect(Math.max(...frames.map((f) => f.veil)), 'the veil comes').toBeGreaterThan(0.5);
  const seen = frames.filter((f) => f.veil < 0.5).map((f) => f.moved);
  expect(Math.max(...seen), 'no camera move while the scene shows').toBeLessThan(0.3);
});

test('reduced motion: sitting down cuts to the seat under the veil, no glide', async ({ page }) => {
  await reduced(page);
  await watch(page, 900, 'progress', pre('aisle', 0.27));
  const frames = await watch(page, 1200, 'sit', '14F');
  expect(Math.max(...frames.map((f) => f.veil))).toBeGreaterThan(0.5);
  expect(Math.max(...frames.filter((f) => f.veil < 0.5).map((f) => f.moved))).toBeLessThan(0.05);
});

test('reduced motion: a pick on the globe turns it at once and puts the plane at the city, no flight', async ({ page }) => {
  await reduced(page);
  await watch(page, 900, 'progress', pre('destinations', 0.5));
  const before = await page.evaluate(() => (window as unknown as ReducedWindow).__aslan.scene.getObjectByName('Globe').quaternion.clone());
  await page.evaluate(() => (window as unknown as ReducedWindow).__aslan.store.getState().pickDestination('HND', performance.now() / 1000));
  await page.waitForTimeout(120); // a few frames, far short of the 1.6 s flight
  const moved = await page.evaluate((b) => (window as unknown as ReducedWindow).__aslan.scene.getObjectByName('Globe').quaternion.angleTo(b), before);
  await page.waitForTimeout(1600);
  const after = await page.evaluate((b) => (window as unknown as ReducedWindow).__aslan.scene.getObjectByName('Globe').quaternion.angleTo(b), before);
  expect(after, 'the globe turned').toBeGreaterThan(0.2);
  expect(Math.abs(moved - after), 'and did so at once').toBeLessThan(0.01);
});
