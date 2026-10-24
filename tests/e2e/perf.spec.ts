import { mkdirSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { Vector3 } from 'three';
import { poseOnPreTrack } from '@/experience/cameraPoses';
import { trackProgress } from '@/experience/chapters';
import { CURTAIN } from '@/experience/curtain';
import { GLOBE } from '@/experience/globe';
import { INTRO } from '@/experience/introState';
import { aircraftStage, projectedBox } from '@/experience/stage';
import { pre, waitForStore } from './helpers';

// Runs as its own Playwright project after the main suite, so no other browser shares the GPU.

type StoreWindow = Window & {
  __aslan: {
    scene?: { getObjectByName(n: string): unknown };
    store: {
      getState(): {
        seats: { id: string; status: string }[];
        setProgress(p: number): void;
        pickDestination(code: string, now: number): boolean;
        chooseTransfer(id: string): boolean;
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
/** Picks a destination now: the plane flies the arc (1.6 s) while the frames are timed or the shot is taken. */
const pick = (page: Page, code: string) =>
  page.evaluate((c) => (window as unknown as StoreWindow).__aslan.store.getState().pickDestination(c, performance.now() / 1000), code);

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

test('the night flight holds 45 fps — the journey, the door, the cabin, the seat, the pass and the exit', async ({ page }) => {
  test.setTimeout(300_000); // thirteen poses and the curtain, each sampled twice
  await ready(page);
  const report: Record<string, { median: number; mean: number }> = {};
  // best of two samples: a cost of ours shows in both, a burst from another process on the GPU in one at most
  const measure = async (name: string) => {
    await page.waitForTimeout(2500); // the camera settles; the warm-up is inside this
    const a = await frameTimes(page);
    const b = await frameTimes(page);
    report[name] = a.mean <= b.mean ? a : b;
  };
  await setProgress(page, pre('sky', 0.25));
  await measure('showcase');
  await setProgress(page, pre('sky', 0.5));
  await measure('first-screen');
  await setProgress(page, pre('destinations', 0.5));
  await page.waitForTimeout(2500);
  await pick(page, 'HND');
  report['globe-flight'] = await frameTimes(page);
  await measure('globe');
  await setProgress(page, pre('transfer', 0.75));
  await measure('transfer');
  await setProgress(page, pre('ready', 0.7));
  await measure('ready');
  await setProgress(page, pre('door', 0.88));
  await measure('door');
  await setProgress(page, ENTRY);
  await measure('entry');
  await setProgress(page, pre('aisle', 0.27));
  await measure('aisle');
  await setProgress(page, 1);
  await measure('aisle-end');
  // the curtain: from the aisle's end to Destinations, every frame from the click until the curtain has lifted
  const curtain = page.evaluate(
    () =>
      new Promise<{ median: number; mean: number }>((resolve) => {
        const deltas: number[] = [];
        let last = performance.now();
        let started = false;
        const tick = (t: number) => {
          deltas.push(t - last);
          last = t;
          const on = !!document.documentElement.dataset.curtain;
          started ||= on;
          if (started && !on) resolve({ median: [...deltas].sort((a, b) => a - b)[Math.floor(deltas.length / 2)], mean: deltas.reduce((s, d) => s + d, 0) / deltas.length });
          else requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }),
  );
  await page.getByRole('navigation', { name: 'Chapters' }).getByRole('button', { name: /Destinations/ }).click();
  report['curtain'] = await curtain;
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

/** A box on the 1440×800 screen from fractions of the frame, cut to it. */
function onScreen(b: { x0: number; y0: number; x1: number; y1: number }) {
  const [vw, vh] = [1440, 800];
  const cut = (v: number) => Math.min(1, Math.max(0, v));
  const [x0, y0, x1, y1] = [cut(b.x0) * vw, cut(b.y0) * vh, cut(b.x1) * vw, cut(b.y1) * vh].map(Math.round);
  return { x: x0, y: y0, width: Math.max(1, x1 - x0), height: Math.max(1, y1 - y0) };
}

/** Where the plane stands on the 1440×800 screen at a point of the journey's first chapters (no globe flight). */
const planeAt = (progress: number) => onScreen(projectedBox(aircraftStage('browse', progress), poseOnPreTrack(progress, 1440 / 800), 1440 / 800));

/** Where the globe lies on the 1440×800 screen: the square inside its disc (the night sea and land, no sky). */
function globeAt(progress: number) {
  const aspect = 1440 / 800;
  const pose = poseOnPreTrack(progress, aspect);
  const view = pose.target.clone().sub(pose.position).normalize();
  const toCentre = GLOBE.center.clone().sub(pose.position);
  // the frame's half-height and half-width in tangents, shifted by the lens lift
  const tanY = Math.tan(((pose.fov / 2) * Math.PI) / 180);
  const right = view.clone().cross(new Vector3(0, 1, 0)).normalize();
  const up = right.clone().cross(view);
  const depth = toCentre.dot(view);
  const [cx, cy] = [toCentre.dot(right) / depth / (tanY * aspect), toCentre.dot(up) / depth / tanY + 2 * (pose.lift ?? 0)];
  // the disc's radius in frame half-heights, and the square inside it
  const r = (GLOBE.radius / Math.sqrt(toCentre.lengthSq() - GLOBE.radius ** 2) / tanY) * Math.SQRT1_2;
  return onScreen({ x0: (cx - r / aspect + 1) / 2, x1: (cx + r / aspect + 1) / 2, y0: (1 - (cy + r)) / 2, y1: (1 - (cy - r)) / 2 });
}

/**
 * Where the plane lies on the 1440×800 screen when the picture (or the 3D frame it matches) is shown at `scale`,
 * lifted by `lift` frame heights: the showcase chapters sit on the site's plain dark by design, so they are judged
 * on the plane (or the globe), not on the whole frame.
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

/** Mean and variance of a screenshot's luminance (0–255), over `box` when given (screen pixels). */
function luminance(page: Page, png: Buffer, box?: { x: number; y: number; width: number; height: number }) {
  return page.evaluate(async ([b64, box]) => {
    const img = new Image();
    img.src = `data:image/png;base64,${b64}`;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = img.width;
    c.height = img.height;
    const ctx = c.getContext('2d')!;
    ctx.drawImage(img, 0, 0);
    const d = (box ? ctx.getImageData(box.x, box.y, box.width, box.height) : ctx.getImageData(0, 0, c.width, c.height)).data;
    let sum = 0;
    let sq = 0;
    let lit = 0;
    const n = d.length / 4;
    for (let i = 0; i < d.length; i += 4) {
      const l = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
      sum += l;
      sq += l * l;
      if (l > 40) lit++;
    }
    return { mean: sum / n, variance: sq / n - (sum / n) ** 2, lit: lit / n };
  }, [png.toString('base64'), box] as const);
}

test('review screenshot set — never a black screen', async ({ page }) => {
  test.setTimeout(240_000);
  const dir = 'test-results/night';
  mkdirSync(dir, { recursive: true });
  const shots: string[] = [];
  const report: string[] = [];
  type Box = ReturnType<typeof onScreen>;
  /** `night`: a night globe — dark sea by design — passes when enough of it is lit (land, cities, markers). */
  const shoot = async (name: string, { settle = 2500, dark = false, night = false, judgeOn }: { settle?: number; dark?: boolean; night?: boolean; judgeOn?: Box } = {}) => {
    await page.waitForTimeout(settle);
    const png = await page.screenshot({ path: `${dir}/${name}.png` });
    // judged on the same frame that is saved: the curtain and the globe flight move between two screenshots
    const l = await luminance(page, png, judgeOn);
    report.push(`${name} mean ${l.mean.toFixed(1)} variance ${l.variance.toFixed(0)} lit ${(l.lit * 100).toFixed(1)} %`);
    expect(l.variance, `${name} is not blank`).toBeGreaterThan(1);
    // the "not a black screen" guard: the plane or the cabin is clearly lit (the loader is meant to be dark)
    if (night) expect(l.lit, `${name} share lit`).toBeGreaterThanOrEqual(0.05);
    else if (!dark) expect(l.mean, `${name} mean luminance`).toBeGreaterThanOrEqual(18);
    shots.push(name);
  };
  const sit = (id: string) =>
    page.evaluate((sid) => {
      const s = (window as unknown as StoreWindow).__aslan.store.getState();
      s.restart();
      s.setProgress(__pre('aisle', 0.27));
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
  await page.addStyleTag({ content: 'nextjs-portal { display: none !important; }' }); // the dev build's badge
  await shoot('loader', { settle: 2000, dark: true });
  await waitForStore(page);
  await page.waitForFunction(() => document.getElementById('loader')?.dataset.ready === 'true', null, { timeout: 60_000 });

  await shoot('hero', { judgeOn: planeOnScreen(INTRO.heroScale, INTRO.heroLift) });
  await setProgress(page, pre('sky', 0.25));
  await page.mouse.move(300, 620); // the grid's glow follows the pointer
  await shoot('grid', { judgeOn: planeAt(pre('sky', 0.25)) });
  await page.mouse.move(1200, 720); // off the chapters' cards, so a hover never opens one in a later shot
  await setProgress(page, pre('sky', 0.45));
  await shoot('first-screen', { judgeOn: planeAt(pre('sky', 0.45)) });
  await setProgress(page, pre('sky', 0.9));
  await shoot('globe-rising', { night: true, judgeOn: globeAt(pre('sky', 0.9)) });
  await setProgress(page, pre('destinations', 0.5));
  await shoot('destinations', { night: true, judgeOn: globeAt(pre('destinations', 0.5)) });
  await pick(page, 'GIG');
  await shoot('destinations-flight', { settle: 800, night: true, judgeOn: globeAt(pre('destinations', 0.5)) });
  await setProgress(page, pre('transfer', 0.75));
  await shoot('transfer', { judgeOn: planeAt(pre('transfer', 0.75)) });
  await page.evaluate(() => (window as unknown as StoreWindow).__aslan.store.getState().chooseTransfer('home'));
  await shoot('transfer-open', { judgeOn: planeAt(pre('transfer', 0.75)) });
  await setProgress(page, pre('ready', 0.7));
  await shoot('ready', { judgeOn: planeAt(pre('ready', 0.7)) });
  for (const [name, p] of [['door', pre('door', 0.64)], ['entry', ENTRY], ['aisle', pre('aisle', 0.27)], ['aisle-end', 1]] as const) {
    await setProgress(page, p);
    await shoot(name);
  }
  // the curtain mid-flight: from the aisle's end to Destinations, the plane crossing the covered screen
  await page.getByRole('navigation', { name: 'Chapters' }).getByRole('button', { name: /Destinations/ }).click();
  await page.waitForFunction(() => !!document.documentElement.dataset.curtain);
  // dark by design (the night's dark): judged on the band the plane flies down, by its lit share
  await shoot('curtain', { settle: (CURTAIN.cover + CURTAIN.flight / 2) * 1000, night: true, judgeOn: onScreen({ x0: 0.3, x1: 0.7, y0: 0, y1: 1 }) });
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
  expect(shots).toHaveLength(21);
});
