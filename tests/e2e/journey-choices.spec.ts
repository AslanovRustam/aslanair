import { expect, test, type Page } from '@playwright/test';
import { poseOnPreTrack } from '@/experience/cameraPoses';
import { DESTINATIONS } from '@/experience/destinations';
import { GLOBE } from '@/experience/globe';
import { aircraftStage, projectedBox } from '@/experience/stage';
import { loaderGone, pre, progress, waitForStore, wheelTo } from './helpers';

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

/** Which transfer card is open (its slot's data-id). */
const openCard = (page: Page) => page.locator('[data-open="true"][data-id]').getAttribute('data-id');
const toTransferAt = (page: Page, t: number) =>
  page.evaluate((p) => (window as unknown as PageWindow).__aslan.store.getState().setProgress(p), pre('transfer', t));
const PREVIEWED = [
  [0.25, 'home'],
  [0.45, 'hotel'],
  [0.6, 'express'],
  [0.8, 'own'],
] as const;

test('scrolling through Transfer opens each card in turn without choosing it', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 800 });
  await open(page);
  await loaderGone(page);
  await page.mouse.move(1430, 790); // off the cards
  for (const [t, id] of PREVIEWED) {
    await toTransferAt(page, t);
    await expect.poll(() => openCard(page), { message: `at ${t}` }).toBe(id);
    expect(await transfer(page), 'the preview chooses nothing').toBe('own');
  }
});

for (const viewport of [
  { width: 1440, height: 800 },
  { width: 412, height: 915 },
]) {
  test(`at ${viewport.width}×${viewport.height} a card the scroll opens offers itself: Choose ↗ on its plate, lifted clear of its neighbour (spec r5 §5)`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await open(page);
    await loaderGone(page);
    await page.mouse.move(viewport.width - 10, viewport.height - 10); // off the cards
    await toTransferAt(page, 0.45);
    await expect.poll(() => openCard(page)).toBe('hotel');
    const hotel = page.locator('[data-id="hotel"]');
    const plate = hotel.locator(':scope > span');
    await expect(plate).toHaveText('Choose ↗');
    await expect.poll(() => plate.evaluate((e) => getComputedStyle(e).opacity), { message: 'the plate shows' }).toBe('1');
    const lifted = () =>
      page.evaluate(() => {
        const slot = document.querySelector('[data-id="hotel"]')!;
        const above = document.querySelector('[data-id="home"]')!.getBoundingClientRect();
        const card = slot.querySelector('button')!.getBoundingClientRect();
        const narrow = above.bottom <= card.top + card.height / 2; // the cards stack
        const footer = document.querySelector('footer')!.getBoundingClientRect().top;
        const lowest = Math.max(...[...document.querySelectorAll('[data-id] > button')].map((b) => b.getBoundingClientRect().bottom));
        return { off: Math.round(slot.getBoundingClientRect().top - card.top), clear: narrow ? card.top >= above.bottom - 1 : true, aboveFooter: lowest <= footer };
      });
    await expect.poll(async () => (await lifted()).off, { message: 'lifted off its plate' }).toBeGreaterThan(20);
    await page.waitForTimeout(500); // the stack's settle
    expect((await lifted()).clear, 'clear of the card above').toBe(true);
    expect((await lifted()).aboveFooter, 'every card above the footer').toBe(true);
  });
}

test('once a card is picked, scrolling keeps it open', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 800 });
  await open(page);
  await loaderGone(page);
  await toTransferAt(page, 0.25);
  await page.getByRole('radio', { name: /From your hotel/ }).click();
  await page.mouse.move(1430, 790);
  for (const [t] of PREVIEWED) {
    await toTransferAt(page, t);
    await page.waitForTimeout(150);
    expect(await openCard(page), `at ${t}`).toBe('hotel');
  }
});

test('a tap on a phone picks the card and stops the preview', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 412, height: 915 }, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  await open(page);
  await loaderGone(page);
  await toTransferAt(page, 0.25);
  await page.getByRole('radio', { name: /Airport express/ }).tap();
  for (const [t] of PREVIEWED) {
    await toTransferAt(page, t);
    await page.waitForTimeout(150);
    expect(await openCard(page), `at ${t}`).toBe('express');
  }
  await context.close();
});

