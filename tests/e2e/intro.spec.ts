import { expect, test, type Page } from '@playwright/test';
import { trackProgress } from '@/experience/chapters';
import { heroScale, HERO_PICTURE, INTRO } from '@/experience/introState';
import { waitForStore } from './helpers';

type Node = { visible: boolean; layers: { mask: number } };
type IntroWindow = Window & {
  __aslan: { scene?: { getObjectByName(n: string): Node | undefined }; store: { getState(): { setProgress(p: number): void } } };
};

const isReady = (page: Page) =>
  page.waitForFunction(() => document.getElementById('loader')?.dataset.ready === 'true', null, { timeout: 60_000 });

async function showAt(page: Page, progress: number) {
  await page.evaluate((p) => (window as unknown as IntroWindow).__aslan.store.getState().setProgress(p), progress);
  await page.waitForTimeout(700);
}

/** Where the loader's picture puts the plane at the top of the page — the picture full frame height × heroScale,
 * centred, lifted by HERO_PICTURE.lift — and where the live camera must put it too. */
function heroPlaneBox(page: Page) {
  const { width: vw, height: vh } = page.viewportSize()!;
  const h = vh * heroScale(vw / vh);
  const w = (h * INTRO.picture.width) / INTRO.picture.height;
  const left = (vw - w) / 2;
  const top = vh / 2 - HERO_PICTURE.lift * vh - h / 2;
  const { plane } = INTRO.picture;
  return {
    x: Math.max(0, Math.floor(left + plane.left * w)),
    y: Math.floor(top + plane.top * h),
    width: Math.ceil((plane.right - plane.left) * w),
    height: Math.ceil((plane.bottom - plane.top) * h),
  };
}

/** Mean per-channel difference of two same-size screenshots, and the share of lit pixels in each. */
function compare(page: Page, a: Buffer, b: Buffer) {
  return page.evaluate(
    async ([a64, b64]) => {
      const pixels = async (src: string) => {
        const img = new Image();
        img.src = `data:image/png;base64,${src}`;
        await img.decode();
        const c = document.createElement('canvas');
        c.width = img.width;
        c.height = img.height;
        const ctx = c.getContext('2d')!;
        ctx.drawImage(img, 0, 0);
        return ctx.getImageData(0, 0, c.width, c.height).data;
      };
      const [da, db] = await Promise.all([pixels(a64), pixels(b64)]);
      const lit = (d: Uint8ClampedArray, i: number) => 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2] > 40;
      let diff = 0, litA = 0, litB = 0;
      for (let i = 0; i < da.length; i += 4) {
        diff += Math.abs(da[i] - db[i]) + Math.abs(da[i + 1] - db[i + 1]) + Math.abs(da[i + 2] - db[i + 2]);
        if (lit(da, i)) litA++;
        if (lit(db, i)) litB++;
      }
      const n = da.length / 4;
      return { mean: diff / (n * 3), litBefore: litA / n, litAfter: litB / n };
    },
    [a.toString('base64'), b.toString('base64')] as const,
  );
}

/** The plane's silhouette box in a screen area (pixels brighter than the showcase dark). */
async function litBox(page: Page, area: { x: number; y: number; width: number; height: number }) {
  const png = (await page.screenshot({ clip: area })).toString('base64');
  return page.evaluate(async (src) => {
    const img = new Image();
    img.src = `data:image/png;base64,${src}`;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = img.width;
    c.height = img.height;
    const ctx = c.getContext('2d')!;
    ctx.drawImage(img, 0, 0);
    const d = ctx.getImageData(0, 0, c.width, c.height).data;
    let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1;
    for (let y = 0; y < c.height; y++)
      for (let x = 0; x < c.width; x++) {
        const i = (y * c.width + x) * 4;
        // just above the showcase dark (≈ 8): the navy fin counts as plane too
        if (0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2] > 16) {
          x0 = Math.min(x0, x);
          x1 = Math.max(x1, x);
          y0 = Math.min(y0, y);
          y1 = Math.max(y1, y);
        }
      }
    return { x0, y0, x1, y1 };
  }, png);
}

