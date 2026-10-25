import { expect, test } from '@playwright/test';
import { copy } from '@/content/copy';
import { WINDOW_ON_EXIT } from '@/experience/cameraPoses';
import { DOOR_1L } from '@/experience/geometry';
import { loaderGone, scrollToEnd, settledProgress, state, waitForStore } from './helpers';

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

for (const viewport of [
  { width: 360, height: 740 },
  { width: 390, height: 844 },
  { width: 412, height: 915 },
]) {
  test(`on a ${viewport.width} px phone the aisle's, the seat's and the pass's bars fit the screen, every word and button whole`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto('/');
    await waitForStore(page);
    /** Every button and the seat's words lie wholly on screen, the buttons big enough to tap. */
    const fits = async (where: string, parts: import('@playwright/test').Locator[]) => {
      for (const part of parts) {
        await expect(part, where).toBeVisible();
        const b = (await part.boundingBox())!;
        expect(b.x, `${where}: left edge`).toBeGreaterThanOrEqual(0);
        expect(b.x + b.width, `${where}: right edge`).toBeLessThanOrEqual(viewport.width);
        expect(b.y + b.height, `${where}: bottom edge`).toBeLessThanOrEqual(viewport.height);
        expect(await part.evaluate((e) => e.scrollWidth <= e.clientWidth + 1), `${where}: nothing cut`).toBe(true);
      }
    };
    await page.evaluate(() => (window as unknown as { __aslan: { store: { getState(): { setProgress(p: number): void } } } }).__aslan.store.getState().setProgress(__pre('aisle', 0.27)));
    await fits('aisle', [page.getByRole('button', { name: /pick for me/i })]);
    // the longest seat line there is: a window seat with extra legroom
    await page.evaluate(() => {
      const s = (window as unknown as { __aslan: { store: { getState(): { seats: { id: string; status: string }[]; sit(id: string): boolean } } } }).__aslan.store.getState();
      s.seats.find((x) => x.id === '14F')!.status = 'free';
      s.sit('14F');
    });
    const seated = [page.getByText(/^14F · Window · Extra legroom/), page.getByRole('button', { name: /see another/i }), page.getByRole('button', { name: /choose this seat/i })];
    await fits('seated', seated);
    for (const button of seated.slice(1)) expect((await button.boundingBox())!.height, 'big enough to tap').toBeGreaterThanOrEqual(40);
    await page.evaluate(() => {
      const s = (window as unknown as { __aslan: { store: { getState(): { confirm(): void; setProgress(p: number): void } } } }).__aslan.store.getState();
      s.confirm();
      s.setProgress(0.07);
    });
    await fits('pass', [page.getByRole('button', { name: /change seat/i }), page.getByRole('button', { name: /take off/i })]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth), 'no sideways scroll').toBeLessThanOrEqual(viewport.width);
  });
}

test('the comment box is one line high until there is more to say, then grows with it', async ({ page }) => {
  await page.goto('/');
  await waitForStore(page);
  await page.evaluate(() => {
    const s = (window as unknown as { __aslan: { store: { getState(): { setProgress(p: number): void; seats: { id: string; status: string }[]; sit(id: string): boolean; confirm(): void } } } }).__aslan.store.getState();
    s.setProgress(__pre('aisle', 0.27));
    s.seats.find((x) => x.id === '14F')!.status = 'free';
    s.sit('14F');
    s.confirm();
    s.setProgress(0.9);
  });
  const comment = page.getByLabel('Comment');
  const name = page.getByLabel('Name');
  await expect(comment).toBeVisible();
  const height = async (l: typeof comment) => (await l.boundingBox())!.height;
  expect(Math.abs((await height(comment)) - (await height(name))), 'as high as a line field').toBeLessThanOrEqual(2);
  await comment.fill('A window seat, please.\nAnd a quiet row.\nThank you!');
  await expect.poll(() => height(comment), { message: 'three lines' }).toBeGreaterThan((await height(name)) * 2);
});