test('arriving by the rail mid-chapter shows that point’s card, and an earlier pick still holds', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 800 });
  await open(page);
  await loaderGone(page);
  const rail = page.getByRole('navigation', { name: 'Chapters' });
  await rail.getByRole('button', { name: /Transfer/ }).click();
  await page.waitForFunction(() => !document.documentElement.dataset.curtain, null, { timeout: 8000 });
  await page.mouse.move(1430, 790);
  await expect.poll(() => openCard(page)).toBe('own'); // the rail lands at 0.7, the preview's fourth card
  await page.getByRole('radio', { name: /From home/ }).click();
  await rail.getByRole('button', { name: /Destinations/ }).click();
  await page.waitForFunction(() => !document.documentElement.dataset.curtain, null, { timeout: 8000 });
  await rail.getByRole('button', { name: /Transfer/ }).click();
  await page.waitForFunction(() => !document.documentElement.dataset.curtain, null, { timeout: 8000 });
  await page.mouse.move(1430, 790);
  await expect.poll(() => openCard(page)).toBe('home');
});

test('Start again brings the preview back', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 800 });
  await open(page);
  await loaderGone(page);
  await toTransferAt(page, 0.25);
  await page.getByRole('radio', { name: /From home/ }).click();
  await page.evaluate(() => {
    const s = (window as unknown as { __aslan: { store: { getState(): { setProgress(p: number): void; seats: { id: string; status: string }[]; sit(id: string): boolean; confirm(): void; restart(): void } } } }).__aslan.store.getState();
    s.setProgress(__pre('aisle', 0.27));
    s.seats.find((x) => x.id === '14F')!.status = 'free';
    s.sit('14F');
    s.confirm();
    s.setProgress(0.9);
  });
  // the real Start again: through the curtain, focus on the hero's heading after it
  await page.getByRole('button', { name: 'Start again' }).first().click();
  await page.waitForFunction(() => !!document.documentElement.dataset.curtain); // the curtain has begun
  await page.waitForFunction(() => !document.documentElement.dataset.curtain, null, { timeout: 8000 });
  await page.mouse.move(1430, 790);
  await toTransferAt(page, 0.45);
  await expect.poll(() => openCard(page)).toBe('hotel');
  expect(await transfer(page)).toBe('own');
});

test('no transfer card ever tilts', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 800 });
  await open(page);
  await loaderGone(page);
  await toTransferAt(page, 0.25);
  for (const name of [/From home/, /From your hotel/, /Airport express/, /On my own/]) {
    const card = page.getByRole('radio', { name });
    await card.hover();
    await page.waitForTimeout(450); // the lift's transition
    const m = await card.evaluate((e) => new DOMMatrix(getComputedStyle(e).transform));
    expect([Math.abs(m.b) < 1e-6, Math.abs(m.c) < 1e-6], `${name}`).toEqual([true, true]);
  }
});

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

test('under reduced motion a hovered card neither lifts nor tilts; the keyboard focus ring sits inside the card', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 1440, height: 800 });
  await toTransfer(page);
  await page.waitForTimeout(700);
  const home = page.getByRole('radio', { name: /From home/ });
  await home.hover();
  await page.waitForTimeout(300);
  expect(await home.evaluate((e) => getComputedStyle(e).transform)).toBe('none');
  // the row clips what spills over it, so the ring must not stand outside the card
  await page.getByRole('radio', { name: /On my own/ }).focus();
  await page.keyboard.press('ArrowLeft');
  const ring = await page.evaluate(() => {
    const e = document.activeElement as HTMLElement;
    return { name: e.getAttribute('aria-label') ?? e.textContent, visible: e.matches(':focus-visible'), offset: parseFloat(getComputedStyle(e).outlineOffset) };
  });
  expect(ring.visible, String(ring.name)).toBe(true);
  expect(ring.offset).toBeLessThan(0);
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

test('the Ready words are larger: about 1.3 × at 1440×800 (spec r5 §6)', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 800 });
  await open(page);
  await loaderGone(page);
  await showAt(page, 'ready', 0.5);
  const sizes = await page.getByTestId('ready').evaluate((el) => ({
    title: parseFloat(getComputedStyle(el.querySelector('h2')!).fontSize),
    promise: parseFloat(getComputedStyle(el.querySelector('p')!).fontSize),
  }));
  // before: 72 px and 33.6 px
  expect(sizes.title).toBeGreaterThanOrEqual(1.25 * 72);
  expect(sizes.promise).toBeGreaterThanOrEqual(1.25 * 33.6);
});

