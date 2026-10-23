import { expect, test, type Page } from '@playwright/test';
import { INTRO } from '@/experience/introState';
import { settledProgress, waitForStore } from './helpers';

type StoreWindow = Window & {
  __aslan: {
    store: {
      getState(): {
        phase: string;
        progress: number;
        seats: { id: string; status: string }[];
        setProgress(p: number): void;
        sit(id: string): boolean;
        confirm(): void;
      };
    };
  };
};

const state = (page: Page) =>
  page.evaluate(() => {
    const s = (window as unknown as StoreWindow).__aslan.store.getState();
    return { phase: s.phase, progress: s.progress };
  });

async function open(page: Page) {
  await page.goto('/');
  await waitForStore(page);
}

/** Open, then let the loader hand over and the hero's entrance (paused until then) play out. */
async function openHero(page: Page) {
  await open(page);
  await page.waitForFunction(() => document.getElementById('loader')?.dataset.ready === 'true');
  await page.waitForTimeout(1800);
}

test('header, chapter rail and footer frame the experience from the start', async ({ page }) => {
  await open(page);
  await expect(page.getByRole('banner')).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Chapters' })).toBeVisible();
  await expect(page.getByRole('contentinfo')).toContainText('fictional');
  await expect(page.getByRole('button', { name: 'Choose your seat' })).toBeVisible();
});

test('Cabin takes the visitor into the aisle', async ({ page }) => {
  await open(page);
  await page.getByRole('banner').getByRole('button', { name: 'Cabin' }).click();
  await expect.poll(async () => (await state(page)).progress, { timeout: 10_000 }).toBeGreaterThanOrEqual(0.45);
});

test('after confirming a seat the cabin is out of reach and the call to action is gone', async ({ page }) => {
  await open(page);
  await page.evaluate(() => {
    const s = (window as unknown as StoreWindow).__aslan.store.getState();
    s.setProgress(0.6);
    s.seats.find((x) => x.id === '14F')!.status = 'free';
    s.sit('14F');
    s.confirm();
  });
  await settledProgress(page);
  const cabin = page.getByRole('banner').getByRole('button', { name: 'Cabin' });
  await expect(cabin).toBeDisabled();
  const before = await state(page);
  await cabin.click({ force: true });
  await page.waitForTimeout(800);
  expect(await state(page)).toEqual(before);
  await expect(page.getByRole('button', { name: 'Choose your seat' })).toBeHidden();
});

test("How it's made opens from the header and the footer and closes with Escape", async ({ page }) => {
  await open(page);
  for (const where of ['banner', 'contentinfo'] as const) {
    const opener = page.getByRole(where).getByRole('button', { name: "How it's made" });
    await opener.click();
    const dialog = page.getByRole('dialog', { name: "How it's made" });
    await expect(dialog).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(opener).toBeFocused();
  }
});

