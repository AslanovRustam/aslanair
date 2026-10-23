import { expect, test, type Page } from '@playwright/test';
import { pre, waitForStore, wheelTo } from './helpers';

type Found = { visible: boolean; geometry?: { attributes: { position: { count: number } } } } | undefined;
type SceneWindow = { __aslan: { scene: { getObjectByName(name: string): Found } } };

const globe = (page: Page) =>
  page.evaluate(() => {
    const scene = (window as unknown as SceneWindow).__aslan.scene;
    return {
      visible: !!scene.getObjectByName('Globe')?.visible,
      markers: scene.getObjectByName('GlobeMarkers')?.geometry?.attributes.position.count ?? 0,
    };
  });

async function open(page: Page) {
  await page.goto('/');
  await waitForStore(page);
  await page.waitForFunction(() => document.getElementById('loader')?.dataset.ready === 'true');
}

test('the night globe shows only around the destinations chapter, with home and 14 destinations marked', async ({ page }) => {
  await open(page);
  expect((await globe(page)).visible, 'hidden at the top').toBe(false);
  await wheelTo(page, pre('destinations', 0.5));
  expect(await globe(page)).toEqual({ visible: true, markers: 15 });
  await wheelTo(page, pre('aisle', 0.3));
  expect((await globe(page)).visible, 'hidden in the aisle').toBe(false);
});