for (const viewport of [
  { width: 1440, height: 800 },
  { width: 1280, height: 720 },
]) {
  test(`at ${viewport.width}×${viewport.height} the Ready words stay left of the plane while it is far`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await open(page);
    await loaderGone(page);
    const aspect = viewport.width / viewport.height;
    for (const t of [0.3, 0.5]) {
      await showAt(page, 'ready', t);
      await page.waitForTimeout(700); // the words' entrance
      const at = await progress(page);
      const b = projectedBox(aircraftStage('browse', at, undefined, aspect), poseOnPreTrack(at, aspect), aspect);
      const plane = { x: b.x0 * viewport.width, y: b.y0 * viewport.height, width: (b.x1 - b.x0) * viewport.width, height: (b.y1 - b.y0) * viewport.height };
      const words = await page.getByTestId('ready').locator('[class*="words"]').evaluate((e) => e.getBoundingClientRect().toJSON() as Box);
      expect(overlaps(words, plane), `ready ${t}`).toBe(false);
    }
  });
}

test('on a phone the Ready words fit the screen', async ({ page }) => {
  await page.setViewportSize({ width: 412, height: 915 });
  await open(page);
  await loaderGone(page);
  await showAt(page, 'ready', 0.5);
  await page.waitForTimeout(700);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(412);
  const words = await page.getByTestId('ready').locator('[class*="words"]').evaluate((e) => e.getBoundingClientRect().toJSON() as Box);
  expect(words.x).toBeGreaterThanOrEqual(0);
  expect(words.x + words.width).toBeLessThanOrEqual(412);
});

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

/** Mean luminance of a screenshot's pixels around given points (a 5 × 5 patch each), and the light's centroid in a box. */
async function doorLight(page: Page, ring: { x: number; y: number }[], grown: { x: number; y: number }[], box: { x: number; y: number; width: number; height: number }) {
  const png = (await page.screenshot({ clip: box })).toString('base64');
  return page.evaluate(
    async ([src, ringPts, grownPts, origin]) => {
      const img = new Image();
      img.src = `data:image/png;base64,${src}`;
      await img.decode();
      const c = document.createElement('canvas');
      [c.width, c.height] = [img.width, img.height];
      const ctx = c.getContext('2d')!;
      ctx.drawImage(img, 0, 0);
      const d = ctx.getImageData(0, 0, c.width, c.height).data;
      const lum = (x: number, y: number) => {
        const i = (Math.round(y) * c.width + Math.round(x)) * 4;
        return 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
      };
      const patch = (pts: { x: number; y: number }[]) => {
        let [sum, n] = [0, 0];
        for (const p of pts)
          for (let dy = -2; dy <= 2; dy++)
            for (let dx = -2; dx <= 2; dx++) {
              const [x, y] = [p.x - origin.x + dx, p.y - origin.y + dy];
              if (x >= 0 && y >= 0 && x < c.width && y < c.height) [sum, n] = [sum + lum(x, y), n + 1];
            }
        return sum / Math.max(1, n);
      };
      // the light: what stands out over the box's median
      const all: number[] = [];
      for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) all.push(lum(x, y));
      const median = [...all].sort((p, q) => p - q)[Math.floor(all.length / 2)];
      let [wx, wy, w] = [0, 0, 0];
      for (let y = 0; y < c.height; y++)
        for (let x = 0; x < c.width; x++) {
          const e = Math.max(0, all[y * c.width + x] - median);
          [wx, wy, w] = [wx + e * x, wy + e * y, w + e];
        }
      return { ring: patch(ringPts), grown: patch(grownPts), centroid: { x: origin.x + wx / w, y: origin.y + wy / w } };
    },
    [png, ring, grown, { x: box.x, y: box.y }] as const,
  );
}