test('the form asks for a name and a real e-mail before Buy goes through, saying what is wrong under each field', async ({ page }) => {
  await page.goto('/');
  await waitForStore(page);
  await page.evaluate(() => {
    const s = (window as unknown as { __aslan: { store: { getState(): { setProgress(p: number): void; seats: { id: string; status: string }[]; sit(id: string): boolean; confirm(): void } } } }).__aslan.store.getState();
    s.setProgress(__pre('aisle', 0.27));
    s.seats.find((x) => x.id === '14F')!.status = 'free';
    s.sit('14F');
    s.confirm();
    s.setProgress(0.9);
  });
  const name = page.getByLabel('Name');
  const email = page.getByLabel('E-mail');
  const buy = page.getByRole('button', { name: /^buy$/i });
  await expect(buy).toBeVisible();

  // empty: both asked for, the visitor taken to the first, nothing bought
  await buy.click();
  await expect(name).toHaveAttribute('aria-invalid', 'true');
  await expect(name).toHaveAccessibleDescription(copy.outro.errors.nameRequired);
  await expect(email).toHaveAccessibleDescription(copy.outro.errors.emailRequired);
  await expect(name).toBeFocused();
  expect((await state(page)).phase).toBe('confirmed');

  // a name too short, an e-mail without its domain
  await name.fill('A');
  await expect(name).toHaveAccessibleDescription(copy.outro.errors.nameShort);
  await email.fill('rustam@example');
  await expect(email).toHaveAccessibleDescription(copy.outro.errors.emailInvalid);
  await buy.click();
  await expect(name).toBeFocused();
  expect((await state(page)).phase).toBe('confirmed');

  // put right, the errors go as they are typed away, and Buy goes through
  await name.fill('Rustam');
  await expect(name).not.toHaveAttribute('aria-invalid', 'true');
  await email.fill('rustam@example.com');
  await expect(email).not.toHaveAttribute('aria-invalid', 'true');
  await expect(page.getByText(copy.outro.errors.emailInvalid)).toHaveCount(0);
  await buy.click();
  await expect.poll(async () => (await state(page)).phase).toBe('thanks');
});

test('leaving a field half filled in says what is wrong at once; leaving it empty waits for Buy', async ({ page }) => {
  await page.goto('/');
  await waitForStore(page);
  await page.evaluate(() => {
    const s = (window as unknown as { __aslan: { store: { getState(): { setProgress(p: number): void; seats: { id: string; status: string }[]; sit(id: string): boolean; confirm(): void } } } }).__aslan.store.getState();
    s.setProgress(__pre('aisle', 0.27));
    s.seats.find((x) => x.id === '14F')!.status = 'free';
    s.sit('14F');
    s.confirm();
    s.setProgress(0.9);
  });
  const name = page.getByLabel('Name');
  const email = page.getByLabel('E-mail');
  await expect(page.getByRole('button', { name: /^buy$/i })).toBeVisible();
  await name.focus();
  await email.focus(); // the name left empty
  await expect(name).not.toHaveAttribute('aria-invalid', 'true');
  await email.fill('rustam@');
  await page.getByLabel('Comment').focus();
  await expect(email).toHaveAttribute('aria-invalid', 'true');
  await expect(email).toHaveAccessibleDescription(copy.outro.errors.emailInvalid);
});

test('a wrong e-mail and straight to Buy: the note that appears as the field is left never moves Buy from under the click', async ({ page }) => {
  await page.goto('/');
  await waitForStore(page);
  await page.evaluate(() => {
    const s = (window as unknown as { __aslan: { store: { getState(): { setProgress(p: number): void; seats: { id: string; status: string }[]; sit(id: string): boolean; confirm(): void } } } }).__aslan.store.getState();
    s.setProgress(__pre('aisle', 0.27));
    s.seats.find((x) => x.id === '14F')!.status = 'free';
    s.sit('14F');
    s.confirm();
    s.setProgress(0.9);
  });
  const buy = page.getByRole('button', { name: /^buy$/i });
  await expect(buy).toBeVisible();
  await page.waitForTimeout(1500); // the page's entrance played out
  await page.getByLabel('E-mail').fill('rustam@example');
  const before = (await buy.boundingBox())!.y;
  await page.getByLabel('Comment').focus(); // the e-mail left filled in wrong: its note appears
  await expect(page.getByLabel('E-mail')).toHaveAccessibleDescription(copy.outro.errors.emailInvalid);
  expect((await buy.boundingBox())!.y, 'Buy has not moved').toBe(before);
  await page.getByLabel('E-mail').focus();
  await buy.click();
  // the click went through: Buy asked for the name and took the visitor there
  await expect(page.getByLabel('Name')).toBeFocused();
  await expect(page.getByLabel('Name')).toHaveAccessibleDescription(copy.outro.errors.nameRequired);
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
  // scrolling on leaves the window behind, and the call with it (the page holds still until the loader is gone)
  await loaderGone(page);
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
