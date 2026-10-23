import { expect, test } from '@playwright/test';
import { pre, wheelTo, hoveredSeat, scanForHoveredSeat, settledProgress, waitForStore } from './helpers';

test('the seat under the pointer is re-checked as the camera walks', async ({ page }) => {
  await page.goto('/');
  await waitForStore(page);
  await wheelTo(page, pre('aisle', 0.55));

  const first = (await scanForHoveredSeat(page)).id;

  await page.mouse.wheel(0, 600); // walk on without moving the pointer
  await settledProgress(page);
  expect(await hoveredSeat(page)).not.toBe(first);

  for (let i = 0; i < 12; i++) await page.mouse.wheel(0, -600); // back out to the sky
  await settledProgress(page);
  expect(await hoveredSeat(page)).toBeNull();
});
