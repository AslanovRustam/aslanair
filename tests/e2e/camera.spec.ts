import { expect, test, type Page } from '@playwright/test';
import { poseOnPreTrack, seatedPose } from '@/experience/cameraPoses';
import { trackProgress } from '@/experience/chapters';
import { waitForStore } from './helpers';

type V3 = { x: number; y: number; z: number };
type CameraWindow = Window & {
  __aslan: {
    camera?: { position: V3 };
    store: { getState(): { setProgress(p: number): void; seats: { id: string; status: string }[]; sit(id: string): boolean } };
  };
};

async function ready(page: Page) {
  await page.goto('/');
  await waitForStore(page);
  await page.waitForFunction(() => document.getElementById('loader')?.dataset.ready === 'true');
}

/** Sets the progress, lets `frames` frames render, and returns where the camera is. */
const cameraAfter = (page: Page, progress: number | null, frames: number) =>
  page.evaluate(
    ([progress, frames]) =>
      new Promise<V3>((done) => {
        const w = window as unknown as CameraWindow;
        if (progress !== null) w.__aslan.store.getState().setProgress(progress);
        let n = 0;
        const tick = () => {
          if (++n < frames) return requestAnimationFrame(tick);
          const { x, y, z } = w.__aslan.camera!.position;
          done({ x, y, z });
        };
        requestAnimationFrame(tick);
      }),
    [progress, frames] as const,
  );

const distance = (a: V3, b: V3) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

test('while browsing, the camera is where the scroll says, with no lag behind it', async ({ page }) => {
  await ready(page);
  // forward and back across the intro's swap and the door: the picture, the 3D plane and the night switch all key
  // off the scroll position, so the camera must be there too
  for (const p of [trackProgress('pre', 'sky', 0.5), trackProgress('pre', 'door', 0.7), trackProgress('pre', 'sky', 0.78), trackProgress('pre', 'aisle', 0.4)]) {
    const at = await cameraAfter(page, p, 3);
    expect(distance(at, poseOnPreTrack(p).position), `progress ${p.toFixed(3)}`).toBeLessThan(1e-3);
  }
});

test('sitting down still glides the camera to the seat rather than cutting to it', async ({ page }) => {
  await ready(page);
  const aisle = trackProgress('pre', 'aisle', 0.4);
  await cameraAfter(page, aisle, 3);
  await page.evaluate(() => {
    const s = (window as unknown as CameraWindow).__aslan.store.getState();
    s.seats.find((x) => x.id === '14F')!.status = 'free';
    s.sit('14F');
  });
  const seat = seatedPose({ row: 14, letter: 'F' }).position;
  const soon = await cameraAfter(page, null, 3);
  expect(distance(soon, seat), 'still on the way').toBeGreaterThan(0.1);
  await page.waitForTimeout(3000);
  expect(distance(await cameraAfter(page, null, 2), seat), 'arrived').toBeLessThan(1e-3);
});