for (const viewport of [
  { width: 1440, height: 800 },
  { width: 2100, height: 900 },
  { width: 412, height: 915 },
]) {
  test(`the loader hands its picture to the live plane without a jump at ${viewport.width}×${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    let release!: () => void;
    const held = new Promise<void>((r) => (release = r));
    await page.route('**/models/*.glb', async (route) => {
      await held;
      await route.continue();
    });
    await page.goto('/');
    await page.addStyleTag({ content: 'nextjs-portal { display: none !important; }' });
    await page.waitForTimeout(1800); // the picture fades in
    const box = heroPlaneBox(page);
    const picture = await page.screenshot({ clip: box });
    release();
    await isReady(page);
    await page.waitForTimeout(1200); // the loader's fade
    // compare the plane alone: the hero's words sit behind it once the loader has gone
    await page.addStyleTag({ content: '[data-testid="hero"] { visibility: hidden !important; }' });
    await page.waitForTimeout(100);
    const live = await page.screenshot({ clip: box });
    const r = await compare(page, picture, live);
    expect(r.litBefore, 'the picture shows the plane').toBeGreaterThan(0.12);
    expect(r.litAfter, 'the live plane is there').toBeGreaterThan(0.12);
    expect(r.mean, `mean difference ${r.mean.toFixed(2)}`).toBeLessThanOrEqual(10);
  });
}

test('at the top the live plane is in the scene; there is no stand-in picture any more', async ({ page }) => {
  await page.goto('/');
  await waitForStore(page);
  await isReady(page);
  expect(await page.evaluate(() => (window as unknown as IntroWindow).__aslan.scene!.getObjectByName('Aircraft')!.visible)).toBe(true);
  await expect(page.getByTestId('intro-plane')).toHaveCount(0);
});

test('resizing at the top keeps the live plane where the picture puts it', async ({ page }) => {
  await page.goto('/');
  await waitForStore(page);
  await isReady(page);
  await page.addStyleTag({ content: 'nextjs-portal, [data-testid="hero"] { display: none !important; }' });
  await page.setViewportSize({ width: 1180, height: 860 });
  // framing, not lights: the blinking beacon's halo would come and go above the hull
  await page.evaluate(() => {
    (window as unknown as IntroWindow).__aslan.scene!.getObjectByName('NightLights')!.visible = false;
  });
  await page.waitForTimeout(800);
  const expected = heroPlaneBox(page);
  const pad = 60;
  const area = { x: Math.max(0, expected.x - pad), y: Math.max(0, expected.y - pad), width: expected.width + 2 * pad, height: expected.height + 2 * pad };
  const found = await litBox(page, area);
  const tol = 0.02 * 860;
  expect(Math.abs(area.x + found.x0 - expected.x), 'left').toBeLessThan(tol);
  expect(Math.abs(area.y + found.y0 - expected.y), 'top').toBeLessThan(tol);
  expect(Math.abs(area.x + found.x1 - (expected.x + expected.width)), 'right').toBeLessThan(tol);
  expect(Math.abs(area.y + found.y1 - (expected.y + expected.height)), 'bottom').toBeLessThan(tol);
});

test('scrolling the first screen compiles and uploads nothing, and never stalls a frame', async ({ page }) => {
  await page.goto('/');
  await waitForStore(page);
  await isReady(page);
  await page.waitForTimeout(1000);
  type Gl = { info: { programs: unknown[] | null; memory: { geometries: number; textures: number } } };
  const r = await page.evaluate(async (end) => {
    const w = window as unknown as { __aslan: { gl: Gl; store: { getState(): { setProgress(p: number): void } } } };
    const gpu = () => ({
      programs: w.__aslan.gl.info.programs!.length,
      geometries: w.__aslan.gl.info.memory.geometries,
      textures: w.__aslan.gl.info.memory.textures,
    });
    const before = gpu();
    let worst = 0;
    let last = performance.now();
    await new Promise<void>((done) => {
      let n = 0;
      const tick = (t: number) => {
        if (n > 0) worst = Math.max(worst, t - last);
        last = t;
        w.__aslan.store.getState().setProgress((end * n) / 60);
        if (++n <= 60) requestAnimationFrame(tick);
        else done();
      };
      requestAnimationFrame(tick);
    });
    return { before, after: gpu(), worst };
  }, trackProgress('pre', 'sky', 1));
  expect(r.after, 'nothing new compiled or uploaded').toEqual(r.before);
  expect(r.worst, `worst frame ${r.worst.toFixed(0)} ms`).toBeLessThan(250);
});

test('at rest the shadow map is not redrawn every frame; the door moving redraws it', async ({ page }) => {
  await page.goto('/');
  await waitForStore(page);
  await isReady(page);
  await showAt(page, trackProgress('pre', 'sky', 0.9));
  /** Over `frames` frames after optionally moving to `progress`: whether the map updates by itself, and how often
   * something asked for a redraw (needsUpdate is raised in the frame callbacks and cleared by the render). */
  const watch = (progress: number | null, frames: number) =>
    page.evaluate(
      ([progress, frames]) =>
        new Promise<{ auto: boolean; asked: number }>((done) => {
          type Map = { autoUpdate: boolean; needsUpdate: boolean };
          const w = window as unknown as { __aslan: { gl: { shadowMap: Map }; store: { getState(): { setProgress(p: number): void } } } };
          const map = w.__aslan.gl.shadowMap;
          let value = map.needsUpdate;
          let asked = 0;
          Object.defineProperty(map, 'needsUpdate', {
            configurable: true,
            get: () => value,
            set: (v: boolean) => {
              if (v) asked++;
              value = v;
            },
          });
          if (progress !== null) w.__aslan.store.getState().setProgress(progress);
          let n = 0;
          const tick = () => {
            if (++n < frames) return requestAnimationFrame(tick);
            delete (map as Partial<Map>).needsUpdate; // back to a plain property
            map.needsUpdate = value;
            done({ auto: map.autoUpdate, asked });
          };
          requestAnimationFrame(tick);
        }),
      [progress, frames] as const,
    );
  expect(await watch(null, 30)).toEqual({ auto: false, asked: 0 });
  // the door sliding open is a moving caster
  expect((await watch(trackProgress('pre', 'door', 0.45), 20)).asked).toBeGreaterThan(0);
});

test('at the top the plane flies in front of the title, which stays behind it', async ({ page }) => {
  await page.goto('/');
  await waitForStore(page);
  await isReady(page);
  await page.addStyleTag({ content: 'nextjs-portal { display: none !important; }' });
  await page.evaluate(() => {
    (window as unknown as IntroWindow).__aslan.scene!.getObjectByName('NightLights')!.visible = false;
  });
  await page.waitForTimeout(2200); // the hero's entrance
  const box = heroPlaneBox(page);
  // the plane alone, then with the title shown: wherever the plane is, the title must not change a pixel
  const title = page.locator('[data-testid="hero"] h1');
  await title.evaluate((el) => (el.style.visibility = 'hidden'));
  const alone = await page.screenshot({ clip: box });
  await title.evaluate((el) => (el.style.visibility = ''));
  const withTitle = await page.screenshot({ clip: box });
  const r = await page.evaluate(
    async ([a64, b64]) => {
      const pixels = async (src: string) => {
        const img = new Image();
        img.src = `data:image/png;base64,${src}`;
        await img.decode();
        const c = document.createElement('canvas');
        c.width = img.width;
        c.height = img.height;
        const ctx = c.getContext('2d')!;
        ctx.drawImage(img, 0, 0);
        return ctx.getImageData(0, 0, c.width, c.height).data;
      };
      const [a, b] = await Promise.all([pixels(a64), pixels(b64)]);
      let plane = 0, changed = 0, titleShows = 0;
      for (let i = 0; i < a.length; i += 4) {
        const lum = 0.2126 * a[i] + 0.7152 * a[i + 1] + 0.0722 * a[i + 2];
        const diff = Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]);
        if (lum > 30) {
          plane++;
          if (diff > 24) changed++;
        } else if (diff > 24) titleShows++;
      }
      return { plane, changed, titleShows };
    },
    [alone.toString('base64'), withTitle.toString('base64')] as const,
  );
  expect(r.plane, 'plane pixels in the box').toBeGreaterThan(500);
  expect(r.titleShows, 'the title is there, around the plane').toBeGreaterThan(200);
  expect(r.changed / r.plane, 'the title never shows through the plane').toBeLessThan(0.01);
});
