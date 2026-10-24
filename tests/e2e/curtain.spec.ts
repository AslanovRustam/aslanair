import { expect, test, type Page } from '@playwright/test';
import { poseOnPreTrack, WINDOW_ON_EXIT } from '@/experience/cameraPoses';
import { pre, progress, waitForStore } from './helpers';

type Vec = { x: number; y: number; z: number; clone(): Vec; project(c: unknown): Vec };
type CurtainWindow = Window & {
  __aslan: {
    camera: { position: Vec };
    gl: { info: { programs: unknown[] | null } };
    scene: { getObjectByName(n: string): { visible: boolean; getWorldPosition(v: Vec): Vec; position: Vec } | undefined };
    store: {
      getState(): {
        phase: string;
        progress: number;
        setProgress(p: number): void;
        seats: { id: string; status: string }[];
        sit(id: string): boolean;
        confirm(): void;
      };
    };
  };
  __frames: { t: number; p: number; curtain: string; plane: boolean; planeY: number | null; cam: [number, number, number] }[];
  __recording: boolean;
};

async function open(page: Page) {
  await page.setViewportSize({ width: 1440, height: 800 });
  await page.goto('/');
  await waitForStore(page);
  await page.waitForFunction(() => document.getElementById('loader')?.dataset.ready === 'true', null, { timeout: 60_000 });
  await page.addStyleTag({ content: 'nextjs-portal { display: none !important; }' });
  await page.waitForTimeout(800);
}

/** Records, every frame: the scroll progress, the curtain's stage, the curtain plane (shown? where on screen?) and the camera. */
const record = (page: Page) =>
  page.evaluate(() => {
    const w = window as unknown as CurtainWindow;
    w.__frames = [];
    w.__recording = true;
    const tick = () => {
      if (!w.__recording) return;
      const { scene, camera, store } = w.__aslan;
      const plane = scene.getObjectByName('CurtainPlane');
      let planeY: number | null = null;
      if (plane?.visible) {
        const p = plane.getWorldPosition(camera.position.clone()).project(camera);
        planeY = (1 - p.y) / 2;
      }
      const c = camera.position;
      w.__frames.push({ t: performance.now(), p: store.getState().progress, curtain: document.documentElement.dataset.curtain ?? '', plane: !!plane?.visible, planeY, cam: [c.x, c.y, c.z] });
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });

const stop = (page: Page) =>
  page.evaluate(() => {
    const w = window as unknown as CurtainWindow;
    w.__recording = false;
    return w.__frames;
  });

const curtainGone = (page: Page) => page.waitForFunction(() => !document.documentElement.dataset.curtain, null, { timeout: 5000 });
const rail = (page: Page) => page.getByRole('navigation', { name: 'Chapters' });

test('a rail click covers the screen, flies the plane across and reveals the chapter', async ({ page }) => {
  await open(page);
  await record(page);
  const clicked = await page.evaluate(() => performance.now());
  await rail(page).getByRole('button', { name: /Transfer/ }).click();
  await expect(page.getByTestId('curtain-label')).toHaveText('03 Transfer');
  await curtainGone(page);
  await page.waitForTimeout(100);
  const frames = await stop(page);
  const first = frames.find((f) => f.curtain);
  expect(first?.curtain).toBe('cover');
  expect(first!.t - clicked).toBeLessThan(300);
  expect(frames.some((f) => f.curtain === 'covered')).toBe(true);
  const flying = frames.filter((f) => f.curtain === 'covered' && f.planeY !== null);
  expect(flying.length, 'the plane is seen across the covered screen').toBeGreaterThan(5);
  expect(flying[flying.length - 1].planeY!, 'top to bottom').toBeGreaterThan(flying[0].planeY! + 0.5);
  expect(frames.filter((f) => f.plane && f.curtain !== 'covered')).toHaveLength(0);
  expect(Math.abs((await progress(page)) - pre('transfer', 0.7))).toBeLessThan(0.002);
});

test('the jump only ever happens under the curtain', async ({ page }) => {
  await open(page);
  await record(page);
  await page.getByRole('banner').getByRole('button', { name: 'Cabin' }).click();
  await page.waitForFunction(() => document.documentElement.dataset.curtain === 'covered');
  await curtainGone(page);
  const frames = await stop(page);
  let jumps = 0;
  for (let i = 1; i < frames.length; i++) {
    if (Math.abs(frames[i].p - frames[i - 1].p) <= 0.005) continue;
    jumps++;
    expect(frames[i].curtain, `frame ${i}: ${frames[i - 1].p.toFixed(3)} → ${frames[i].p.toFixed(3)}`).toBe('covered');
  }
  expect(jumps).toBeGreaterThan(0);
});

test('a second click during the transition is ignored', async ({ page }) => {
  await open(page);
  await rail(page).getByRole('button', { name: /Transfer/ }).click();
  await page.waitForTimeout(100);
  await rail(page).getByRole('button', { name: /Destinations/ }).click({ force: true });
  await page.waitForFunction(() => document.documentElement.dataset.curtain === 'covered');
  await curtainGone(page);
  expect(Math.abs((await progress(page)) - pre('transfer', 0.7))).toBeLessThan(0.002);
});

test('keyboard: focus goes to the chapter heading', async ({ page }) => {
  await open(page);
  await rail(page).getByRole('button', { name: /Destinations/ }).focus();
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => document.documentElement.dataset.curtain === 'covered');
  await curtainGone(page);
  await expect.poll(() => page.evaluate(() => document.activeElement?.getAttribute('data-heading'))).toBe('destinations');
});

