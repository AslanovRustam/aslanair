import { expect, test } from '@playwright/test';
import { INTRO, LOADER } from '@/experience/introState';
import { heroPictureBox, loaderGone, progress, waitForStore } from './helpers';

type Frame = { t: number; x: number; y: number; w: number; h: number; opacity: number };

/** From the moment the scene is ready until the loader is gone: the loader picture's box and the loader's opacity,
 * every animation frame (t in ms since ready). */
const handOver = (page: import('@playwright/test').Page) =>
  page.evaluate(
    () =>
      new Promise<Frame[]>((done) => {
        const loader = document.getElementById('loader')!;
        const img = loader.querySelector('img')!;
        const out: Frame[] = [];
        let readyAt: number | null = null;
        const tick = (now: number) => {
          if (loader.dataset.ready === 'true') {
            readyAt ??= now;
            const b = img.getBoundingClientRect();
            const style = getComputedStyle(loader);
            out.push({ t: now - readyAt, x: b.x, y: b.y, w: b.width, h: b.height, opacity: Number(style.opacity) });
            if (style.visibility === 'hidden' || now - readyAt > 4000) return done(out);
          }
          requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }),
  );

for (const viewport of [
  { width: 1440, height: 800 },
  { width: 412, height: 915 },
]) {
  test(`the loader paints first, shows progress and hands the plane picture to the hero at ${viewport.width}×${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.route('**/models/*.glb', async (r) => {
      await new Promise((f) => setTimeout(f, 1500));
      await r.continue();
    });
    await page.goto('/');
    const loader = page.locator('#loader');
    await expect(loader).toBeVisible();
    await expect(loader).toHaveAttribute('role', 'progressbar');
    // the hero mounts while the models are still held back: it waits behind the loader, its entrance not played
    await page.getByTestId('hero').waitFor({ state: 'attached' });
    // at its loading size (in dev the stylesheet can land after the first paint, and the picture then eases to it)
    await page.waitForFunction((start) => getComputedStyle(document.querySelector('#loader img')!).scale === String(start), LOADER.start);
    // the picture's box is read in the same moment, while the scene is surely still loading
    const { box: before, ...waiting } = await page.getByTestId('hero').evaluate((hero) => {
      const b = document.querySelector('#loader img')!.getBoundingClientRect();
      return {
        loading: document.getElementById('loader')!.dataset.ready === 'false',
        paused: hero.getAnimations({ subtree: true }).every((a) => a.playState === 'paused'),
        box: { x: b.x, y: b.y, width: b.width, height: b.height },
      };
    });
    expect(waiting).toEqual({ loading: true, paused: true });
    await expect.poll(async () => Number(await loader.getAttribute('aria-valuenow'))).toBeGreaterThan(0);
    const hero = heroPictureBox(page); // where the live camera frames the plane at the top
    // while loading: half the hero's picture, on the same centre
    expect(Math.abs(before.width - hero.width / 2), 'width').toBeLessThanOrEqual(2);
    expect(Math.abs(before.height - hero.height / 2), 'height').toBeLessThanOrEqual(2);
    expect(Math.abs(before.x + before.width / 2 - (hero.x + hero.width / 2)), 'centre x').toBeLessThanOrEqual(2);
    expect(Math.abs(before.y + before.height / 2 - (hero.y + hero.height / 2)), 'centre y').toBeLessThanOrEqual(2);
    // once ready it grows into the hero's picture, smoothly, and only then does the loader let the live plane show
    const frames = await handOver(page);
    const near = (f: Frame) => Math.abs(f.w - hero.width) <= 2 && Math.abs(f.h - hero.height) <= 2 && Math.abs(f.x - hero.x) <= 2 && Math.abs(f.y - hero.y) <= 2;
    const full = frames.findIndex(near);
    expect(full, 'reaches the hero picture').toBeGreaterThanOrEqual(0);
    expect(frames[full].t, 'within 1.2 s of ready').toBeLessThanOrEqual(1200);
    // no jump: between two frames the width changes no faster than the growth's steepest pace (its ease-out starts
    // at about 4.5 × the mean) over the time between them — a late frame may take a bigger step, a jump cannot
    for (let i = 1; i < frames.length; i++) {
      const pace = (5 * (hero.width / 2) * (frames[i].t - frames[i - 1].t)) / (LOADER.grow * 1000);
      expect(Math.abs(frames[i].w - frames[i - 1].w), `step at ${frames[i].t.toFixed(0)} ms`).toBeLessThanOrEqual(pace + 4);
    }
    // whole until then (0.999: see through only for the browser, which then rasters the page under it in time)
    for (const f of frames.slice(0, full)) expect(f.opacity, `loader opacity at ${f.t.toFixed(0)} ms`).toBeGreaterThanOrEqual(0.99);
    await expect(loader).toBeHidden({ timeout: 5000 });
    await expect(page.getByTestId('hero').getByRole('heading', { name: 'Night flight' })).toBeVisible();
  });
}

for (const viewport of [
  { width: 1440, height: 800 },
  { width: 412, height: 915 },
]) {
  test(`at ${viewport.width}×${viewport.height} the emblem and its words sit above the plane while it loads, and step aside as it grows`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.route('**/models/*.glb', async (r) => {
      await new Promise((f) => setTimeout(f, 1500));
      await r.continue();
    });
    await page.goto('/');
    await expect(page.locator('#loader img')).toBeVisible();
    const boxes = () =>
      page.evaluate((top) => {
        const loader = document.getElementById('loader')!;
        const img = loader.querySelector('img')!.getBoundingClientRect();
        const status = loader.querySelector(':scope > div')!;
        const s = status.getBoundingClientRect();
        // the plane's own top in the picture (the picture is a frame, the plane its middle part)
        return { planeTop: img.y + top * img.height, status: { top: s.top, bottom: s.bottom }, opacity: Number(getComputedStyle(status).opacity), ready: loader.dataset.ready === 'true' };
      }, INTRO.picture.plane.top);
    const loading = await boxes();
    expect(loading.ready, 'still loading').toBe(false);
    expect(loading.status.bottom, 'above the plane').toBeLessThanOrEqual(loading.planeTop - 8);
    expect(loading.status.top, 'on screen').toBeGreaterThanOrEqual(0);
    // as the plane grows up into them, the emblem and its words are already gone
    const seen: string[] = [];
    await page.waitForFunction(() => document.getElementById('loader')?.dataset.ready === 'true', null, { timeout: 60_000 });
    for (let i = 0; i < 30; i++) {
      const b = await boxes();
      if (b.planeTop < b.status.bottom && b.opacity > 0.05) seen.push(`plane top ${b.planeTop.toFixed(0)} under words at opacity ${b.opacity.toFixed(2)}`);
      await page.waitForTimeout(40);
    }
    expect(seen, 'the growing plane never runs into the words').toEqual([]);
  });
}

test('the loader and the plane picture preload come with the server response, before any script runs', async ({ request }) => {
  const response = await request.get('/');
  const html = await response.text();
  expect(html).toContain('id="loader"');
  expect(html).toContain('Preparing your night flight');
  // Next 16 sends resource hints as a Link header; a <link> tag in the HTML would do as well
  const header = response.headers()['link'] ?? '';
  const tag = /<link[^>]*rel="preload"[^>]*plane-hero\.webp|<link[^>]*plane-hero\.webp[^>]*rel="preload"/.test(html);
  expect(tag || /<\/images\/plane-hero\.webp>;\s*rel=preload;\s*as="image"/.test(header)).toBe(true);
});

test('the loader reveals the emblem bottom to top on the compositor, with no outline and no bar', async ({ page }) => {
  await page.route('**/models/*.glb', async (r) => {
    await new Promise((f) => setTimeout(f, 3000));
    await r.continue();
  });
  await page.goto('/');
  const loader = page.locator('#loader');
  await expect(loader).toBeVisible();
  await expect(loader.locator('[data-part="ring"]')).toHaveCount(0);
  await expect(loader.locator('[data-part="bar"]')).toHaveCount(0);
  const reveal = await loader.locator('[data-part="reveal"]').evaluate((el) => {
    const animations = el.getAnimations({ subtree: true });
    const properties = new Set<string>();
    for (const a of animations)
      for (const k of (a.effect as KeyframeEffect).getKeyframes())
        for (const key of Object.keys(k)) if (!['offset', 'easing', 'composite', 'computedOffset'].includes(key)) properties.add(key);
    const own = el.getAnimations()[0];
    return { count: animations.length, properties: [...properties], from: String((own.effect as KeyframeEffect).getKeyframes()[0].transform) };
  });
  // transform and opacity only: the compositor runs them even while the page's scripts keep the main thread busy
  expect(reveal.count).toBeGreaterThan(0);
  expect(reveal.properties.every((p) => p === 'transform' || p === 'opacity'), reveal.properties.join(',')).toBe(true);
  // the window over the emblem starts below it and rises
  expect(reveal.from).toMatch(/translateY\(100%\)|matrix\(1, 0, 0, 1, 0, [1-9]/);
});

test('the hand-over never stalls a frame: the page under the loader is ready before it fades', async ({ page }) => {
  await page.goto('/');
  await waitForStore(page);
  await page.waitForFunction(() => document.getElementById('loader')?.dataset.ready === 'true', null, { timeout: 60_000 });
  const worst = await page.evaluate(
    () =>
      new Promise<number>((done) => {
        const loader = document.getElementById('loader')!;
        let last = performance.now();
        let worst = 0;
        const tick = (t: number) => {
          worst = Math.max(worst, t - last);
          last = t;
          if (getComputedStyle(loader).visibility === 'hidden') done(worst);
          else requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }),
  );
  expect(worst, 'longest frame, ms').toBeLessThan(120);
});

test('the page holds still while the loader hands over', async ({ page }) => {
  await page.goto('/');
  await waitForStore(page);
  await page.waitForFunction(() => document.getElementById('loader')?.dataset.ready === 'true', null, { timeout: 60_000 });
  await page.mouse.move(720, 400);
  for (let i = 0; i < 3; i++) await page.mouse.wheel(0, 600);
  await expect(page.locator('#loader')).toBeHidden({ timeout: 5000 });
  expect(await progress(page)).toBe(0);
});

test('a wheel while the loader is still loading moves nothing: the hand-over starts from the top (spec r5 §2)', async ({ page }) => {
  await page.route('**/models/*.glb', async (r) => {
    await new Promise((f) => setTimeout(f, 3000));
    await r.continue();
  });
  await page.goto('/');
  await waitForStore(page);
  await page.mouse.move(720, 400);
  for (let i = 0; i < 3; i++) {
    await page.mouse.wheel(0, 600);
    await page.waitForTimeout(150);
  }
  expect(await page.evaluate(() => document.getElementById('loader')?.dataset.ready), 'still loading').not.toBe('true');
  expect(await progress(page), 'while loading').toBe(0);
  await loaderGone(page);
  expect(await progress(page), 'at the hand-over').toBe(0);
});

test('under reduced motion the picture fades out at its small size', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.route('**/models/*.glb', async (r) => {
    await new Promise((f) => setTimeout(f, 1500));
    await r.continue();
  });
  await page.goto('/');
  const small = (await page.locator('#loader img').boundingBox())!;
  const frames = await handOver(page);
  for (const f of frames) expect(f.w, `width at ${f.t.toFixed(0)} ms`).toBeLessThanOrEqual(small.width + 2);
  expect(frames[frames.length - 1].t, 'gone within 1 s of ready').toBeLessThanOrEqual(1000);
});

test('the moment the loader is gone the page scrolls: no wheel is lost after the hand-over', async ({ page }) => {
  await page.goto('/');
  await waitForStore(page);
  await loaderGone(page);
  await page.mouse.move(720, 400);
  await page.mouse.wheel(0, 600);
  await expect.poll(() => progress(page), { timeout: 3000 }).toBeGreaterThan(0);
});
