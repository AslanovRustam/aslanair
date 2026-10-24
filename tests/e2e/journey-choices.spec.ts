import { expect, test, type Page } from '@playwright/test';
import { poseOnPreTrack } from '@/experience/cameraPoses';
import { TRACKS } from '@/experience/chapters';
import { DESTINATIONS } from '@/experience/destinations';
import { GLOBE } from '@/experience/globe';
import { aircraftStage, projectedBox } from '@/experience/stage';
import { pre, progress, waitForStore, wheelTo } from './helpers';

type Vec = { x: number; y: number; z: number; applyMatrix4(m: unknown): Vec; project(camera: unknown): Vec };
type Node = {
  visible: boolean;
  matrixWorld: { elements: number[] };
  updateWorldMatrix(parents: boolean, children: boolean): void;
  geometry?: { attributes: { position: { count: number; getX(i: number): number; getY(i: number): number; getZ(i: number): number } } };
};
type PageWindow = {
  __aslan: {
    scene: { position: { constructor: new (x: number, y: number, z: number) => Vec }; getObjectByName(name: string): Node | undefined };
    camera: unknown;
    store: { getState(): { destinationId: string; transferId: string; progress: number; setProgress(p: number): void } };
  };
};

const globe = (page: Page) =>
  page.evaluate(() => {
    const scene = (window as unknown as PageWindow).__aslan.scene;
    return {
      visible: !!scene.getObjectByName('Globe')?.visible,
      markers: scene.getObjectByName('GlobeMarkers')?.geometry?.attributes.position.count ?? 0,
    };
  });

const chosen = (page: Page) => page.evaluate(() => (window as unknown as PageWindow).__aslan.store.getState().destinationId);

/** How far the plane is from a destination's marker, in metres (markers: home, then the destinations in order). */
const planeToMarker = (page: Page, index: number) =>
  page.evaluate((i) => {
    const { scene } = (window as unknown as PageWindow).__aslan;
    const plane = scene.getObjectByName('Aircraft')!;
    const markers = scene.getObjectByName('GlobeMarkers')!;
    plane.updateWorldMatrix(true, false);
    markers.updateWorldMatrix(true, false);
    const p = markers.geometry!.attributes.position;
    const V = scene.position.constructor;
    const m = new V(p.getX(i), p.getY(i), p.getZ(i)).applyMatrix4(markers.matrixWorld);
    const e = plane.matrixWorld.elements;
    return Math.hypot(e[12] - m.x, e[13] - m.y, e[14] - m.z);
  }, index);

async function open(page: Page) {
  await page.goto('/');
  await waitForStore(page);
  await page.waitForFunction(() => document.getElementById('loader')?.dataset.ready === 'true');
}

async function toDestinations(page: Page) {
  await open(page);
  await wheelTo(page, pre('destinations', 0.5));
  await expect(page.getByTestId('departures')).toBeVisible();
}

const markerIndex = (code: string) => 1 + DESTINATIONS.findIndex((d) => d.code === code);

test('the night globe shows only around the destinations chapter, with home and 14 destinations marked', async ({ page }) => {
  await open(page);
  expect((await globe(page)).visible, 'hidden at the top').toBe(false);
  await wheelTo(page, pre('destinations', 0.5));
  expect(await globe(page)).toEqual({ visible: true, markers: 15 });
  await wheelTo(page, pre('aisle', 0.3));
  expect((await globe(page)).visible, 'hidden in the aisle').toBe(false);
});

test('Lisbon is tonight’s pick; choosing Tokyo shows its flight and flies the plane there', async ({ page }) => {
  await toDestinations(page);
  const card = page.getByTestId('flight-card');
  await expect(card).toContainText('Lisbon · LIS · AS 270');
  await page.getByTestId('departures').getByRole('button', { name: /Tokyo/ }).click();
  const clicked = Date.now();
  expect(await chosen(page)).toBe('HND');
  // \s: a no-break space keeps the flight number whole
  await expect(card).toContainText(/Tokyo · HND · AS\s\d{3}/);
  await expect(card).toContainText('from $649');
  await expect.poll(() => planeToMarker(page, markerIndex('HND')), { timeout: 2200, intervals: [100] }).toBeLessThan(0.1 * GLOBE.radius);
  expect(Date.now() - clicked).toBeLessThan(2200);
});

