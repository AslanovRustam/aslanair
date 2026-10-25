import { expect, test, type Page } from '@playwright/test';
import { poseOnPreTrack, WINDOW_ON_EXIT } from '@/experience/cameraPoses';
import { loaderGone, pre, progress, waitForStore } from './helpers';

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
  /** When the page saw the last click (its event time, the performance clock). */
  __clickedAt?: number;
};

async function open(page: Page) {
  await page.setViewportSize({ width: 1440, height: 800 });
  await page.goto('/');
  await waitForStore(page);
  await loaderGone(page); // the page is the visitor's once the loader has handed over
  await page.addStyleTag({ content: 'nextjs-portal { display: none !important; }' });
  await page.waitForTimeout(300);
}

/** Records, every frame: the scroll progress, the curtain's stage, the curtain plane (shown? where on screen?) and the camera. */
const record = (page: Page) =>
  page.evaluate(() => {
    const w = window as unknown as CurtainWindow;
    w.__frames = [];
    w.__recording = true;
    document.addEventListener('click', (e) => (w.__clickedAt = e.timeStamp), { capture: true, once: true });
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
  await rail(page).getByRole('button', { name: /Transfer/ }).click();
  await expect(page.getByTestId('curtain-label')).toHaveText('03 Transfer');
  // the label shows from the click; the stage reaches <html> on the curtain's first frame
  await page.waitForFunction(() => !!document.documentElement.dataset.curtain);
  await curtainGone(page);
  await page.waitForTimeout(100);
  const frames = await stop(page);
  const first = frames.find((f) => f.curtain);
  console.log('stages', [...new Set(frames.map((f) => f.curtain))].join(','), frames.length);
  expect(first?.curtain).toBe('cover');
  // from the click as the page saw it (Playwright's own checks before clicking are not the site's delay)
  const clicked = await page.evaluate(() => (window as unknown as CurtainWindow).__clickedAt!);
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

/** Mean luminance of a screen box (0–255). */
async function meanLuminance(page: Page, box: { x: number; y: number; width: number; height: number }) {
  const png = (await page.screenshot({ clip: box })).toString('base64');
  return page.evaluate(async (b64) => {
    const img = new Image();
    img.src = `data:image/png;base64,${b64}`;
    await img.decode();
    const c = document.createElement('canvas');
    [c.width, c.height] = [img.width, img.height];
    const ctx = c.getContext('2d')!;
    ctx.drawImage(img, 0, 0);
    const d = ctx.getImageData(0, 0, c.width, c.height).data;
    let sum = 0;
    for (let i = 0; i < d.length; i += 4) sum += 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
    return sum / (d.length / 4);
  }, png);
}

test('a chapter reached under the curtain is lit as when scrolled to: the hull still shades the cabin', async ({ page }) => {
  // the aisle carpet: the moon reaches it only through an empty shadow map (about +10 there)
  const cabin = { x: 650, y: 600, width: 140, height: 140 };
  await open(page);
  await page.getByRole('banner').getByRole('button', { name: 'Choose your seat' }).click();
  await page.waitForFunction(() => document.documentElement.dataset.curtain === 'covered');
  await curtainGone(page);
  await page.waitForTimeout(1500);
  const landed = await progress(page);
  const viaCurtain = await meanLuminance(page, cabin);
  await open(page);
  await page.evaluate((p) => (window as unknown as CurtainWindow).__aslan.store.getState().setProgress(p), landed);
  await page.waitForTimeout(2500);
  const viaScroll = await meanLuminance(page, cabin);
  console.log('cabin luminance', { viaCurtain, viaScroll });
  expect(Math.abs(viaCurtain - viaScroll)).toBeLessThan(3);
});

test('scrolling stays held through the whole curtain, even when the jump changes track', async ({ page }) => {
  await open(page);
  await page.evaluate(() => {
    const s = (window as unknown as CurtainWindow).__aslan.store.getState();
    s.setProgress(__pre('aisle', 0.27));
    s.seats.find((x) => x.id === '14F')!.status = 'free';
    s.sit('14F');
    s.confirm();
    s.setProgress(0.07);
  });
  await page.waitForTimeout(1000);
  await page.getByRole('button', { name: 'Change seat' }).first().click();
  await page.waitForFunction(() => document.documentElement.dataset.curtain === 'reveal', null, { timeout: 5000 });
  const landed = await progress(page);
  // where the page stands the moment the curtain lets go (a wheel after that may scroll, and should)
  await page.evaluate(() => {
    const w = window as unknown as CurtainWindow & { __atEnd?: number };
    const observer = new MutationObserver(() => {
      if (document.documentElement.dataset.curtain) return;
      w.__atEnd = w.__aslan.store.getState().progress;
      observer.disconnect();
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-curtain'] });
  });
  await page.mouse.move(720, 400);
  // the visitor keeps scrolling while the chapter is revealed
  while (await page.evaluate(() => !!document.documentElement.dataset.curtain)) {
    await page.mouse.wheel(0, 300);
    await page.waitForTimeout(60);
  }
  const atEnd = await page.evaluate(() => (window as unknown as { __atEnd?: number }).__atEnd);
  expect(atEnd, 'the curtain ended').toBeDefined();
  expect(Math.abs(atEnd! - landed), 'the page moved under the curtain').toBeLessThan(0.002);
});

// Headless Chromium draws no scrollbar, so no layout shift can show here; this holds the CSS that leaves the page no
// scrollbar to lose when Lenis stops it (checked headed: the canvas stays 1440 px wide through a curtain).
test('the page has no scrollbar to lose while the curtain stops it', async ({ page }) => {
  await open(page);
  const root = () => page.evaluate(() => getComputedStyle(document.documentElement).scrollbarWidth);
  expect(await root()).toBe('none');
  await rail(page).getByRole('button', { name: /Transfer/ }).click();
  await page.waitForFunction(() => document.documentElement.dataset.curtain === 'covered');
  expect(await root()).toBe('none');
});

test('in the aisle, Choose your seat leads where the visitor already is: no curtain', async ({ page }) => {
  await open(page);
  await page.evaluate(() => (window as unknown as CurtainWindow).__aslan.store.getState().setProgress(__pre('aisle', 0.4)));
  await page.waitForTimeout(1200);
  await record(page);
  await page.getByRole('banner').getByRole('button', { name: 'Choose your seat' }).click();
  await page.waitForTimeout(1500);
  const frames = await stop(page);
  expect(frames.filter((f) => f.curtain)).toHaveLength(0);
});

test('while the curtain runs, the frame waits: a header link clicked under it does nothing', async ({ page }) => {
  await open(page);
  await rail(page).getByRole('button', { name: /Transfer/ }).click();
  await page.waitForFunction(() => document.documentElement.dataset.curtain === 'covered');
  await page.getByRole('banner').getByRole('button', { name: 'Destinations' }).click();
  await curtainGone(page);
  await page.waitForTimeout(400);
  expect(Math.abs((await progress(page)) - pre('transfer', 0.7)), 'still where the first jump landed').toBeLessThan(0.002);
  expect(await page.evaluate(() => getComputedStyle(document.querySelector('.stage')!).pointerEvents)).not.toBe('none');
});

test('under the curtain the 3D scene takes no pointer', async ({ page }) => {
  await open(page);
  await rail(page).getByRole('button', { name: /Transfer/ }).click();
  await page.waitForFunction(() => document.documentElement.dataset.curtain === 'covered');
  expect(await page.evaluate(() => getComputedStyle(document.querySelector('.stage')!).pointerEvents)).toBe('none');
});