test('from the seat, Destinations reveals only on a settled camera', async ({ page }) => {
  await open(page);
  await page.evaluate(() => {
    const s = (window as unknown as CurtainWindow).__aslan.store.getState();
    s.setProgress(__pre('aisle', 0.27));
    s.seats.find((x) => x.id === '14F')!.status = 'free';
    s.sit('14F');
  });
  await page.waitForTimeout(1500);
  await record(page);
  await page.getByRole('banner').getByRole('button', { name: 'Destinations' }).click();
  await page.waitForFunction(() => document.documentElement.dataset.curtain === 'reveal', null, { timeout: 8000 });
  await page.waitForTimeout(100); // the recorder's own frame of it
  const frames = await stop(page);
  const revealing = frames.find((f) => f.curtain === 'reveal')!;
  const target = poseOnPreTrack(pre('destinations', 0.4), 1440 / 800).position;
  const d = Math.hypot(revealing.cam[0] - target.x, revealing.cam[1] - target.y, revealing.cam[2] - target.z);
  expect(d, `camera ${d.toFixed(3)} m from its pose as the curtain lifts`).toBeLessThan(0.05);
});

test('Take off still flies the camera to the window', async ({ page }) => {
  await open(page);
  await page.evaluate(() => {
    const s = (window as unknown as CurtainWindow).__aslan.store.getState();
    s.setProgress(__pre('aisle', 0.27));
    s.seats.find((x) => x.id === '14F')!.status = 'free';
    s.sit('14F');
    s.confirm();
  });
  await page.waitForTimeout(1500);
  await record(page);
  await page.getByRole('button', { name: 'Take off' }).click();
  await expect.poll(() => progress(page), { timeout: 10_000 }).toBeGreaterThan(WINDOW_ON_EXIT - 0.01);
  const frames = await stop(page);
  expect(frames.filter((f) => f.curtain)).toHaveLength(0);
});

test('Start again goes through the curtain to the top', async ({ page }) => {
  await open(page);
  await page.evaluate(() => {
    const s = (window as unknown as CurtainWindow).__aslan.store.getState();
    s.setProgress(__pre('aisle', 0.27));
    s.seats.find((x) => x.id === '14F')!.status = 'free';
    s.sit('14F');
    s.confirm();
    s.setProgress(0.9);
  });
  await page.getByRole('button', { name: 'Start again' }).first().click();
  await page.waitForFunction(() => document.documentElement.dataset.curtain === 'covered');
  await curtainGone(page);
  const s = await page.evaluate(() => {
    const st = (window as unknown as CurtainWindow).__aslan.store.getState();
    return { phase: st.phase, progress: st.progress };
  });
  expect(s.phase).toBe('browse');
  expect(s.progress).toBeLessThan(0.01);
});

test('reduced motion: a short fade, no plane', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await open(page);
  await record(page);
  await rail(page).getByRole('button', { name: /Transfer/ }).click();
  await page.waitForFunction(() => document.documentElement.dataset.curtain === 'covered');
  await curtainGone(page);
  const frames = await stop(page);
  expect(frames.some((f) => f.curtain === 'covered')).toBe(true);
  expect(frames.filter((f) => f.plane)).toHaveLength(0);
});

test('the first curtain compiles no shader', async ({ page }) => {
  await open(page);
  const programs = () => page.evaluate(() => (window as unknown as CurtainWindow).__aslan.gl.info.programs?.length ?? -1);
  const before = await programs();
  await rail(page).getByRole('button', { name: /Destinations/ }).click();
  await page.waitForFunction(() => document.documentElement.dataset.curtain === 'covered');
  await curtainGone(page);
  expect(await programs()).toBe(before);
});
