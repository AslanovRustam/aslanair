import { expect, test } from '@playwright/test';
import { seatWorldPosition, type SeatLetter } from '@/experience/geometry';
import { highlightState, scanForHoveredSeat, settledProgress, waitForAircraft, waitForStore } from './helpers';

type Node = { count?: number };
type SceneWindow = Window & { __aslan: { scene?: { getObjectByName(n: string): Node | undefined } } };

test('seats are the kit model, one instance per seat', async ({ page }) => {
  await page.goto('/');
  await waitForStore(page);
  await waitForAircraft(page);
  await page.waitForFunction(() => !!(window as unknown as SceneWindow).__aslan.scene?.getObjectByName('SeatFabric'));
  const counts = await page.evaluate(() =>
    Object.fromEntries(
      ['SeatFabric', 'SeatShell', 'SeatCover', 'SeatArm', 'SeatLegs', 'SeatHit'].map((n) => [
        n,
        (window as unknown as SceneWindow).__aslan.scene!.getObjectByName(n)?.count,
      ]),
    ),
  );
  expect(counts).toEqual({ SeatFabric: 180, SeatShell: 180, SeatCover: 180, SeatArm: 240, SeatLegs: 180, SeatHit: 180 });
});

test('instanced seat parts keep the kit seat size (dequantized, node transform baked in)', async ({ page }) => {
  await page.goto('/');
  await waitForStore(page);
  await page.waitForFunction(() => !!(window as unknown as SceneWindow).__aslan.scene?.getObjectByName('SeatFabric'));
  const box = await page.evaluate(() => {
    type Geo = { computeBoundingBox(): void; boundingBox: { min: { x: number; y: number; z: number }; max: { x: number; y: number; z: number } } };
    const out: Record<string, number[]> = {};
    for (const n of ['SeatFabric', 'SeatShell', 'SeatCover', 'SeatLegs']) {
      const g = ((window as unknown as SceneWindow).__aslan.scene!.getObjectByName(n) as unknown as { geometry: Geo }).geometry;
      g.computeBoundingBox();
      const { min, max } = g.boundingBox;
      out[n] = [min.x, min.y, min.z, max.x, max.y, max.z].map((v) => +v.toFixed(3));
    }
    return out;
  });
  for (const [name, [x0, y0, z0, x1, y1, z1]] of Object.entries(box)) {
    expect(x1 - x0, `${name} depth`).toBeLessThanOrEqual(0.7); // footprint 0.5 + the reclined back overhanging aft
    expect(z1 - z0, `${name} width`).toBeLessThanOrEqual(0.44 + 0.01);
    expect(y0, `${name} floor`).toBeGreaterThanOrEqual(-0.01);
    expect(y1, `${name} top`).toBeLessThanOrEqual(1.08 + 0.01);
  }
});

test('the highlight sits on the hovered seat, then marks the chosen one', async ({ page }) => {
  await page.goto('/');
  await waitForStore(page);
  for (let i = 0; i < 4; i++) await page.mouse.wheel(0, 600);
  await settledProgress(page);
  const hit = await scanForHoveredSeat(page);
  const [x, , z] = seatWorldPosition(Number(hit.id.slice(0, -1)), hit.id.at(-1) as SeatLetter);
  const hl = await highlightState(page);
  expect(hl).toMatchObject({ visible: true, color: '#6fd3cc' });
  expect(hl.x).toBeCloseTo(x, 2);
  expect(hl.z).toBeCloseTo(z, 2);
  await page.mouse.click(hit.x, hit.y);
  await expect.poll(() => highlightState(page)).toMatchObject({ visible: true, color: '#d4683a' });
});