test('a new pick in mid-flight carries on from where the plane is, never jumping', async ({ page }) => {
  await toDestinations(page);
  await page.evaluate(() => {
    const w = window as unknown as PageWindow & { __path: number[][] };
    w.__path = [];
    const plane = w.__aslan.scene.getObjectByName('Aircraft')!;
    const tick = () => {
      plane.updateWorldMatrix(true, false);
      const e = plane.matrixWorld.elements;
      w.__path.push([e[12], e[13], e[14]]);
      if (w.__path.length < 400) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  const board = page.getByTestId('departures');
  await board.getByRole('button', { name: /New York/ }).click();
  await page.waitForTimeout(400);
  await board.getByRole('button', { name: /Rome/ }).click();
  await page.waitForTimeout(2200);
  const path = await page.evaluate(() => (window as unknown as { __path: number[][] }).__path);
  let worst = 0;
  for (let i = 1; i < path.length; i++) worst = Math.max(worst, Math.hypot(...path[i].map((v, k) => v - path[i - 1][k])));
  expect(worst, `largest step ${worst.toFixed(2)} m`).toBeLessThan(0.05 * GLOBE.radius);
  expect(await chosen(page)).toBe('FCO');
  expect(await planeToMarker(page, markerIndex('FCO'))).toBeLessThan(0.1 * GLOBE.radius);
});

test('the departures board works from the keyboard and says which flight is chosen', async ({ page }) => {
  await toDestinations(page);
  const inBoard = () => page.evaluate(() => !!document.activeElement?.closest('[data-testid="departures"]'));
  for (let i = 0; i < 40 && !(await inBoard()); i++) await page.keyboard.press('Tab');
  expect(await inBoard(), 'Tab reaches the board').toBe(true);
  await page.keyboard.press('Tab');
  const row = page.locator(':focus');
  await expect(row).toHaveAttribute('aria-pressed', 'false');
  await page.keyboard.press('Enter');
  await expect(row).toHaveAttribute('aria-pressed', 'true');
  const code = await row.getAttribute('data-code');
  expect(await chosen(page)).toBe(code);
  await expect(page.getByTestId('departures').locator('[aria-pressed="true"]')).toHaveCount(1);
});

test('after a resize the labels on the globe stay on their markers and can be clicked', async ({ page }) => {
  await toDestinations(page);
  await page.setViewportSize({ width: 1000, height: 800 });
  await page.waitForTimeout(600);
  const result = await page.evaluate(() => {
    const { scene, camera } = (window as unknown as PageWindow).__aslan;
    const markers = scene.getObjectByName('GlobeMarkers')!;
    markers.updateWorldMatrix(true, false);
    const p = markers.geometry!.attributes.position;
    const V = scene.position.constructor;
    const labels = [...document.querySelectorAll<HTMLElement>('[data-testid="globe-label"][data-facing="true"]')];
    return labels.map((el) => {
      const i = Number(el.dataset.marker);
      const s = new V(p.getX(i), p.getY(i), p.getZ(i)).applyMatrix4(markers.matrixWorld).project(camera);
      const r = el.getBoundingClientRect();
      const [cx, cy] = [r.left + r.width / 2, r.top + r.height / 2];
      const hit = document.elementFromPoint(cx, cy);
      return {
        code: el.dataset.code,
        off: Math.hypot(cx - ((s.x + 1) / 2) * innerWidth, cy - ((1 - s.y) / 2) * innerHeight),
        clickable: !!hit && (hit === el || el.contains(hit)),
      };
    });
  });
  expect(result.length, 'some labels face the camera').toBeGreaterThan(5);
  for (const r of result) {
    expect(r.off, `${r.code} on its marker`).toBeLessThan(12);
    expect(r.clickable, `${r.code} clickable`).toBe(true);
  }
  const label = page.locator('[data-testid="globe-label"][data-facing="true"][data-code="VIE"]');
  await label.click();
  expect(await chosen(page)).toBe('VIE');
});

const transfer = (page: Page) => page.evaluate(() => (window as unknown as PageWindow).__aslan.store.getState().transferId);

async function toTransfer(page: Page) {
  await open(page);
  await wheelTo(page, pre('transfer', 0.75));
  await expect(page.getByRole('radiogroup', { name: 'How will you get to the airport?' })).toBeVisible();
}

test('getting to the airport: On my own at first, then a click or the arrow keys choose', async ({ page }) => {
  await toTransfer(page);
  const group = page.getByRole('radiogroup', { name: 'How will you get to the airport?' });
  await expect(group.getByRole('radio')).toHaveCount(4);
  await expect(group.getByRole('radio', { name: /On my own/ })).toHaveAttribute('aria-checked', 'true');
  const home = group.getByRole('radio', { name: /From home/ });
  await home.click();
  expect(await transfer(page)).toBe('home');
  await expect(home).toHaveAttribute('aria-checked', 'true');
  await expect(group.locator('[aria-checked="true"]')).toHaveCount(1);
  await page.keyboard.press('ArrowRight');
  const hotel = group.getByRole('radio', { name: /From your hotel/ });
  await expect(hotel).toBeFocused();
  await expect(hotel).toHaveAttribute('aria-checked', 'true');
  expect(await transfer(page)).toBe('hotel');
  await page.keyboard.press('ArrowLeft');
  await expect(home).toBeFocused();
  expect(await transfer(page)).toBe('home');
});

type Box = { x: number; y: number; width: number; height: number };
const overlaps = (a: Box, b: Box) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

for (const viewport of [
  { width: 1440, height: 800 },
  { width: 412, height: 915 },
]) {
  test(`at ${viewport.width}×${viewport.height} the transfer choices keep clear of the waiting plane and read in full`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await toTransfer(page);
    await page.waitForTimeout(700); // the choices' entrance
    const at = await progress(page);
    const aspect = viewport.width / viewport.height;
    const b = projectedBox(aircraftStage('browse', at), poseOnPreTrack(at, aspect), aspect);
    const margin = 8; // the plane's slow idle sway
    const plane = { x: b.x0 * viewport.width - margin, y: b.y0 * viewport.height - margin, width: (b.x1 - b.x0) * viewport.width + 2 * margin, height: (b.y1 - b.y0) * viewport.height + 2 * margin };
    const cards = await page.getByRole('radio').evaluateAll((els) =>
      els.map((e) => {
        const name = e.querySelector('[data-part="strip-name"]')!.getBoundingClientRect();
        const box = e.getBoundingClientRect();
        return {
          ...(box.toJSON() as { x: number; y: number; width: number; height: number }),
          open: e.getAttribute('aria-checked') === 'true',
          clipped: e.scrollWidth > e.clientWidth + 1 || e.scrollHeight > e.clientHeight + 1,
          nameInside: name.left >= box.left - 1 && name.right <= box.right + 1 && name.top >= box.top - 1 && name.bottom <= box.bottom + 1,
        };
      }),
    );
    const footer = 44;
    for (const [i, c] of cards.entries()) {
      expect(overlaps(c, plane), `card ${i} vs plane`).toBe(false);
      expect(c.x >= 0 && c.x + c.width <= viewport.width && c.y + c.height <= viewport.height - footer, `card ${i} on screen`).toBe(true);
      expect(Math.min(c.width, c.height), `card ${i} big enough to tap`).toBeGreaterThanOrEqual(44);
      if (c.open) expect(c.clipped, `the open card ${i} reads in full`).toBe(false);
      else expect(c.nameInside, `strip ${i} shows its whole name`).toBe(true);
      for (let j = i + 1; j < cards.length; j++) expect(overlaps(c, cards[j]), `cards ${i}/${j}`).toBe(false);
    }
  });
}

const width = (page: Page, name: RegExp) => page.getByRole('radio', { name }).evaluate((e) => e.getBoundingClientRect().width);

test('hovering a strip opens it; leaving shows the chosen one again', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 800 });
  await toTransfer(page);
  await page.waitForTimeout(700);
  await page.getByRole('radio', { name: /From home/ }).hover();
  await page.waitForTimeout(700);
  expect(await width(page, /From home/)).toBeGreaterThan(2 * (await width(page, /From your hotel/)));
  await page.mouse.move(1000, 760);
  await page.waitForTimeout(700);
  const own = await width(page, /On my own/);
  for (const other of [/From home/, /From your hotel/, /Airport express/]) expect(own).toBeGreaterThan(await width(page, other));
});

