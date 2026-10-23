import { mkdirSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { trackProgress } from '@/experience/chapters';
import { INTRO } from '@/experience/introState';
import { waitForStore } from './helpers';

// Runs as its own Playwright project after the main suite, so no other browser shares the GPU.

type StoreWindow = Window & {
  __aslan: {
    scene?: { getObjectByName(n: string): unknown };
    store: {
      getState(): {
        seats: { id: string; status: string }[];
        setProgress(p: number): void;
        restart(): void;
        sit(id: string): boolean;
        confirm(): void;
      };
    };
  };
};

async function ready(page: Page) {
  await page.goto('/');
  await waitForStore(page);
  await page.waitForFunction(() => !!(window as unknown as StoreWindow).__aslan.scene?.getObjectByName('GalleyPanels'));
  await page.waitForFunction(() => document.getElementById('loader')?.dataset.ready === 'true');
}

/** Door chapter t 0.78: the look at the flight-deck door, jump seat and arrowed exit sign. */
const ENTRY = trackProgress('pre', 'door', 0.78);
/** The intro just after the swap: the live plane full frame on the showcase dark. */
const SWAP = trackProgress('pre', 'sky', INTRO.swapAt + INTRO.crossfade);

const setProgress = (page: Page, p: number) => page.evaluate((v) => (window as unknown as StoreWindow).__aslan.store.getState().setProgress(v), p);

/** Median and mean of 180 requestAnimationFrame deltas (ms). The display's vsync quantizes the median; the mean
 * shows how many frames slip to the next interval — what a 60 Hz panel would feel. */
const frameTimes = (page: Page) =>
  page.evaluate(
    () =>
      new Promise<{ median: number; mean: number }>((resolve) => {
        const deltas: number[] = [];
        let last = performance.now();
        const tick = (t: number) => {
          deltas.push(t - last);
          last = t;
          if (deltas.length < 180) requestAnimationFrame(tick);
          else resolve({ median: [...deltas].sort((a, b) => a - b)[90], mean: deltas.reduce((s, d) => s + d, 0) / deltas.length });
        };
        requestAnimationFrame(tick);
      }),
  );

test('the night flight holds 45 fps — showcase, swap, door, entry, aisle, aisle end, seat, pass and exit', async ({ page }) => {
  test.setTimeout(180_000);
  await ready(page);
  const report: Record<string, { median: number; mean: number }> = {};
  // best of two samples: a cost of ours shows in both, a burst from another process on the GPU in one at most
  const measure = async (name: string) => {
    await page.waitForTimeout(2500); // the camera settles; the warm-up is inside this
    const a = await frameTimes(page);
    const b = await frameTimes(page);
    report[name] = a.mean <= b.mean ? a : b;
  };
  await setProgress(page, 0.05);
  await measure('showcase');
  await setProgress(page, SWAP);
  await measure('swap');
  await setProgress(page, 0.42);
  await measure('door');
  await setProgress(page, ENTRY);
  await measure('entry');
  await setProgress(page, 0.6);
  await measure('aisle');
  await setProgress(page, 1);
  await measure('aisle-end');
  await page.evaluate(() => {
    const s = (window as unknown as StoreWindow).__aslan.store.getState();
    s.seats.find((x) => x.id === '14F')!.status = 'free';
    s.sit('14F');
  });
  await measure('seat');
  await page.evaluate(() => (window as unknown as StoreWindow).__aslan.store.getState().confirm());
  await setProgress(page, 0.07);
  await measure('pass');
  await setProgress(page, 0.45);
  await measure('exit');
  for (const [name, t] of Object.entries(report)) console.log(`${name} median ${t.median.toFixed(1)} ms, mean ${t.mean.toFixed(1)} ms`);
  for (const [name, t] of Object.entries(report)) {
    expect(t.median, `${name} median`).toBeLessThanOrEqual(1000 / 45);
    expect(t.mean, `${name} mean`).toBeLessThanOrEqual(1000 / 45);
  }
});

/**
 * Where the plane lies on the 1440×800 screen when the picture (or the 3D frame it matches) is shown at `scale`,
 * lifted by `lift` frame heights: the showcase chapters sit on the site's plain dark by design, so they are judged
 * on the plane, not on the whole frame.
 */
function planeOnScreen(scale: number, lift: number) {
  const [vw, vh] = [1440, 800];
  const h = vh * scale;
  const w = (h * INTRO.picture.width) / INTRO.picture.height;
  const left = vw / 2 - w / 2;
  const top = vh / 2 - lift * vh - h / 2;
  const { plane } = INTRO.picture;
  return {
    x: Math.round(left + plane.left * w),
    y: Math.round(top + plane.top * h),
    width: Math.round((plane.right - plane.left) * w),
    height: Math.round((plane.bottom - plane.top) * h),
  };
}

/** Mean and variance of a screenshot's luminance (0–255). */
function luminance(page: Page, png: Buffer) {
  return page.evaluate(async (b64) => {
    const img = new Image();
    img.src = `data:image/png;base64,${b64}`;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = img.width;
    c.height = img.height;
    const ctx = c.getContext('2d')!;
    ctx.drawImage(img, 0, 0);
    const d = ctx.getImageData(0, 0, c.width, c.height).data;
    let sum = 0;
    let sq = 0;
    const n = d.length / 4;
    for (let i = 0; i < d.length; i += 4) {
      const l = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
      sum += l;
      sq += l * l;
    }
    return { mean: sum / n, variance: sq / n - (sum / n) ** 2 };
  }, png.toString('base64'));
}

test('review screenshot set — never a black screen', async ({ page }) => {
  test.setTimeout(240_000);
  const dir = 'test-results/night';
  mkdirSync(dir, { recursive: true });
  const shots: string[] = [];
  const report: string[] = [];
  type Box = ReturnType<typeof planeOnScreen>;
  const shoot = async (name: string, { settle = 2500, dark = false, judgeOn }: { settle?: number; dark?: boolean; judgeOn?: Box } = {}) => {
    await page.waitForTimeout(settle);
    const png = await page.screenshot({ path: `${dir}/${name}.png` });
    const l = await luminance(page, judgeOn ? await page.screenshot({ clip: judgeOn }) : png);
    report.push(`${name} mean ${l.mean.toFixed(1)} variance ${l.variance.toFixed(0)}`);
    expect(l.variance, `${name} is not blank`).toBeGreaterThan(1);
    // the "not a black screen" guard: the plane or the cabin is clearly lit (the loader is meant to be dark)
    if (!dark) expect(l.mean, `${name} mean luminance`).toBeGreaterThanOrEqual(18);
    shots.push(name);
  };
  const sit = (id: string) =>
    page.evaluate((sid) => {
      const s = (window as unknown as StoreWindow).__aslan.store.getState();
      s.restart();
      s.setProgress(0.6);
      const seat = s.seats.find((x) => x.id === sid)!;
      seat.status = 'free';
      s.sit(sid);
    }, id);

  // the loader, held up by a slow model
  await page.route('**/models/*.glb', async (r) => {
    await new Promise((f) => setTimeout(f, 4000));
    await r.continue();
  });
  await page.goto('/');
  await shoot('loader', { settle: 2000, dark: true });
  await waitForStore(page);
  await page.waitForFunction(() => document.getElementById('loader')?.dataset.ready === 'true', null, { timeout: 60_000 });

  await shoot('hero', { judgeOn: planeOnScreen(INTRO.heroScale, INTRO.heroLift) });
  await setProgress(page, SWAP);
  await shoot('intro-swap', { judgeOn: planeOnScreen(1, 0) });
  for (const [name, p] of [['door', 0.36], ['entry', ENTRY], ['aisle', 0.6], ['aisle-end', 1]] as const) {
    await setProgress(page, p);
    await shoot(name);
  }
  for (const id of ['1A', '14F', '30A']) {
    await sit(id);
    await shoot(`seat-${id}`);
  }
  await page.evaluate(() => (window as unknown as StoreWindow).__aslan.store.getState().confirm());
  await setProgress(page, 0.07);
  await shoot('pass');
  await setProgress(page, 0.45);
  await shoot('exit');
  await setProgress(page, 0.9);
  await shoot('outro');
  console.log(report.join('\n'));
  expect(shots).toHaveLength(13);
});
