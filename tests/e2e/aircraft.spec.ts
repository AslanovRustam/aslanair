import { expect, test, type Page } from '@playwright/test';
import { settledProgress, waitForAircraft, waitForStore } from './helpers';

type DoorWindow = Window & { __aslan: { scene: { getObjectByName(n: string): { position: { x: number } } | undefined } } };

/** Forward travel of Door1L from its closed position (metres along +X). */
async function doorTravel(page: Page, closedX: number) {
  return page.evaluate((x0) => (window as unknown as DoorWindow).__aslan.scene.getObjectByName('Door1L')!.position.x - x0, closedX);
}

test('door 1L opens as the camera arrives', async ({ page }) => {
  await page.goto('/');
  await waitForStore(page);
  await waitForAircraft(page);
  const closedX = await page.evaluate(() => (window as unknown as DoorWindow).__aslan.scene.getObjectByName('Door1L')!.position.x);
  expect(await doorTravel(page, closedX)).toBeCloseTo(0, 3);

  // into the door chapter (pre track 0.2–0.45), past the point where the door has slid forward
  await page.evaluate(() => {
    const s = (window as unknown as { __aslan: { store: { getState(): { setProgress(p: number): void } } } }).__aslan.store;
    s.getState().setProgress(0.36);
  });
  await page.waitForTimeout(800);
  expect(await doorTravel(page, closedX)).toBeGreaterThan(0.5);
  await page.screenshot({ path: 'test-results/door.png' });
  await settledProgress(page);
});

test('see-through glass lets the sun into the cabin; the hull still casts shadow', async ({ page }) => {
  await page.goto('/');
  await waitForStore(page);
  await waitForAircraft(page);
  await page.waitForTimeout(300);
  const shadows = await page.evaluate(() => {
    type Node = { name: string; isMesh?: boolean; castShadow: boolean; material?: { transparent: boolean } };
    const out: Record<string, boolean> = {};
    (window as unknown as { __aslan: { scene: { traverse(f: (o: Node) => void): void } } }).__aslan.scene.traverse((o) => {
      if (o.isMesh && (o.material!.transparent || o.name.startsWith('Fuselage'))) out[o.name] = o.castShadow;
    });
    return out;
  });
  expect(Object.keys(shadows).some((n) => n.startsWith('WindowGlass'))).toBe(true);
  for (const [name, casts] of Object.entries(shadows)) expect(casts, name).toBe(name.startsWith('Fuselage'));
});