test('the chosen card shows its price, its times and Selected', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 800 });
  await toTransfer(page);
  await page.waitForTimeout(700);
  const home = page.getByRole('radio', { name: /From home/ });
  await home.click();
  await page.mouse.move(1000, 760);
  await page.waitForTimeout(700);
  // tonight's pick, Lisbon, departs 22:40
  for (const text of ['$24', '19:40', '20:40', '22:40']) await expect(home).toContainText(text);
  await expect(page.getByText('Selected ✓', { exact: true })).toBeVisible();
  const own = page.getByRole('radio', { name: /On my own/ });
  await own.click();
  await page.mouse.move(1000, 760);
  await page.waitForTimeout(700);
  await expect(own).toContainText('Free');
  await expect(own).toContainText('22:00');
});

test.describe('transfer on a phone', () => {
  test.use({ viewport: { width: 412, height: 915 }, hasTouch: true });

  test('the cards stack in order and the chosen one is the tallest', async ({ page }) => {
    await toTransfer(page);
    await page.waitForTimeout(700);
    const boxes = () => page.getByRole('radio').evaluateAll((els) => els.map((e) => e.getBoundingClientRect().toJSON() as { y: number; height: number }));
    const before = await boxes();
    for (let i = 1; i < before.length; i++) expect(before[i].y).toBeGreaterThan(before[i - 1].y);
    await page.getByRole('radio', { name: /From your hotel/ }).tap();
    await page.waitForTimeout(700);
    expect(await transfer(page)).toBe('hotel');
    const after = await boxes();
    expect(after[1].height).toBe(Math.max(...after.map((b) => b.height)));
    expect(after[1].height).toBeGreaterThan(after[0].height * 2);
  });
});

