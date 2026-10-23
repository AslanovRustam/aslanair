import { expect, test, type Page } from '@playwright/test';
import { DESTINATIONS } from '@/experience/destinations';
import { GLOBE } from '@/experience/globe';
import { pre, waitForStore, wheelTo } from './helpers';

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
    store: { getState(): { destinationId: string } };
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
