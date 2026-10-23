import { expect, test, type Page } from '@playwright/test';
import { trackProgress } from '@/experience/chapters';
import { NIGHT_LIGHTS } from '@/experience/geometry';
import { worldMode } from '@/experience/worldState';
import { WINDOW_ON_EXIT } from '@/experience/cameraPoses';
import { visibleLights, waitForStore } from './helpers';

type StoreWindow = Window & {
  __aslan: {
    scene?: { getObjectByName(n: string): unknown };
    store: { getState(): { setProgress(p: number): void; seats: { id: string; status: string }[]; sit(id: string): boolean; confirm(): void } };
  };
};

async function ready(page: Page) {
  await page.goto('/');
  await waitForStore(page);
  await page.waitForFunction(() => !!(window as unknown as StoreWindow).__aslan.scene?.getObjectByName('GalleyPanels'));
}

/** Luminance statistics and channel means of a screen box, from a screenshot. */
async function boxStats(page: Page, box: { x: number; y: number; width: number; height: number }) {
  const png = (await page.screenshot({ clip: box })).toString('base64');
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
    let r = 0, g = 0, b = 0, sum = 0, sq = 0, max = 0, bright = 0, teal = 0;
    const n = d.length / 4;
    for (let i = 0; i < d.length; i += 4) {
      const l = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
      r += d[i]; g += d[i + 1]; b += d[i + 2];
      sum += l; sq += l * l; max = Math.max(max, l);
      if (l > 120) bright++;
      if (d[i + 1] - d[i] > 30 && d[i + 2] - d[i] > 30) teal++;
    }
    return { r: r / n, g: g / n, b: b / n, mean: sum / n, variance: sq / n - (sum / n) ** 2, max, bright, teal, pixels: n };
  }, png);
}

test('before boarding the background is the plain dark of the site', async ({ page }) => {
  await ready(page);
  await page.evaluate(() => (window as unknown as StoreWindow).__aslan.store.getState().setProgress(0.05));
  await page.waitForTimeout(2500);
  for (const box of [{ x: 0, y: 0 }, { x: 1420, y: 0 }, { x: 0, y: 390 }, { x: 1420, y: 390 }]) {
    const s = await boxStats(page, { ...box, width: 20, height: 20 });
    expect(Math.max(s.r, s.g, s.b), `corner ${box.x},${box.y}`).toBeLessThanOrEqual(16);
  }
});

test('from a window seat the night sky is dark blue with moonlit clouds', async ({ page }) => {
  await ready(page);
  await page.evaluate(() => {
    const s = (window as unknown as StoreWindow).__aslan.store.getState();
    s.setProgress(0.6);
    s.seats.find((x) => x.id === '14F')!.status = 'free';
    s.sit('14F');
  });
  await page.waitForTimeout(3000);
  const s = await boxStats(page, { x: 560, y: 300, width: 240, height: 260 }); // through the window
  console.log('window', JSON.stringify(s));
  expect(s.b).toBeGreaterThan(s.r);
  expect(s.mean).toBeLessThanOrEqual(110);
  expect(s.bright, 'moon or moonlit cloud tops').toBeGreaterThan(0);
});

test('out through the window the clouds below are lit by the moon', async ({ page }) => {
  await ready(page);
  await page.evaluate(() => {
    const s = (window as unknown as StoreWindow).__aslan.store.getState();
    s.setProgress(0.6);
    s.seats.find((x) => x.id === '14F')!.status = 'free';
    s.sit('14F');
    s.confirm();
    s.setProgress(0.45);
  });
  await page.waitForTimeout(3000);
  const s = await boxStats(page, { x: 0, y: 420, width: 1440, height: 380 });
  console.log('exit clouds', JSON.stringify(s));
  expect(s.variance).toBeGreaterThan(40);
  expect(s.mean, 'a night sky, not daylight').toBeLessThan(120);
});

test('the aircraft carries its navigation lights, and the light count never changes', async ({ page }) => {
  await ready(page);
  await page.evaluate(() => (window as unknown as StoreWindow).__aslan.store.getState().setProgress(0.05));
  await page.waitForTimeout(1500);
  const lights = await page.evaluate(() => {
    type L = { name: string; position: { x: number; y: number; z: number }; userData: { color?: string } };
    const group = (window as unknown as StoreWindow).__aslan.scene!.getObjectByName('NightLights') as unknown as { children: L[] };
    return Object.fromEntries(group.children.map((c) => [c.name, { at: [c.position.x, c.position.y, c.position.z], color: c.userData.color }]));
  });
  for (const [name, at] of Object.entries(NIGHT_LIGHTS)) {
    expect(lights[name], name).toBeDefined();
    lights[name].at.forEach((v: number, k: number) => expect(v, `${name}[${k}]`).toBeCloseTo(at[k], 2));
  }
  expect(lights.navPort.color).toBe('red');
  expect(lights.navStarboard.color).toBe('green');
  expect(lights.tail.color).toBe('white');
  const showcase = await visibleLights(page);
  await page.evaluate(() => (window as unknown as StoreWindow).__aslan.store.getState().setProgress(0.6));
  await page.waitForTimeout(1500);
  expect(await visibleLights(page)).toBe(showcase);
});