/** Puts the scroll position straight into the store (exact, unlike the wheel) and lets two frames draw it. */
async function showAt(page: Page, id: 'ready', t: number) {
  await page.evaluate(
    ([id, t]) =>
      new Promise<void>((done) => {
        (window as unknown as PageWindow).__aslan.store.getState().setProgress(__pre(id as 'ready', t as number));
        requestAnimationFrame(() => requestAnimationFrame(() => done()));
      }),
    [id, t] as const,
  );
}

test('ready: the promise lights up word by word, all of it by the end, with opacity alone', async ({ page }) => {
  await open(page);
  await wheelTo(page, pre('ready', 0.05));
  const words = page.getByTestId('ready').locator('[data-part="word"]');
  const total = await words.count();
  expect(total).toBeGreaterThan(15);
  const lit = () => words.evaluateAll((els) => els.filter((e) => Number(getComputedStyle(e.lastElementChild!).opacity) > 0.95).length);
  const counts: number[] = [];
  for (let t = 0.1; t <= 0.901; t += 0.1) {
    await showAt(page, 'ready', t);
    counts.push(await lit());
  }
  for (let i = 1; i < counts.length; i++) expect(counts[i], counts.join(',')).toBeGreaterThanOrEqual(counts[i - 1]);
  expect(counts[0]).toBeLessThan(total / 4);
  await showAt(page, 'ready', 0.95);
  expect(await lit()).toBe(total);
  await expect(page.getByTestId('ready').locator('h2')).toHaveText('Ready to choose your seat?');
  const props = await page.getByTestId('ready').evaluate((el) =>
    el.getAnimations({ subtree: true }).flatMap((a) =>
      (a.effect as KeyframeEffect).getKeyframes().flatMap((k) => Object.keys(k).filter((x) => !['offset', 'easing', 'composite', 'computedOffset'].includes(x))),
    ),
  );
  // visibility only switches at the end of a fade (so hidden words take no focus); it never moves anything
  expect(props.every((p) => p === 'transform' || p === 'opacity' || p === 'visibility'), props.join(',')).toBe(true);
});

