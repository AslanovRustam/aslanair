import { expect, test } from '@playwright/test';
import { hoveredSeat, settledProgress, waitForStore } from './helpers';

test('the seat under the pointer is re-checked as the camera walks', async ({ page }) => {
  await page.goto('/');
  await waitForStore(page);
  for (let i = 0; i < 4; i++) await page.mouse.wheel(0, 600);
  await settledProgress(page);

  let first: string | null = null;
  scan: for (let y = 440; y < 760; y += 40) {
    for (let x = 140; x < 1300; x += 60) {
      await page.mouse.move(x, y);
      first = await hoveredSeat(page);
      if (first) break scan;
    }
  }
  expect(first).not.toBeNull();

  await page.mouse.wheel(0, 600); // walk on without moving the pointer
  await settledProgress(page);
  expect(await hoveredSeat(page)).not.toBe(first);

  for (let i = 0; i < 12; i++) await page.mouse.wheel(0, -600); // back out to the sky
  await settledProgress(page);
  expect(await hoveredSeat(page)).toBeNull();
});
