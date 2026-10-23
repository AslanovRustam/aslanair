import { expect, test, type Page } from '@playwright/test';
import { trackProgress } from '@/experience/chapters';
import { INTRO } from '@/experience/introState';
import { waitForStore } from './helpers';

type Node = { visible: boolean; layers: { mask: number } };
type IntroWindow = Window & {
  __aslan: { scene?: { getObjectByName(n: string): Node | undefined }; store: { getState(): { setProgress(p: number): void } } };
};

const sky = (t: number) => trackProgress('pre', 'sky', t);
/** The picture alone, all but landed: the 3D plane is still hidden. */
const BEFORE = sky(INTRO.swapAt - INTRO.crossfade - 0.01);
/** The 3D plane alone: the picture has faded out and the camera still holds the capture pose. */
const AFTER = sky(INTRO.swapAt + INTRO.crossfade);

async function ready(page: Page) {
  await page.goto('/');
  await waitForStore(page);
  // the cabin seen through the windows compiles off-thread: wait until it shows, as the capture did
  await page.waitForFunction(() => {
    const seats = (window as unknown as IntroWindow).__aslan.scene?.getObjectByName('SeatFabric');
    return !!seats && seats.layers.mask === 1;
  });
}

async function showAt(page: Page, progress: number) {
  await page.evaluate((p) => (window as unknown as IntroWindow).__aslan.store.getState().setProgress(p), progress);
  await page.waitForTimeout(700);
}

/** Where the plane lies on screen at the swap: the picture is full height and centred, like the 3D frame. */
function planeBox(page: Page) {
  const { width: vw, height: vh } = page.viewportSize()!;
  const w = (vh * INTRO.picture.width) / INTRO.picture.height;
  const left = (vw - w) / 2;
  const { plane } = INTRO.picture;
  const x0 = Math.max(0, Math.floor(left + plane.left * w));
  const x1 = Math.min(vw, Math.ceil(left + plane.right * w));
  const y0 = Math.floor(plane.top * vh);
  const y1 = Math.ceil(plane.bottom * vh);
  return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
}

/** Mean per-channel difference of two same-size screenshots, and the share of lit pixels in each. */
function compare(page: Page, a: Buffer, b: Buffer) {
  return page.evaluate(
    async ([a64, b64]) => {
      const pixels = async (b64: string) => {
        const img = new Image();
        img.src = `data:image/png;base64,${b64}`;
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

async function expectSeamlessSwap(page: Page) {
  const box = planeBox(page);
  await showAt(page, BEFORE);
  expect(await page.evaluate(() => (window as unknown as IntroWindow).__aslan.scene!.getObjectByName('Aircraft')!.visible)).toBe(false);
  const before = await page.screenshot({ clip: box });
  await showAt(page, AFTER);
  await expect(page.getByTestId('intro-plane')).toBeHidden();
  const after = await page.screenshot({ clip: box });
  const r = await compare(page, before, after);
  // both frames really show the plane, and it does not jump
  expect(r.litBefore, 'picture shows the plane').toBeGreaterThan(0.12);
  expect(r.litAfter, '3D shows the plane').toBeGreaterThan(0.12);
  expect(r.mean, `mean difference ${r.mean.toFixed(2)}`).toBeLessThanOrEqual(10);
}

test('at the top the picture shows, small and high, and the 3D plane is hidden', async ({ page }) => {
  await ready(page);
  const picture = page.getByTestId('intro-plane');
  await expect(picture).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as IntroWindow).__aslan.scene!.getObjectByName('Aircraft')!.visible)).toBe(false);
  const img = (await picture.locator('img').boundingBox())!;
  const { height } = page.viewportSize()!;
  expect(img.height / height).toBeCloseTo(INTRO.heroScale, 2);
  expect(img.y + img.height / 2).toBeLessThan(height / 2 - 0.1 * height);
});

for (const viewport of [
  { width: 1440, height: 800 },
  { width: 2100, height: 900 },
  { width: 412, height: 915 },
]) {
  test(`the picture hands over to the 3D plane without a jump at ${viewport.width}×${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await ready(page);
    await expectSeamlessSwap(page);
  });
}

test('the 3D plane takes over without compiling or uploading anything, and without a stalled frame', async ({ page }) => {
  await ready(page);
  await page.waitForFunction(() => document.getElementById('loader')?.dataset.ready === 'true');
  await showAt(page, BEFORE);
  type Gl = { info: { programs: unknown[] | null; memory: { geometries: number; textures: number } } };
  const r = await page.evaluate(async (after) => {
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
        if (n++ === 0) w.__aslan.store.getState().setProgress(after);
        if (n < 30) requestAnimationFrame(tick);
        else done();
      };
      requestAnimationFrame(tick);
    });
    return { before, after: gpu(), worst };
  }, AFTER);
  expect(r.after, 'nothing new compiled or uploaded at the swap').toEqual(r.before);
  expect(r.worst, `worst frame ${r.worst.toFixed(0)} ms`).toBeLessThan(250);
});

test('at rest the shadow map is not redrawn every frame; the door moving redraws it', async ({ page }) => {
  await ready(page);
  await page.waitForFunction(() => document.getElementById('loader')?.dataset.ready === 'true');
  await showAt(page, AFTER);
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

test('resizing at the swap point keeps the picture and the 3D plane aligned', async ({ page }) => {
  await ready(page);
  await showAt(page, BEFORE);
  await page.setViewportSize({ width: 1180, height: 860 });
  await page.waitForTimeout(500);
  await expectSeamlessSwap(page);
});
