import { expect, test } from '@playwright/test';
import { WINDOW_ON_EXIT } from '@/experience/cameraPoses';
import { DOOR_1L } from '@/experience/geometry';
import { scrollToEnd, settledProgress, state, waitForStore } from './helpers';

test('pick, reconsider, confirm', async ({ page }) => {
  await page.goto('/');
  await waitForStore(page);
  await scrollToEnd(page);

  await page.getByRole('button', { name: /pick for me/i }).click();
  await expect.poll(async () => (await state(page)).phase).toBe('seated');

  // Momentum while seated must not move us.
  const seatedAt = (await state(page)).progress;
  await page.mouse.wheel(0, 2000);
  await page.waitForTimeout(500);
  expect((await state(page)).progress).toBe(seatedAt);

  await page.getByRole('button', { name: /another/i }).click();
  await expect.poll(async () => (await state(page)).phase).toBe('browse');

  // Keyboard path.
  await page.getByRole('button', { name: /pick for me/i }).focus();
  await page.keyboard.press('Enter');
  await page.getByRole('button', { name: /choose this seat/i }).click();
  await expect.poll(async () => (await state(page)).phase).toBe('confirmed');
  await expect(page.getByRole('button', { name: /change seat/i })).toBeVisible();
  await page.waitForTimeout(1200);
  await page.screenshot({ path: 'test-results/pass.png' });
});

test('the outro panels can be wheel-scrolled on a short window', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 480 });
  await page.goto('/');
  await waitForStore(page);
  await scrollToEnd(page);
  await page.getByRole('button', { name: /pick for me/i }).click();
  await page.getByRole('button', { name: /choose this seat/i }).click();
  await expect.poll(async () => (await state(page)).phase).toBe('confirmed');
  await scrollToEnd(page);

  const outro = page.locator('section', { has: page.getByRole('heading', { name: /have a nice flight/i }) });
  await expect(outro).toBeVisible();
  await page.mouse.move(720, 240);
  await page.mouse.wheel(0, 300);
  await expect.poll(() => outro.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
});

type JourneyWindow = Window & {
  __aslan: {
    store: { getState(): { setProgress(p: number): void; seats: { id: string; status: string }[]; sit(id: string): boolean; confirm(): void } };
  };
};

test('the outro is a dark editorial page in the night style', async ({ page }) => {
  await page.goto('/');
  await waitForStore(page);
  await page.evaluate(() => {
    const s = (window as unknown as JourneyWindow).__aslan.store.getState();
    s.setProgress(__pre('aisle', 0.27));
    s.seats.find((x) => x.id === '14F')!.status = 'free';
    s.sit('14F');
    s.confirm();
    s.setProgress(0.9);
  });
  const outro = page.locator('section', { has: page.getByRole('heading', { name: /have a nice flight/i }) });
  await expect(outro).toBeVisible();
  const look = await outro.evaluate((el) => {
    const s = getComputedStyle(el);
    return { color: s.backgroundColor, image: s.backgroundImage, title: getComputedStyle(el.querySelector('h2')!).fontFamily };
  });
  expect(/^rgba?\(7, 8, 11(, 0?\.\d+)?\)$/.test(look.color) || look.image.includes('rgba(7, 8, 11'), JSON.stringify(look)).toBe(true);
  expect(look.title).toContain('Archivo');
  // start again is there before the form is sent too
  await expect(page.getByRole('button', { name: /start again/i })).toBeVisible();
});

test('chapter captions use the display face', async ({ page }) => {
  await page.goto('/');
  await waitForStore(page);
  await page.evaluate(() => (window as unknown as JourneyWindow).__aslan.store.getState().setProgress(__pre('door', 0.4)));
  const caption = page.getByRole('heading', { name: 'Welcome aboard.' });
  await expect(caption).toBeVisible();
  expect(await caption.evaluate((el) => getComputedStyle(el).fontFamily)).toContain('Archivo');
});

