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
