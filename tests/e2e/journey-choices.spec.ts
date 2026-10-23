import { expect, test, type Page } from '@playwright/test';
import { poseOnPreTrack } from '@/experience/cameraPoses';
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
    store: { getState(): { destinationId: string; transferId: string } };
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
  await expect(card).toContainText(/Tokyo · HND · AS \d{3}/);
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
      els.map((e) => ({ ...(e.getBoundingClientRect().toJSON() as { x: number; y: number; width: number; height: number }), clipped: e.scrollWidth > e.clientWidth + 1 || e.scrollHeight > e.clientHeight + 1 })),
    );
    const footer = 44;
    for (const [i, c] of cards.entries()) {
      expect(overlaps(c, plane), `card ${i} vs plane`).toBe(false);
      expect(c.x >= 0 && c.x + c.width <= viewport.width && c.y + c.height <= viewport.height - footer, `card ${i} on screen`).toBe(true);
      expect(c.height, `card ${i} tall enough to tap`).toBeGreaterThanOrEqual(44);
      expect(c.clipped, `card ${i} text in full`).toBe(false);
      for (let j = i + 1; j < cards.length; j++) expect(overlaps(c, cards[j]), `cards ${i}/${j}`).toBe(false);
    }
  });
}

