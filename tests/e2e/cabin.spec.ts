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

test('loading the furnished cabin never blocks the main thread for more than 3 s', async ({ page }) => {
  await page.addInitScript(() => {
    const w = window as unknown as { __long: number[] };
    w.__long = [];
    new PerformanceObserver((list) => list.getEntries().forEach((e) => w.__long.push(e.duration))).observe({ type: 'longtask', buffered: true });
  });
  await page.goto('/');
  await waitForStore(page);
  await waitForAircraft(page);
  await page.waitForFunction(() => {
    const seat = (window as unknown as { __aslan: { scene?: { getObjectByName(n: string): { layers: { mask: number } } | undefined } } }).__aslan.scene?.getObjectByName('SeatFabric');
    return !!seat && (seat.layers.mask & 1) === 1; // shown on the camera's layer
  });
  await page.waitForTimeout(1500);
  const longest = await page.evaluate(() => Math.max(0, ...(window as unknown as { __long: number[] }).__long));
  expect(longest).toBeLessThanOrEqual(3000);
});

const CABIN_PARTS = /^(Cabin|CockpitDoor|Seat|Bin|RowLabels|CeilingStrip|Galley|Curtain|ExitSign|WindowGlass)/;

test('only the exterior casts sun shadows', async ({ page }) => {
  await page.goto('/');
  await waitForStore(page);
  await waitForAircraft(page);
  await page.waitForFunction(() => !!(window as unknown as SceneWindow).__aslan.scene?.getObjectByName('GalleyPanels'));
  await page.waitForTimeout(300);
  const meshes = await page.evaluate(() => {
    const out: { name: string; cast: boolean }[] = [];
    type O = { name: string; isMesh?: boolean; castShadow: boolean };
    (window as unknown as { __aslan: { scene: { traverse(f: (o: O) => void): void } } }).__aslan.scene.traverse((o) => {
      if (o.isMesh) out.push({ name: o.name, cast: o.castShadow });
    });
    return out;
  });
  expect(meshes.find((m) => m.name === 'Fuselage')?.cast).toBe(true);
  const casting = meshes.filter((m) => CABIN_PARTS.test(m.name) && m.cast).map((m) => m.name);
  expect(casting).toEqual([]);
});

test('no sun streaks on the upper wall', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 800 });
  await page.goto('/');
  await waitForStore(page);
  await page.waitForFunction(() => !!(window as unknown as SceneWindow).__aslan.scene?.getObjectByName('GalleyPanels'));
  await page.evaluate(() => (window as unknown as { __aslan: { store: { getState(): { setProgress(p: number): void } } } }).__aslan.store.getState().setProgress(0.6));
  await page.waitForTimeout(2500);
  const clip = { x: 200, y: 180, width: 520, height: 280 };
  const energy = async (png: Buffer) =>
    page.evaluate(async (b64) => {
      const img = new Image();
      img.src = `data:image/png;base64,${b64}`;
      await img.decode();
      const c = document.createElement('canvas');
      c.width = img.width;
      c.height = img.height;
      const ctx = c.getContext('2d')!;
      ctx.drawImage(img, 0, 0);
      const d = ctx.getImageData(0, 0, c.width, c.height).data;
      const lum = (i: number) => 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
      let sum = 0;
      for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width - 1; x++) sum += Math.abs(lum((y * c.width + x + 1) * 4) - lum((y * c.width + x) * 4));
      return sum / (c.height * (c.width - 1));
    }, png.toString('base64'));
  const withShadows = await energy(await page.screenshot({ clip }));
  await page.evaluate(() => {
    type O = { isMesh?: boolean; receiveShadow: boolean; material?: { needsUpdate: boolean } };
    (window as unknown as { __aslan: { scene: { traverse(f: (o: O) => void): void } } }).__aslan.scene.traverse((o) => {
      if (o.isMesh) {
        o.receiveShadow = false;
        if (o.material) o.material.needsUpdate = true;
      }
    });
  });
  await page.waitForTimeout(800);
  const without = await energy(await page.screenshot({ clip }));
  console.log('streak energy', withShadows.toFixed(3), 'vs', without.toFixed(3));
  expect(withShadows).toBeLessThanOrEqual(1.25 * without);
});

