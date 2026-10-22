import { mkdirSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { trackProgress } from '@/experience/chapters';
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
}

/** Door chapter t 0.78: the look at the flight-deck door, jump seat and arrowed exit sign. */
const ENTRY = trackProgress('pre', 'door', 0.78);

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

test('the furnished cabin holds 45 fps — door, entry, aisle, aisle end, seat and pass', async ({ page }) => {
  test.setTimeout(120_000);
  await ready(page);
  const report: Record<string, { median: number; mean: number }> = {};
  const measure = async (name: string) => {
    await page.waitForTimeout(2500); // the camera settles; the warm-up is inside this
    report[name] = await frameTimes(page);
  };
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
  for (const [name, t] of Object.entries(report)) console.log(`${name} median ${t.median.toFixed(1)} ms, mean ${t.mean.toFixed(1)} ms`);
  for (const [name, t] of Object.entries(report)) {
    expect(t.median, `${name} median`).toBeLessThanOrEqual(1000 / 45);
    expect(t.mean, `${name} mean`).toBeLessThanOrEqual(1000 / 45);
  }
});

test('review screenshot set', async ({ page }) => {
  test.setTimeout(180_000);
  await ready(page);
  const dir = 'test-results/cabin';
  mkdirSync(dir, { recursive: true });
  const shots: string[] = [];
  const shoot = async (name: string) => {
    await page.waitForTimeout(2500);
    const png = await page.screenshot({ path: `${dir}/${name}.png` });
    const variance = await page.evaluate(async (b64) => {
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
      return sq / n - (sum / n) ** 2;
    }, png.toString('base64'));
    expect(variance, `${name} is not blank`).toBeGreaterThan(1);
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

  for (const [name, p] of [['sky', 0.05], ['door', 0.36], ['entry', ENTRY], ['aisle', 0.6], ['aisle-end', 1]] as const) {
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
  expect(shots).toHaveLength(10);
});