test('on a phone the navigation folds into a menu and nothing overflows', async ({ page }) => {
  await page.setViewportSize({ width: 412, height: 915 });
  await open(page);
  await expect(page.getByRole('button', { name: 'Menu' })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Chapters' })).toBeHidden();
  expect(await page.evaluate(() => document.body.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Menu' }).click();
  await expect(page.getByRole('dialog', { name: 'Menu' }).getByRole('button', { name: 'Cabin' })).toBeVisible();
});

const heroOpacity = (page: Page) =>
  page.getByTestId('hero').evaluate((el) => Number(getComputedStyle(el).opacity));

test('the hero shows the title, three notes and the scroll hint, then gives way on scroll', async ({ page }) => {
  await open(page);
  const hero = page.getByTestId('hero');
  await expect(hero.getByRole('heading', { name: 'Night flight' })).toBeVisible();
  for (const note of ['IST → LIS', '180 seats', '$15']) await expect(hero).toContainText(note);
  await expect(hero.getByText('Scroll to board')).toBeVisible();
  expect(await heroOpacity(page)).toBeGreaterThan(0.95);
  await page.mouse.wheel(0, 600);
  await expect.poll(() => heroOpacity(page), { timeout: 5000 }).toBeLessThan(0.2);
});

type Box = { x: number; y: number; width: number; height: number };
const overlaps = (a: Box, b: Box) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

for (const viewport of [
  { width: 1440, height: 800 },
  { width: 2100, height: 900 },
  { width: 1024, height: 768 },
]) {
  test(`at ${viewport.width}×${viewport.height} each hero note points at the plane and keeps clear of it and the title`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await openHero(page);
    const img = (await page.getByTestId('intro-plane').locator('img').boundingBox())!;
    const { plane } = INTRO.picture;
    const planeBox = {
      x: img.x + plane.left * img.width,
      y: img.y + plane.top * img.height,
      width: (plane.right - plane.left) * img.width,
      height: (plane.bottom - plane.top) * img.height,
    };
    const ends = await page.getByTestId('hero-leader').evaluateAll((lines) =>
      lines.map((l) => {
        const line = l as SVGLineElement;
        const p = new DOMPoint(line.x2.baseVal.value, line.y2.baseVal.value).matrixTransform(line.getScreenCTM()!);
        return { x: p.x, y: p.y };
      }),
    );
    expect(ends).toHaveLength(3);
    for (const [i, e] of ends.entries()) expect(overlaps({ ...e, width: 1, height: 1 }, planeBox), `leader ${i} ends on the plane`).toBe(true);
    const notes = await page.getByTestId('hero-note').evaluateAll((els) => els.map((e) => e.getBoundingClientRect().toJSON() as Box));
    const title = (await page.getByTestId('hero').getByRole('heading').boundingBox())!;
    const rail = (await page.getByRole('navigation', { name: 'Chapters' }).boundingBox())!;
    for (const [i, n] of notes.entries()) {
      expect(overlaps(n, planeBox), `note ${i} vs plane`).toBe(false);
      expect(overlaps(n, title), `note ${i} vs title`).toBe(false);
      expect(overlaps(n, rail), `note ${i} vs chapter rail`).toBe(false);
      expect(n.x >= 0 && n.x + n.width <= viewport.width, `note ${i} on screen`).toBe(true);
    }
  });
}

for (const viewport of [
  { width: 768, height: 1024 },
  { width: 960, height: 800 },
]) {
  test(`at ${viewport.width}×${viewport.height} the hero notes line up under the plane, all on screen and clear of everything`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await openHero(page);
    const notes = await page.getByTestId('hero-note').evaluateAll((els) => els.map((e) => e.getBoundingClientRect().toJSON() as Box));
    const hero = page.getByTestId('hero');
    const others = {
      title: (await hero.getByRole('heading').boundingBox())!,
      plane: (await page.getByTestId('intro-plane').locator('img').boundingBox())!,
      rail: (await page.getByRole('navigation', { name: 'Chapters' }).boundingBox())!,
      lead: (await hero.getByText('Board a fictional night flight.').boundingBox())!,
    };
    const { plane } = INTRO.picture;
    const img = others.plane;
    others.plane = { x: img.x + plane.left * img.width, y: img.y + plane.top * img.height, width: (plane.right - plane.left) * img.width, height: (plane.bottom - plane.top) * img.height };
    expect(notes).toHaveLength(3);
    for (const [i, n] of notes.entries()) {
      expect(n.x >= 0 && n.x + n.width <= viewport.width && n.y + n.height <= viewport.height, `note ${i} on screen`).toBe(true);
      for (const [name, b] of Object.entries(others)) expect(overlaps(n, b), `note ${i} vs ${name}`).toBe(false);
      for (let j = i + 1; j < notes.length; j++) expect(overlaps(n, notes[j]), `notes ${i}/${j}`).toBe(false);
    }
    const lead = (await hero.locator('p', { hasText: 'Board a fictional night flight.' }).boundingBox())!;
    const scroll = (await hero.getByText('Scroll to board').boundingBox())!;
    expect(overlaps(lead, scroll), 'lead vs scroll hint').toBe(false);
  });
}

test('on a phone the hero notes stack and nothing overflows', async ({ page }) => {
  await page.setViewportSize({ width: 412, height: 915 });
  await open(page);
  const boxes = await page.getByTestId('hero-note').evaluateAll((els) => els.map((e) => e.getBoundingClientRect().toJSON() as DOMRect));
  const title = (await page.getByTestId('hero').getByRole('heading').boundingBox())!;
  const overlap = (a: { x: number; y: number; width: number; height: number }, b: typeof a) =>
    a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
  expect(boxes).toHaveLength(3);
  for (let i = 0; i < boxes.length; i++) {
    expect(overlap(boxes[i], title), `note ${i} vs title`).toBe(false);
    for (let j = i + 1; j < boxes.length; j++) expect(overlap(boxes[i], boxes[j]), `notes ${i}/${j}`).toBe(false);
  }
  expect(await page.evaluate(() => document.body.scrollWidth <= innerWidth)).toBe(true);
});

test('while seated, choosing Your seat keeps the seat', async ({ page }) => {
  await open(page);
  await page.evaluate(() => {
    const s = (window as unknown as StoreWindow).__aslan.store.getState();
    s.setProgress(0.6);
    s.seats.find((x) => x.id === '14F')!.status = 'free';
    s.sit('14F');
  });
  await expect.poll(async () => (await state(page)).phase).toBe('seated');
  await page.getByRole('navigation', { name: 'Sections' }).getByRole('button', { name: 'Your seat' }).click();
  await page.getByRole('navigation', { name: 'Chapters' }).getByRole('button', { name: /Your seat/ }).click();
  await page.waitForTimeout(800);
  expect(await state(page)).toMatchObject({ phase: 'seated' });
  expect(await page.evaluate(() => (window as unknown as { __aslan: { store: { getState(): { selectedSeatId: string } } } }).__aslan.store.getState().selectedSeatId)).toBe('14F');
});

test('the scroll hint rises in from below, its light runs down the line smoothly, and it settles centred', async ({ page }) => {
  await open(page);
  const hint = page.getByTestId('hero').locator('p', { hasText: 'Scroll to board' });
  const frames = await hint.evaluate((el) => {
    const a = el.getAnimations().find((x) => (x.effect as KeyframeEffect).getKeyframes().some((k) => 'transform' in k))!;
    return (a.effect as KeyframeEffect).getKeyframes().map((k) => String(k.transform ?? ''));
  });
  // translateY in px or rem (16 px)
  const m = /translateY\((-?[\d.]+)(px|rem)/.exec(frames[0]);
  const rise = m ? Number(m[1]) * (m[2] === 'rem' ? 16 : 1) : 0;
  expect(rise, frames[0]).toBeGreaterThanOrEqual(16);
  // the line draws in, then a light runs down it for good — transform and opacity only, so it never stutters
  const line = await hint.evaluate((el) => {
    const props = (target: Element) =>
      target.getAnimations().flatMap((a) =>
        (a.effect as KeyframeEffect).getKeyframes().flatMap((k) => Object.keys(k).filter((x) => !['offset', 'easing', 'composite', 'computedOffset'].includes(x))),
      );
    const lineEl = el.querySelector('[data-part="cue-line"]')!;
    const glint = el.querySelector('[data-part="cue-glint"]')!;
    const run = glint.getAnimations().find((a) => a.effect!.getComputedTiming().iterations === Infinity);
    return { line: props(lineEl), glint: props(glint), runs: !!run };
  });
  expect(line.line).toContain('transform');
  expect(line.runs, 'the light keeps running').toBe(true);
  expect([...line.line, ...line.glint].every((p) => p === 'transform' || p === 'opacity'), [...line.line, ...line.glint].join(',')).toBe(true);
  await page.waitForFunction(() => document.getElementById('loader')?.dataset.ready === 'true');
  await page.waitForTimeout(2500);
  const box = (await hint.boundingBox())!;
  const { width } = page.viewportSize()!;
  expect(Math.abs(box.x + box.width / 2 - width / 2)).toBeLessThan(2);
});