test('the cabin is lit by its materials, not by point lights', async ({ page }) => {
  await page.goto('/');
  await waitForStore(page);
  await waitForAircraft(page);
  await page.waitForFunction(() => !!(window as unknown as SceneWindow).__aslan.scene?.getObjectByName('GalleyPanels'));
  const state = await page.evaluate(() => {
    let points = 0;
    const keys: Record<string, string> = {};
    type O = { name: string; isPointLight?: boolean; isMesh?: boolean; material?: { customProgramCacheKey(): string } };
    (window as unknown as { __aslan: { scene: { traverse(f: (o: O) => void): void } } }).__aslan.scene.traverse((o) => {
      if (o.isPointLight) points++;
      if (o.isMesh && ['CabinShell', 'SeatFabric', 'BinPort', 'GalleyPanels'].includes(o.name)) keys[o.name] = o.material!.customProgramCacheKey();
    });
    return { points, keys };
  });
  expect(state.points).toBe(0);
  expect(state.keys).toEqual({ CabinShell: 'cabin-light', SeatFabric: 'cabin-light', BinPort: 'cabin-light', GalleyPanels: 'cabin-light' });
});

test('the seat under the pointer is the seat you see', async ({ page }) => {
  await page.goto('/');
  await waitForStore(page);
  await page.waitForFunction(() => {
    const s = (window as unknown as { __aslan: { scene?: { getObjectByName(n: string): { layers: { mask: number } } | undefined } } }).__aslan.scene?.getObjectByName('SeatFabric');
    return !!s && (s.layers.mask & 1) === 1;
  });
  let visible = 0;
  let wrong = 0;
  for (const progress of [0.55, 0.65, 0.75]) {
    await page.evaluate((p) => (window as unknown as { __aslan: { store: { getState(): { setProgress(v: number): void } } } }).__aslan.store.getState().setProgress(p), progress);
    await page.waitForTimeout(2500);
    const r = await page.evaluate(() => {
      // R3F's own raycaster and camera; three's raycast methods via the prototypes (no three import in the page)
      type Hit = { distance: number; instanceId?: number; object: { name: string } };
      type O = { name: string; isMesh?: boolean; isInstancedMesh?: boolean; traverse(f: (c: O) => void): void; raycast(r: unknown, out: Hit[]): void };
      const w = window as unknown as { __aslan: { scene: { getObjectByName(n: string): O }; store: { getState(): { seats: { id: string }[] } } } };
      const scene = w.__aslan.scene;
      const hit = scene.getObjectByName('SeatHit') as O & { __r3f: { root: { getState(): { raycaster: { setFromCamera(p: { x: number; y: number }, c: unknown): void }; camera: { updateMatrixWorld(): void }; size: { width: number; height: number } } } } };
      const { raycaster, camera, size } = hit.__r3f.root.getState();
      camera.updateMatrixWorld();
      const instProto = Object.getPrototypeOf(hit);
      const meshProto = Object.getPrototypeOf(instProto);
      const meshes: O[] = [];
      for (const n of ['SeatFabric', 'SeatShell', 'SeatCover', 'SeatLegs', 'SeatArm', 'BinPort', 'BinStarboard', 'Curtain', 'CabinFloor']) {
        scene.getObjectByName(n).traverse((c) => {
          if (c.isMesh) meshes.push(c);
        });
      }
      const seatParts = new Set(['SeatFabric', 'SeatShell', 'SeatCover', 'SeatLegs']);
      let v = 0;
      let x = 0;
      for (let py = 300; py < size.height; py += 12) {
        for (let px = 0; px < size.width; px += 12) {
          raycaster.setFromCamera({ x: (px / size.width) * 2 - 1, y: -(py / size.height) * 2 + 1 }, camera);
          const all: Hit[] = [];
          for (const o of meshes) (o.isInstancedMesh ? instProto : meshProto).raycast.call(o, raycaster, all);
          all.sort((a, b) => a.distance - b.distance);
          const seen = all[0];
          if (!seen || !seatParts.has(seen.object.name)) continue;
          const proxy: Hit[] = [];
          instProto.raycast.call(hit, raycaster, proxy);
          proxy.sort((a, b) => a.distance - b.distance);
          v++;
          if (!proxy[0] || proxy[0].instanceId !== seen.instanceId) x++;
        }
      }
      return { v, x };
    });
    visible += r.v;
    wrong += r.x;
  }
  console.log(`seat picks: ${wrong} wrong of ${visible}`);
  expect(visible).toBeGreaterThan(1000);
  expect(wrong / visible).toBeLessThanOrEqual(0.02);
});