test("door 1L's warm light hugs its outline from every angle of the approach", async ({ page }) => {
  await open(page);
  await wheelTo(page, pre('ready', 0.5));
  // the scene alone: the page's words, the grid behind the see-through canvas and the dev badge would count as light
  await page.addStyleTag({ content: 'body > *:not(.stage), nextjs-portal, [data-testid="grid"] { visibility: hidden !important; }' });
  for (const [id, t] of [['ready', 0.9], ['door', 0.08], ['door', 0.16]] as const) {
    await showAt(page, id as 'ready', t);
    await page.waitForTimeout(400);
    // the door's outline on the skin: its painted seam, projected to the screen
    const seam = await page.evaluate(() => {
      const { scene, camera } = (window as unknown as PageWindow).__aslan;
      const ring = scene.getObjectByName('Door1LSeam')!;
      ring.updateWorldMatrix(true, false);
      const pos = ring.geometry!.attributes.position;
      const V = scene.position.constructor;
      const pts: { x: number; y: number }[] = [];
      for (let i = 0; i < pos.count; i += 2) {
        const p = new V(pos.getX(i), pos.getY(i), pos.getZ(i)).applyMatrix4(ring.matrixWorld).project(camera);
        pts.push({ x: ((p.x + 1) / 2) * innerWidth, y: ((1 - p.y) / 2) * innerHeight });
      }
      return pts;
    });
    const xs = seam.map((p) => p.x);
    const ys = seam.map((p) => p.y);
    const centre = { x: (Math.min(...xs) + Math.max(...xs)) / 2, y: (Math.min(...ys) + Math.max(...ys)) / 2 };
    const size = { w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
    // ~0.35 m outside the outline: 40 % further from the door's centre than the seam
    const grown = seam.map((p) => ({ x: centre.x + (p.x - centre.x) * 1.4, y: centre.y + (p.y - centre.y) * 1.4 }));
    const box = { x: Math.round(centre.x - size.w), y: Math.round(centre.y - size.h * 0.9), width: Math.round(size.w * 2), height: Math.round(size.h * 1.8) };
    const r = await doorLight(page, seam, grown, box);
    console.log(`door light at ${id} ${t}`, JSON.stringify({ ring: r.ring.toFixed(1), grown: r.grown.toFixed(1), centroid: r.centroid, centre }));
    expect(r.ring - r.grown, `${id} ${t}: the light hugs the outline`).toBeGreaterThanOrEqual(15);
    expect(Math.abs(r.centroid.x - centre.x), `${id} ${t}: centred on the door`).toBeLessThanOrEqual(0.12 * size.w);
  }
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

/** Starts recording, every frame: the scroll position and the curtain's stage. */
const record = (page: Page) =>
  page.evaluate(() => {
    type W = PageWindow & { __frames: { p: number; curtain: string }[]; __recording: boolean };
    const w = window as unknown as W;
    w.__frames = [];
    w.__recording = true;
    const tick = () => {
      w.__frames.push({ p: w.__aslan.store.getState().progress, curtain: document.documentElement.dataset.curtain ?? '' });
      if (w.__recording) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });

const stopRecording = (page: Page) =>
  page.evaluate(() => {
    const w = window as unknown as { __frames: { p: number; curtain: string }[]; __recording: boolean };
    w.__recording = false;
    return w.__frames;
  });

test('a header jump to Destinations and back happens under the curtain', async ({ page }) => {
  await open(page);
  const header = page.getByRole('navigation', { name: 'Sections' });
  await header.getByRole('button', { name: 'Cabin' }).click();
  await expect.poll(() => progress(page), { timeout: 10_000 }).toBeGreaterThan(pre('aisle', 0) - 0.001);
  await page.waitForFunction(() => !document.documentElement.dataset.curtain, null, { timeout: 5000 });
  for (const [to, until] of [
    ['Destinations', () => progress(page).then((p) => Math.abs(p - pre('destinations', 0.4)) < 0.002)],
    ['Cabin', () => progress(page).then((p) => p >= pre('aisle', 0) - 0.001)],
  ] as const) {
    await record(page);
    await header.getByRole('button', { name: to }).click();
    await expect.poll(until, { timeout: 15_000 }).toBe(true);
    await page.waitForFunction(() => !document.documentElement.dataset.curtain, null, { timeout: 5000 });
    const frames = await stopRecording(page);
    // the visitor never sees the page move: every jump of the scroll is behind the closed curtain
    let jumps = 0;
    for (let i = 1; i < frames.length; i++) {
      if (Math.abs(frames[i].p - frames[i - 1].p) <= 0.005) continue;
      jumps++;
      expect(frames[i].curtain, `${to}: frame ${i}, ${frames[i - 1].p.toFixed(3)} → ${frames[i].p.toFixed(3)}`).toBe('covered');
    }
    expect(jumps, `${to}: it jumped`).toBeGreaterThan(0);
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

