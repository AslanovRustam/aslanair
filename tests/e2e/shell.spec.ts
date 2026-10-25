import { expect, test, type Page } from '@playwright/test';
import { copy } from '@/content/copy';
import { INTRO } from '@/experience/introState';
import { heroPictureBox, loaderGone, pre, progress, settledProgress, waitForStore, wheelTo } from './helpers';

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
    s.setProgress(__pre('aisle', 0.27));
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

test("there is no How it's made: not in the header, the phone menu or the outro (spec r5 §8)", async ({ page }) => {
  await open(page);
  await expect(page.getByRole('banner').getByRole('button', { name: "How it's made" })).toHaveCount(0);
  await page.setViewportSize({ width: 412, height: 915 });
  await page.getByRole('button', { name: 'Menu' }).click();
  await expect(page.getByRole('dialog', { name: 'Menu' }).getByRole('button', { name: "How it's made" })).toHaveCount(0);
  await page.keyboard.press('Escape');
  await page.setViewportSize({ width: 1440, height: 800 });
  await page.evaluate(() => {
    const s = (window as unknown as StoreWindow).__aslan.store.getState();
    s.setProgress(__pre('aisle', 0.27));
    const seat = s.seats.find((x) => x.status === 'free')!;
    s.sit(seat.id);
    s.confirm();
    s.setProgress(0.9);
  });
  await expect(page.getByText(copy.outro.made.lead)).toBeVisible();
  await expect(page.getByRole('button', { name: "Read how it's made" })).toHaveCount(0);
});

test('the footer credits Aslanov Rustam and links to GitHub in a new tab', async ({ page }) => {
  await open(page);
  const footer = page.getByRole('contentinfo');
  await expect(footer).toContainText('Concept & code: Aslanov Rustam');
  const github = footer.getByRole('link', { name: 'GitHub' });
  await expect(github).toHaveAttribute('href', 'https://github.com/AslanovRustam');
  await expect(github).toHaveAttribute('target', '_blank');
  await expect(github).toHaveAttribute('rel', /noopener/);
});

test('on a phone at night the footer shows the author and the sky credit without overflowing', async ({ page }) => {
  await page.setViewportSize({ width: 412, height: 915 });
  await open(page);
  await page.evaluate(() => (window as unknown as StoreWindow).__aslan.store.getState().setProgress(__pre('aisle', 0.27)));
  const footer = page.getByRole('contentinfo');
  await expect(footer).toContainText('Concept & code: Aslanov Rustam');
  await expect(footer.getByRole('link', { name: 'GitHub' })).toBeVisible();
  await expect(footer.getByRole('link', { name: /ESO\/S\. Brunier/ })).toBeVisible();
  await expect(footer.getByRole('link', { name: 'CC BY 4.0' })).toBeVisible();
  await expect(footer).toContainText('Clouds: NASA');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(412);
  const outside = await footer.evaluate((f) =>
    [...f.querySelectorAll('p, a, span')].filter((e) => {
      const b = e.getBoundingClientRect();
      return b.width > 0 && (b.left < -1 || b.right > window.innerWidth + 1);
    }).length,
  );
  expect(outside, 'footer parts outside the screen').toBe(0);
});