test('ready: door 1L glows warm in its doorway as it comes ajar', async ({ page }) => {
  await open(page);
  await wheelTo(page, pre('ready', 0.5));
  await showAt(page, 'ready', 0.9);
  await page.addStyleTag({ content: 'body > *:not(.stage), nextjs-portal { visibility: hidden !important; }' });
  await page.waitForTimeout(300);
  // the door's rectangle on screen, from its outline in the aircraft's frame
  const door = await page.evaluate(() => {
    const { scene, camera } = (window as unknown as PageWindow).__aslan;
    const plane = scene.getObjectByName('Aircraft')!;
    plane.updateWorldMatrix(true, false);
    const V = scene.position.constructor;
    const xs: number[] = [];
    const ys: number[] = [];
    for (const [x, y] of [[13.49, -0.4], [14.31, -0.4], [13.49, 1.45], [14.31, 1.45]]) {
      const p = new V(x, y, -1.79).applyMatrix4(plane.matrixWorld).project(camera);
      xs.push(((p.x + 1) / 2) * innerWidth);
      ys.push(((1 - p.y) / 2) * innerHeight);
    }
    return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
  });
  const pad = { x: (door.x1 - door.x0) * 0.8, y: (door.y1 - door.y0) * 0.5 };
  const clip = { x: door.x0 - pad.x, y: door.y0 - pad.y, width: door.x1 - door.x0 + 2 * pad.x, height: door.y1 - door.y0 + 2 * pad.y };
  const png = (await page.screenshot({ clip })).toString('base64');
  const r = await page.evaluate(
    async ([src, inner]) => {
      const img = new Image();
      img.src = `data:image/png;base64,${src}`;
      await img.decode();
      const c = document.createElement('canvas');
      [c.width, c.height] = [img.width, img.height];
      const ctx = c.getContext('2d')!;
      ctx.drawImage(img, 0, 0);
      const d = ctx.getImageData(0, 0, c.width, c.height).data;
      let [inSum, inN, outSum, outN] = [0, 0, 0, 0];
      for (let y = 0; y < c.height; y++)
        for (let x = 0; x < c.width; x++) {
          const i = (y * c.width + x) * 4;
          const l = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
          const inside = x >= inner.x && x < inner.x + inner.w && y >= inner.y && y < inner.y + inner.h;
          if (inside) [inSum, inN] = [inSum + l, inN + 1];
          else [outSum, outN] = [outSum + l, outN + 1];
        }
      return { door: inSum / inN, around: outSum / outN };
    },
    [png, { x: pad.x, y: pad.y, w: door.x1 - door.x0, h: door.y1 - door.y0 }] as const,
  );
  console.log('doorway glow', JSON.stringify(r));
  expect(r.door - r.around).toBeGreaterThanOrEqual(20);
});

type PassWindow = {
  __aslan: {
    scene: { getObjectByName(name: string): { material: { map: { userData: { lines?: string[] } } } } | undefined };
    store: {
      getState(): {
        phase: string;
        progress: number;
        destinationId: string;
        transferId: string;
        seats: { id: string; status: string }[];
        setProgress(p: number): void;
        sit(id: string): boolean;
        confirm(): void;
      };
    };
  };
};