test('the night cabin stays readable: lit seats and their colours down the aisle', async ({ page }) => {
  await ready(page);
  await page.evaluate(() => (window as unknown as StoreWindow).__aslan.store.getState().setProgress(0.6));
  await page.waitForTimeout(2500);
  const seats = await boxStats(page, { x: 120, y: 470, width: 1200, height: 220 });
  console.log('aisle seats', JSON.stringify(seats));
  expect(seats.mean).toBeGreaterThanOrEqual(45);
  expect(seats.teal / seats.pixels, 'free-seat covers read as teal').toBeGreaterThanOrEqual(0.02);
});

test('reading lights burn over a quarter of the occupied seats', async ({ page }) => {
  await ready(page);
  const state = await page.evaluate(() => {
    const w = window as unknown as StoreWindow;
    const lamps = w.__aslan.scene!.getObjectByName('ReadingLightLamps') as unknown as { count: number } | undefined;
    const occupied = w.__aslan.store.getState().seats.filter((s) => s.status === 'occupied').length;
    return { lamps: lamps?.count ?? 0, occupied };
  });
  expect(state.lamps).toBe(Math.round(state.occupied / 4));
});

/** The first progress of the door flight at which the world turns to night (the camera is inside the cabin). */
const NIGHT_FROM = (() => {
  for (let i = 0; i <= 1000; i++) {
    const p = trackProgress('pre', 'door', i / 1000);
    if (worldMode('browse', p) === 'night') return p;
  }
  throw new Error('the door flight never reaches the night');
})();

test('boarding into the night compiles nothing new and never stalls a frame', async ({ page }) => {
  await ready(page);
  await page.waitForFunction(() => document.getElementById('loader')?.dataset.ready === 'true');
  type Gl = { info: { programs: unknown[] | null; memory: { geometries: number; textures: number } } };
  await page.evaluate((p) => (window as unknown as StoreWindow).__aslan.store.getState().setProgress(p), NIGHT_FROM - 0.01);
  await page.waitForTimeout(2500);
  const r = await page.evaluate(async (after) => {
    const w = window as unknown as { __aslan: { gl: Gl; store: { getState(): { setProgress(p: number): void } } } };
    const gpu = () => ({ programs: w.__aslan.gl.info.programs!.length, textures: w.__aslan.gl.info.memory.textures });
    const before = gpu();
    let worst = 0;
    let last = performance.now();
    await new Promise<void>((done) => {
      let n = 0;
      const tick = (t: number) => {
        if (n > 0) worst = Math.max(worst, t - last);
        last = t;
        if (n++ === 0) w.__aslan.store.getState().setProgress(after);
        if (n < 40) requestAnimationFrame(tick);
        else done();
      };
      requestAnimationFrame(tick);
    });
    return { before, after: gpu(), worst };
  }, NIGHT_FROM + 0.01);
  expect(r.after, 'nothing compiled or uploaded as the night sky comes in').toEqual(r.before);
  expect(r.worst, `worst frame ${r.worst.toFixed(0)} ms`).toBeLessThan(250);
});

test('the cabin looks the same whatever the outside light does, so boarding never shifts its colour', async ({ page }) => {
  await ready(page);
  await page.waitForFunction(() => document.getElementById('loader')?.dataset.ready === 'true');
  await page.evaluate(() => (window as unknown as StoreWindow).__aslan.store.getState().setProgress(0.6));
  await page.waitForTimeout(2000);
  const box = { x: 300, y: 240, width: 840, height: 420 };
  /** Pins the moon and the ambient fill at the given intensities (the sky sets them every frame otherwise). */
  const pin = (moon: number | null, fill: number | null) =>
    page.evaluate(
      ([moon, fill]) => {
        type Light = { isDirectionalLight?: boolean; isAmbientLight?: boolean; intensity: number };
        const scene = (window as unknown as { __aslan: { scene: { children: Light[] } } }).__aslan.scene;
        for (const light of scene.children) {
          const value = light.isDirectionalLight ? moon : light.isAmbientLight ? fill : undefined;
          if (value === undefined) continue;
          if (value === null) delete (light as Partial<Light>).intensity;
          else Object.defineProperty(light, 'intensity', { configurable: true, get: () => value, set: () => {} });
        }
      },
      [moon, fill] as const,
    );
  await pin(1.2, 0); // aboard
  await page.waitForTimeout(400);
  const aboard = await boxStats(page, box);
  await pin(2.6, 0.55); // the showcase's studio light, as seen through the door before boarding
  await page.waitForTimeout(400);
  const studio = await boxStats(page, box);
  for (const c of ['r', 'g', 'b'] as const) expect(Math.abs(aboard[c] - studio[c]), c).toBeLessThan(1.5);
});

