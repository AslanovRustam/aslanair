import { expect, test, type Page } from '@playwright/test';
import { PUFFS } from '@/experience/clouds';
import { waitForStore } from './helpers';

type QualityWindow = {
  __aslan: {
    store: { getState(): { quality: string } };
    scene: { getObjectByName(name: string): { visible: boolean; count?: number; geometry?: { instanceCount: number } } | undefined };
  };
};

const quality = (page: Page) => page.evaluate(() => (window as unknown as QualityWindow).__aslan.store.getState().quality);

test('?quality=low: plain seats, fewer clouds, a lower pixel ratio', async ({ page }) => {
  await page.goto('/?quality=low');
  await waitForStore(page);
  await expect.poll(() => quality(page)).toBe('low');
  await page.waitForFunction(() => !!(window as unknown as QualityWindow).__aslan.scene?.getObjectByName('SeatFabricLow'), null, { timeout: 30_000 });
  const r = await page.evaluate(() => {
    const { scene } = (window as unknown as QualityWindow).__aslan;
    const canvas = document.querySelector('canvas')!;
    return {
      ratio: canvas.width / canvas.clientWidth,
      low: scene.getObjectByName('SeatFabricLow')?.count,
      full: scene.getObjectByName('SeatFabric')?.visible ?? false,
      puffs: scene.getObjectByName('CloudPuffs')?.geometry?.instanceCount,
    };
  });
  expect(r.ratio).toBeLessThanOrEqual(1.25);
  expect(r.low).toBe(180);
  expect(r.full, 'the full seat is not drawn').toBe(false);
  expect(r.puffs).toBe(PUFFS.count / 2);
});

test('a desktop is not put on the low tier', async ({ page }) => {
  await page.goto('/');
  await waitForStore(page);
  // once the scene is up the governor has probed the device
  await page.waitForFunction(() => !!(window as unknown as QualityWindow).__aslan.scene);
  expect(await quality(page)).not.toBe('low');
});