test('the pass carries the route, the flight and the transfer; once confirmed they are fixed; Start again resets them', async ({ page }) => {
  await toDestinations(page);
  await page.getByTestId('departures').getByRole('button', { name: /Tokyo/ }).click();
  await wheelTo(page, pre('transfer', 0.75));
  await page.getByRole('radiogroup', { name: 'How will you get to the airport?' }).getByRole('radio', { name: /From home/ }).click();
  await page.evaluate(() => {
    const s = (window as unknown as PassWindow).__aslan.store.getState();
    s.setProgress(__pre('aisle', 0.27));
    const free = s.seats.find((x) => x.status === 'free')!;
    s.sit(free.id);
    s.confirm();
  });
  const tokyo = DESTINATIONS.find((d) => d.code === 'HND')!;
  await expect
    .poll(() => page.evaluate(() => (window as unknown as PassWindow).__aslan.scene.getObjectByName('BoardingPassFront')?.material.map.userData.lines?.join(' | ') ?? ''))
    .toContain('HND');
  const lines = await page.evaluate(() => (window as unknown as PassWindow).__aslan.scene.getObjectByName('BoardingPassFront')!.material.map.userData.lines!);
  expect(lines).toEqual(expect.arrayContaining(['ODS', 'HND', 'Odesa', 'Tokyo', tokyo.flight, tokyo.departs, 'From home · 18:20']));
  // fixed now: the header cannot take the visitor back to change them
  await expect(page.getByRole('navigation', { name: 'Sections' }).getByRole('button', { name: 'Destinations' })).toBeDisabled();
  await expect(page.getByRole('navigation', { name: 'Sections' }).getByRole('button', { name: 'Transfer' })).toBeDisabled();
  await page.evaluate(() => (window as unknown as PassWindow).__aslan.store.getState().setProgress(0.95));
  await page.getByRole('button', { name: 'Start again' }).first().click();
  await expect.poll(() => page.evaluate(() => {
    const s = (window as unknown as PassWindow).__aslan.store.getState();
    return [s.phase, s.destinationId, s.transferId, s.progress < 0.01];
  })).toEqual(['browse', 'LIS', 'own', true]);
  await expect(page.getByTestId('hero')).toBeVisible();
});

/** The plane's outline in its own frame (as in stage.ts), to follow it on screen frame by frame. */
const OUTLINE = [
  [18.8, -0.2, 0], [-19, 0.9, 0], [-15.6, 7.8, 0], [-4, 2.3, -17.84], [-4, 2.3, 17.84],
  [-16.5, 1.1, -6.21], [-16.5, 1.1, 6.21], [4.5, -3.48, -5.75], [4.5, -3.48, 5.75], [0, 2.1, 0], [0, -2.04, 0],
];