test('aboard, the fuselage beacons never glow into the cabin; the wing lights still show through the windows', async ({ page }) => {
  await ready(page);
  await page.waitForFunction(() => document.getElementById('loader')?.dataset.ready === 'true');
  await page.evaluate(() => (window as unknown as StoreWindow).__aslan.store.getState().setProgress(0.6));
  await page.waitForTimeout(1500);
  // over more than a full blink cycle
  const seen = await page.evaluate(
    () =>
      new Promise<Record<string, boolean>>((done) => {
        type Node = { children: { isSprite?: boolean; visible: boolean }[] };
        const scene = (window as unknown as { __aslan: { scene: { getObjectByName(n: string): Node } } }).__aslan.scene;
        const halo = (name: string) => scene.getObjectByName(name).children.find((c) => c.isSprite)!;
        const seen: Record<string, boolean> = { beaconTop: false, beaconBottom: false, navPort: false };
        const start = performance.now();
        const tick = () => {
          for (const name of Object.keys(seen)) seen[name] ||= halo(name).visible;
          if (performance.now() - start < 1500) requestAnimationFrame(tick);
          else done(seen);
        };
        requestAnimationFrame(tick);
      }),
  );
  expect(seen).toEqual({ beaconTop: false, beaconBottom: false, navPort: true });
});

/** Bright specks in a screen box: connected groups of pixels well above the local sky, and their sizes in pixels. */
async function specks(page: Page, box: { x: number; y: number; width: number; height: number }) {
  const png = (await page.screenshot({ clip: box })).toString('base64');
  return page.evaluate(async (b64) => {
    const img = new Image();
    img.src = `data:image/png;base64,${b64}`;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = img.width;
    c.height = img.height;
    const ctx = c.getContext('2d')!;
    ctx.drawImage(img, 0, 0);
    const { data, width, height } = ctx.getImageData(0, 0, c.width, c.height);
    const lum = (i: number) => 0.2126 * data[i * 4] + 0.7152 * data[i * 4 + 1] + 0.0722 * data[i * 4 + 2];
    const sorted = Array.from({ length: width * height }, (_, i) => lum(i)).sort((a, b) => a - b);
    const sky = sorted[Math.floor(sorted.length / 2)];
    const lit = (i: number) => lum(i) > sky + 18;
    const seen = new Uint8Array(width * height);
    const sizes: number[] = [];
    for (let i = 0; i < width * height; i++) {
      if (seen[i] || !lit(i)) continue;
      let n = 0;
      const stack = [i];
      seen[i] = 1;
      while (stack.length) {
        const j = stack.pop()!;
        n++;
        const x = j % width, y = (j - x) / width;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x + dx, ny = y + dy;
          const k = ny * width + nx;
          if (nx >= 0 && ny >= 0 && nx < width && ny < height && !seen[k] && lit(k)) {
            seen[k] = 1;
            stack.push(k);
          }
        }
      }
      sizes.push(n);
    }
    return sizes.sort((a, b) => a - b);
  }, png);
}

test('out of the window the stars are crisp points, not soft blobs', async ({ page }) => {
  await ready(page);
  await page.waitForFunction(() => document.getElementById('loader')?.dataset.ready === 'true');
  await page.evaluate((window_) => {
    const s = (window as unknown as StoreWindow).__aslan.store.getState();
    s.setProgress(0.6);
    s.seats.find((x) => x.id === '14F')!.status = 'free';
    s.sit('14F');
    s.confirm();
    s.setProgress(window_); // at the window on the way out: open sky above the wing
  }, WINDOW_ON_EXIT);
  await page.waitForTimeout(2500);
  // specks between 3 and 400 px: stars (single pixels are noise, bigger patches are clouds)
  const stars = (await specks(page, { x: 0, y: 70, width: 1000, height: 260 })).filter((n) => n >= 3 && n <= 400);
  expect(stars.length, 'stars in the sky').toBeGreaterThanOrEqual(8);
  const median = stars[Math.floor(stars.length / 2)];
  expect(median, `median star size ${median} px (${stars.join(',')})`).toBeLessThanOrEqual(12);
});