test('take off, fill the form, start again', async ({ page }) => {
  const posts: string[] = [];
  page.on('request', (r) => {
    if (r.method() === 'POST') posts.push(r.url());
  });
  await page.goto('/');
  await waitForStore(page);
  await scrollToEnd(page);
  await page.getByRole('button', { name: /pick for me/i }).click();
  await page.getByRole('button', { name: /choose this seat/i }).click();
  await expect.poll(async () => (await state(page)).phase).toBe('confirmed');

  await scrollToEnd(page);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'test-results/outro.png' });

  await page.getByLabel(/name/i).fill('Test');
  await page.getByLabel(/e-mail/i).fill('t@example.com');
  await page.getByRole('button', { name: /^buy$/i }).click();
  await expect(page.getByText(/concept/i).first()).toBeVisible();
  // The footer also says "concept" on every chapter, so prove the form was replaced.
  await expect(page.getByRole('button', { name: /^buy$/i })).toHaveCount(0);
  expect(posts).toEqual([]);

  await page.getByRole('button', { name: /start again/i }).click();
  await expect.poll(async () => (await state(page)).phase).toBe('browse');
  await expect.poll(async () => (await state(page)).progress).toBe(0);
});

test('on the pass, Take off flies to the window and asks to scroll on', async ({ page }) => {
  await page.goto('/');
  await waitForStore(page);
  await page.evaluate(() => {
    const s = (window as unknown as JourneyWindow).__aslan.store.getState();
    s.setProgress(__pre('aisle', 0.27));
    s.seats.find((x) => x.id === '14F')!.status = 'free';
    s.sit('14F');
    s.confirm();
  });
  await page.getByRole('button', { name: 'Take off' }).click();
  expect(Math.abs((await settledProgress(page)) - WINDOW_ON_EXIT)).toBeLessThan(0.01);
  await expect(page.getByText('Scroll to fly out')).toBeVisible();
  // at the window the camera is in the wall: the glass must not glow over the view as it does from outside
  const glow = await page.evaluate(() => {
    let value = -1;
    (window as unknown as { __aslan: { scene: { traverse(cb: (o: { material?: { name?: string; emissiveIntensity?: number } }) => void): void } } }).__aslan.scene.traverse((o) => {
      if (o.material?.name === 'WindowGlass') value = o.material.emissiveIntensity!;
    });
    return value;
  });
  expect(glow).toBe(0);
  // scrolling on leaves the window behind, and the call with it
  await page.mouse.wheel(0, 900);
  await expect.poll(async () => (await state(page)).progress).toBeGreaterThan(WINDOW_ON_EXIT + 0.08);
  await expect(page.getByText('Scroll to fly out')).toBeHidden();
});

test('door 1L stays shut through the ready chapter, its outline glowing, and opens along the hull in the door flight', async ({ page }) => {
  await page.goto('/');
  await waitForStore(page);
  await page.waitForFunction(() => document.getElementById('loader')?.dataset.ready === 'true', null, { timeout: 60_000 });
  const doorAt = async (id: 'ready' | 'door', t: number) => {
    await page.evaluate(([id, t]) => (window as unknown as JourneyWindow).__aslan.store.getState().setProgress(__pre(id as 'ready', t as number)), [id, t] as const);
    await page.waitForTimeout(300);
    return page.evaluate(() => {
      type Node = { position: { x: number; y: number; z: number }; rotation: { x: number; y: number; z: number } };
      const node = (window as unknown as { __aslan: { scene: { getObjectByName(n: string): Node } } }).__aslan.scene.getObjectByName('Door1L');
      return { p: [node.position.x, node.position.y, node.position.z], r: [node.rotation.x, node.rotation.y, node.rotation.z] };
    });
  };
  const shut = await doorAt('ready', 0.9);
  shut.p.forEach((v, i) => expect(v, `position ${i}`).toBeCloseTo(DOOR_1L.hinge[i], 3));
  shut.r.forEach((v, i) => expect(v, `rotation ${i}`).toBeCloseTo(0, 6));
  const open = await doorAt('door', 0.6);
  expect(open.p[0] - DOOR_1L.hinge[0], 'forward of the doorway').toBeGreaterThan(0.95);
});