test('while the night sky shows, the footer credits its panorama and licence', async ({ page }) => {
  await open(page);
  const footer = page.getByRole('contentinfo');
  const panorama = footer.getByRole('link', { name: /ESO\/S\. Brunier/ });
  await expect(panorama).toHaveCount(0);
  await page.evaluate(() => (window as unknown as StoreWindow).__aslan.store.getState().setProgress(__pre('aisle', 0.27)));
  await expect(panorama).toHaveAttribute('href', 'https://www.eso.org/public/images/eso0932a/');
  await expect(footer.getByRole('link', { name: 'CC BY 4.0' })).toHaveAttribute('href', 'https://creativecommons.org/licenses/by/4.0/');
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

test('the hero shows only the title and the scroll hint, then gives way on scroll', async ({ page }) => {
  await open(page);
  const hero = page.getByTestId('hero');
  await expect(hero.getByRole('heading', { name: 'Night flight', exact: true })).toBeVisible();
  await expect(hero.locator('[data-testid="hero-note"], [data-testid="hero-leader"]')).toHaveCount(0);
  await expect(hero).not.toContainText('Board a fictional night flight');
  await expect(hero.getByText('Scroll to board')).toBeVisible();
  expect(await heroOpacity(page)).toBeGreaterThan(0.95);
  await loaderGone(page); // the page holds still while the loader hands over
  await page.mouse.wheel(0, 600);
  await expect.poll(() => heroOpacity(page), { timeout: 5000 }).toBeLessThan(0.2);
});

test('the title flies apart letter by letter on scroll and gathers again on the way back', async ({ page }) => {
  await openHero(page);
  const title = page.getByTestId('hero').getByRole('heading', { name: 'Night flight', exact: true });
  const letters = title.locator('[data-part="letter"]');
  await expect(letters).toHaveCount('NIGHTFLIGHT'.length);
  const read = () =>
    letters.evaluateAll((els) =>
      els.map((e) => {
        const el = e as HTMLElement;
        const style = getComputedStyle(el);
        return { transform: style.transform, opacity: Number(style.opacity), box: [el.offsetLeft, el.offsetTop, el.offsetWidth, el.offsetHeight].join(',') };
      }),
    );
  const identity = (t: string) => t === 'none' || t === 'matrix(1, 0, 0, 1, 0, 0)';
  const top = await read();
  for (const [i, l] of top.entries()) expect(identity(l.transform) && l.opacity === 1, `letter ${i} in place: ${l.transform}`).toBe(true);
  // the entrance and the scatter move the letters with transform and opacity only
  const animated = await letters.evaluateAll((els) =>
    els.flatMap((el) =>
      el.getAnimations({ subtree: true }).flatMap((a) =>
        (a.effect as KeyframeEffect).getKeyframes().flatMap((k) => Object.keys(k).filter((x) => !['offset', 'easing', 'composite', 'computedOffset'].includes(x))),
      ),
    ),
  );
  expect(animated.every((p) => p === 'transform' || p === 'opacity'), animated.join(',')).toBe(true);

  await wheelTo(page, pre('sky', 0.45));
  const apart = await read();
  for (const [i, l] of apart.entries()) {
    expect(identity(l.transform), `letter ${i} has moved`).toBe(false);
    expect(l.box, `letter ${i} keeps its layout box`).toBe(top[i].box);
  }

  await page.mouse.wheel(0, -20000);
  await expect.poll(() => progress(page), { timeout: 10_000 }).toBeLessThan(1e-3);
  await settledProgress(page);
  const back = await read();
  for (const [i, l] of back.entries()) expect(identity(l.transform) && l.opacity === 1, `letter ${i} back in place: ${l.transform}`).toBe(true);
  await expect(title).toBeVisible();
});

test('while seated, choosing Your seat keeps the seat', async ({ page }) => {
  await open(page);
  await page.evaluate(() => {
    const s = (window as unknown as StoreWindow).__aslan.store.getState();
    s.setProgress(__pre('aisle', 0.27));
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

test('the hero plane clears the scroll hint', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 800 });
  await openHero(page);
  const img = heroPictureBox(page);
  const { plane } = INTRO.picture;
  const planeBottom = img.y + plane.bottom * img.height;
  const cue = (await page.getByTestId('hero').getByText('Scroll to board').boundingBox())!;
  expect(cue.y - planeBottom, `plane bottom ${planeBottom.toFixed(0)} px, cue top ${cue.y.toFixed(0)} px`).toBeGreaterThanOrEqual(40);
});

test('the logo leads back to the hero: under the curtain from far away, a scroll from the first screen', async ({ page }) => {
  await page.goto('/');
  await waitForStore(page);
  await loaderGone(page);
  const logo = page.getByRole('banner').getByRole('button', { name: /back to the start/ });
  await wheelTo(page, pre('destinations', 0.3)); // a real scroll: the page and the store agree
  await logo.click();
  await expect.poll(() => progress(page), { timeout: 8000 }).toBe(0);
  await wheelTo(page, pre('sky', 0.3));
  await logo.click();
  await expect.poll(() => progress(page), { timeout: 5000 }).toBeLessThan(0.002);
});