/** Starts recording, every frame: the scroll position and the plane's visible box on screen (cut to the frame). */
const record = (page: Page) =>
  page.evaluate((outline) => {
    type W = PageWindow & { __frames: { p: number; box: number[] | null }[]; __recording: boolean };
    const w = window as unknown as W;
    w.__frames = [];
    w.__recording = true;
    const { scene, camera, store } = w.__aslan;
    const plane = scene.getObjectByName('Aircraft')!;
    const V = scene.position.constructor;
    const tick = () => {
      plane.updateWorldMatrix(true, false);
      const pts = outline.map(([x, y, z]) => new V(x, y, z).applyMatrix4(plane.matrixWorld).project(camera));
      const front = pts.filter((q) => q.z < 1);
      let box: number[] | null = null;
      if (front.length === pts.length) {
        const xs = front.map((q) => Math.min(1, Math.max(0, (q.x + 1) / 2)));
        const ys = front.map((q) => Math.min(1, Math.max(0, (1 - q.y) / 2)));
        const b = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
        if (b[2] > b[0] && b[3] > b[1]) box = b;
      }
      w.__frames.push({ p: store.getState().progress, box });
      if (w.__recording) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, OUTLINE);

const stopRecording = (page: Page) =>
  page.evaluate(() => {
    const w = window as unknown as { __frames: { p: number; box: number[] | null }[]; __recording: boolean };
    w.__recording = false;
    return w.__frames;
  });

test('a header jump from the aisle to Destinations and back moves the plane on screen without a jump', async ({ page }) => {
  await open(page);
  const header = page.getByRole('navigation', { name: 'Sections' });
  await header.getByRole('button', { name: 'Cabin' }).click();
  await expect.poll(() => progress(page), { timeout: 10_000 }).toBeGreaterThan(pre('aisle', 0) - 0.001);
  await page.waitForTimeout(800);
  for (const [to, until] of [
    ['Destinations', () => progress(page).then((p) => Math.abs(p - pre('destinations', 0.4)) < 0.002)],
    ['Cabin', () => progress(page).then((p) => p >= pre('aisle', 0) - 0.001)],
  ] as const) {
    await record(page);
    await header.getByRole('button', { name: to }).click();
    await expect.poll(until, { timeout: 15_000 }).toBe(true);
    await page.waitForTimeout(500);
    const frames = await stopRecording(page);
    // outside the cabin only: inside it the plane's outline surrounds the camera
    const outside = (p: number) => p < pre('door', 0.3);
    // a fast scroll moves it far in a frame; a jump would move it far for little scroll: judge the move per vh
    // scrolled (at least one), as the unit tests do — 2.73 %/vh — with room for the frame sampling
    const trackVh = TRACKS.pre.reduce((sum, c) => sum + c.heightVh, 0);
    let worst = 0;
    let at = '';
    let shown = 0;
    for (let i = 1; i < frames.length; i++) {
      const [a, b] = [frames[i - 1], frames[i]];
      if (!outside(a.p) || !outside(b.p) || !a.box || !b.box) continue;
      shown++;
      const moved = Math.max(...a.box.map((v, k) => Math.abs(v - b.box![k]))) / Math.max(1, Math.abs(b.p - a.p) * trackVh);
      if (moved > worst) [worst, at] = [moved, `${a.p.toFixed(4)} → ${b.p.toFixed(4)}: ${a.box.map((v) => v.toFixed(2))} → ${b.box.map((v) => v.toFixed(2))}`];
    }
    console.log(`${to}: ${frames.length} frames, worst ${(worst * 100).toFixed(2)} %/vh at ${at}`);
    expect(shown, `${to}: the plane was on screen on the way`).toBeGreaterThan(5);
    expect(worst, `${to}: largest move per vh scrolled`).toBeLessThan(0.06);
  }
});

test.describe('on a phone', () => {
  test.use({ viewport: { width: 412, height: 915 }, hasTouch: true });

  test('every chapter of the journey fits the screen, and a destination is a tap away', async ({ page }) => {
    await open(page);
    for (const [id, t, section] of [
      ['sky', 0, 'hero'],
      ['destinations', 0.45, 'departures'],
      ['transfer', 0.75, null],
      ['ready', 0.6, 'ready'],
    ] as const) {
      await page.evaluate(([id, t]) => (window as unknown as PageWindow).__aslan.store.getState().setProgress(__pre(id as 'sky', t as number)), [id, t] as const);
      await page.waitForTimeout(900);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${id}: no sideways scroll`).toBe(true);
      // every heading of the chapter on screen, whole
      const headings = await page.locator('h1:visible, h2:visible').evaluateAll((els) =>
        els.map((e) => {
          const r = e.getBoundingClientRect();
          return { text: e.textContent, inside: r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight };
        }),
      );
      expect(headings.length, `${id}: a heading shows`).toBeGreaterThan(0);
      for (const h of headings) expect(h.inside, `${id}: "${h.text}" on screen`).toBe(true);
      if (section) await expect(page.getByTestId(section)).toBeVisible();
    }
    await page.evaluate(() => (window as unknown as PageWindow).__aslan.store.getState().setProgress(__pre('destinations', 0.45)));
    await page.waitForTimeout(900);
    await page.getByTestId('departures').getByRole('button', { name: /Tokyo/ }).tap();
    expect(await chosen(page)).toBe('HND');
    await expect(page.getByTestId('flight-card')).toContainText('Tokyo');
  });
});

/** The globe's turn (its quaternion) and where its centre and rim fall on screen (CSS pixels). */
const globeOnScreen = (page: Page) =>
  page.evaluate((centre) => {
    const { scene, camera } = (window as unknown as PageWindow).__aslan;
    const g = scene.getObjectByName('Globe') as unknown as { quaternion: { x: number; y: number; z: number; w: number } };
    const V = scene.position.constructor;
    const c = new V(centre[0], centre[1], centre[2]).project(camera);
    return { q: [g.quaternion.x, g.quaternion.y, g.quaternion.z, g.quaternion.w], x: ((c.x + 1) / 2) * innerWidth, y: ((1 - c.y) / 2) * innerHeight };
  }, GLOBE.center.toArray());

test('the globe spins under the mouse, carrying the plane and the labels with it; dragging off it does nothing', async ({ page }) => {
  await toDestinations(page);
  const before = await globeOnScreen(page);
  // off the globe: the empty dark above it
  await page.mouse.move(before.x, 90);
  await page.mouse.down();
  await page.mouse.move(before.x + 200, 120, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(300);
  expect((await globeOnScreen(page)).q).toEqual(before.q);
  // on it — held still a moment before letting go, so it does not coast on
  await page.mouse.move(before.x - 60, before.y);
  await page.mouse.down();
  await page.mouse.move(before.x + 140, before.y + 30, { steps: 12 });
  await page.waitForTimeout(200);
  await page.mouse.up();
  await page.waitForTimeout(600);
  const after = await globeOnScreen(page);
  const turned = Math.acos(Math.min(1, Math.abs(after.q.reduce((sum, v, i) => sum + v * before.q[i], 0)))) * 2;
  expect(turned, 'turned by the drag').toBeGreaterThan(0.3);
  // the plane still waits over home (the first marker), and the facing labels still sit on their markers
  expect(await planeToMarker(page, 0)).toBeLessThan(0.1 * GLOBE.radius);
  const offsets = await page.evaluate(() => {
    const { scene, camera } = (window as unknown as PageWindow).__aslan;
    const markers = scene.getObjectByName('GlobeMarkers')!;
    markers.updateWorldMatrix(true, false);
    const p = markers.geometry!.attributes.position;
    const V = scene.position.constructor;
    return [...document.querySelectorAll<HTMLElement>('[data-testid="globe-label"][data-facing="true"]')].map((el) => {
      const i = Number(el.dataset.marker);
      const s = new V(p.getX(i), p.getY(i), p.getZ(i)).applyMatrix4(markers.matrixWorld).project(camera);
      const r = el.getBoundingClientRect();
      return Math.hypot(r.left + r.width / 2 - ((s.x + 1) / 2) * innerWidth, r.top + r.height / 2 - ((1 - s.y) / 2) * innerHeight);
    });
  });
  expect(offsets.length).toBeGreaterThan(3);
  for (const off of offsets) expect(off).toBeLessThan(12);
  // a pick turns it on from there to face the new flight
  await page.getByTestId('departures').getByRole('button', { name: /Rome/ }).click();
  await page.waitForTimeout(2000);
  expect(await planeToMarker(page, markerIndex('FCO'))).toBeLessThan(0.1 * GLOBE.radius);
});

test('a fling of the globe coasts on, then comes to rest', async ({ page }) => {
  await toDestinations(page);
  const start = await globeOnScreen(page);
  const angle = (a: number[], b: number[]) => Math.acos(Math.min(1, Math.abs(a.reduce((sum, v, i) => sum + v * b[i], 0)))) * 2;
  await page.mouse.move(start.x - 80, start.y);
  await page.mouse.down();
  await page.mouse.move(start.x + 80, start.y, { steps: 6 });
  await page.mouse.up();
  const released = (await globeOnScreen(page)).q;
  await page.waitForTimeout(1500);
  const later = (await globeOnScreen(page)).q;
  await page.waitForTimeout(500);
  const rest = (await globeOnScreen(page)).q;
  expect(angle(released, later), 'coasted on after letting go').toBeGreaterThan(0.05);
  expect(angle(released, later), 'not far: the fling is capped').toBeLessThan(Math.PI / 2);
  expect(angle(later, rest), 'at rest').toBeLessThan(0.01);
});

