# AslanAir — Plan 4c: Premium Polish of the Journey Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the journey look premium. The work:
- a clean first screen with a bigger plane that shrinks away behind the globe;
- a grid backdrop that lights up under the cursor;
- choreographed text and card entrances, and accordion transfer cards with prices;
- a "liquid curtain" chapter transition that our live 3D plane flies across;
- a door glow that hugs the door;
- a lettered flight-deck door and a real-looking galley;
- smooth window outlines;
- a night sky and clouds made from images and sprites instead of the raymarch;
- no ribbons.

**Architecture:** Each new behaviour gets a pure decision module, and thin components apply it. That is the house pattern.

| Module | Decides |
|---|---|
| `grid.ts` | where the grid shows, the trail fade |
| `reveal.ts` | the shown window with hysteresis |
| `transfers` additions in `destinations.ts` | prices, the evening timeline |
| `curtain.ts` | the transition timeline |
| `windowBezel.ts` | the bezel geometry |
| `clouds.ts` | the sprite cloud layout and drift |

The curtain is drawn in the one WebGL canvas:
- **cover and reveal:** a full-screen shader quad drawn last;
- **covered:** the camera switches to a curtain layer that holds only the lights and a clone of the airliner. The clone shares the original's geometry and materials, so nothing downloads or compiles twice.
- the DOM draws only the label and the bar.

The night sky:
- a star panorama on the backdrop, with the existing crisp moon and stars over it;
- a photographic cloud sea as a plane far below;
- instanced, moon-lit sprite clouds in between.

The raymarch pipeline is deleted.

**Tech Stack:** as in Plans 1–4b. The stack is Next 16, React 19, R3F 9, three 0.186, drei, zustand, GSAP/Lenis, Vitest and Playwright, plus the Blender kit and airliner pipeline. Nothing new is installed. `sharp` (already in `node_modules` through Next) encodes WebP in tools.

**Spec:** `docs/superpowers/specs/2026-10-24-aslanair-design-r4-polish.md` (r4). It sits on r3 (`…-design-r3-journey.md`), r2 (`…-design-r2-night.md`) and the base spec. Where they differ, r4 wins.

**Depends on:** branch `feat/plan-4c-polish`, cut from `feat/plan-4b-journey` (Plan 4b, unmerged; merges only on the user's word).

## Global Constraints

**Copy and content**
- Copy is English, all in `src/content/copy.ts`. Pinned labels keep their wording: `Pick for me`, `Choose this seat`, `See another`, `Change seat`, `Buy`, `Name`, `E-mail`, `Comment`, `Start again`, `How will you get to the airport?`.
- Author line, footer and How it's made panel: `Concept & code: Aslanov Rustam · GitHub`. "GitHub" links to `https://github.com/AslanovRustam` (`target="_blank" rel="noopener noreferrer"`). This replaces Plan 5's placeholder rule.
- Transfer prices: From home **$24**, From your hotel **$18**, Airport express **$9**, On my own **Free**. No total anywhere; the boarding pass shows the transfer without a price.
- Flight-deck placard: `FLIGHT DECK` over `CREW ONLY`.

**Motion and rendering**
- DOM motion uses `transform` and `opacity` only. Two exceptions:
  - the transfer accordion's widths, inside a `contain: layout paint` box;
  - the transfer icon's SVG stroke draw-in.
- On a track the camera rides the scroll exactly. Every click-jump hides behind the curtain. The exception is take-off: the pass's Take off button and the rail's "07 Take-off" keep their camera flight.
- The light count never changes, and nothing recompiles after the loader hands over:
  - every new material compiles under the loader;
  - the curtain plane reuses the airliner's programs.
- Never a black screen. The luminance guards in `perf.spec.ts` keep running.
- Every new motion has a `prefers-reduced-motion: reduce` variant.

**Performance and assets**
- Frame-rate gate: the `perf` project (integrated GPU, judged on a quiet GPU), median and mean ≤ 22.2 ms at every measured pose, the new ones included.
- Phones, 412×915 portrait: every chapter fits and nothing overflows.
- Airliner GLB stays at **119 794 ≤ 120 000** triangles: no triangle is added to it. Kit GLB stays ≤ 600 KB.
- Free assets only.
  - Download a file only after the user approves it in chat; name the file, the source and the size.
  - Record each source and licence in `public/images/sky/CREDITS.md` and in the How it's made panel.
  - Serve everything from `public/`, never from a CDN.
- Dev server: port **3200**. Only one `next dev` per project folder; reuse a running one.

## Review Focus

1. **A chapter click while seated or on the pass.** The phase changes, so the camera glides and, for the pass, the track swaps. The curtain must not reveal until the camera has caught up with its pose. Test: Task 7, "from the seat, Destinations reveals only on a settled camera".
2. **A keyboard visitor using the rail.** After the reveal, focus lands on the target chapter's heading, not on the body. Test: Task 7, "keyboard: focus goes to the chapter heading".
3. **Scrolling to and fro across a chapter's edge.** Entrances must not flicker or restart on every pixel. Test: Task 5, "a wobble at the edge does not replay the entrance".
4. **Slow network: the sky images are still loading when the visitor boards.** The night sky still shows the gradient, the moon and the stars, never black, and the loader is never held up. Test: Task 11, "the loader never waits for the sky images".
5. **The pointer leaves the page, or a finger lifts.** The grid's glow fades out instead of sticking at the last spot. Test: Task 4, "the glow fades when the pointer leaves".

---

## File Structure

```
src/experience/grid.ts            NEW (pure): gridOpacity(), trailAlpha(), cellOf()
src/experience/reveal.ts          NEW (pure): nextShown() — shown window with hysteresis
src/experience/curtain.ts         NEW (pure): CURTAIN timings, curtainFrame(), reducedCurtainFrame()
src/experience/curtainStore.ts    NEW: vanilla zustand store of the running transition
src/experience/clouds.ts          NEW (pure): puffLayout(), puffTexels(), wrapAround()
src/experience/windowBezel.ts     NEW (pure): bezelGeometryData(), BEZEL
src/experience/linerProfile.ts    MOVED from tests/unit/linerProfile.ts (site + tests use it)
src/experience/destinations.ts    TRANSFERS + priceUsd, rideMinutes; transferTimeline()
src/experience/stage.ts           departure() now shrinks towards and behind the globe
src/experience/cameraPoses.ts     sky gaze keeps the globe in frame for the departure
src/experience/introState.ts      bigger hero (heroScale, heroLift, HERO_FIT); picture 2× WebP
src/experience/navState.ts        transitionLabel()
src/experience/geometry.ts        DOOR_1L.radius, WINDOW.r
src/experience/cabinLayout.ts     COCKPIT_PLACARD
src/ui/Hero.tsx, hero.module.css  facts, leaders and lead removed
src/ui/Shell.tsx, shell.module.css footer author link; no footer How it's made; clicks go through transitionTo()
src/ui/GridBackdrop.tsx, grid.module.css  NEW
src/ui/RevealText.tsx, reveal.module.css  NEW: word-split heading/paragraph; card stagger
src/ui/Transfer.tsx, transfer.module.css  accordion
src/ui/Curtain.tsx, curtain.module.css, transition.ts  NEW: label + bar; transitionTo()
src/ui/Ribbons.tsx, ribbons.module.css    REMOVED
src/scene/CurtainPass.tsx         NEW: curtain quad, plane clone, layer switch
src/scene/aircraft/doorGlow.ts    NEW: withDoorGlow() hull-material injection; Aircraft.tsx drops the quad
src/scene/cabin/EntryZone.tsx     placard face; galley latches/dark parts
src/scene/cabin/WindowBezels.tsx  NEW
src/scene/cabin/materials.ts      brushed steel map, latch and dark materials, bezel material
src/scene/sky/SkyAndClouds.tsx, shaders.ts  image sky + cloud sea + puffs; raymarch removed
src/scene/sky/CloudSea.tsx, CloudPuffs.tsx  NEW
src/scene/sky/noise3d.ts, src/experience/cloudDetail.ts  REMOVED (with their tests)
tools/capture-plane.mjs           2× capture, WebP out
tools/blender/aslanair/kit.py, geometry.py, export.py  galley parts, placard size; meta radius/r
public/images/plane-hero.webp (replaces .png), public/images/sky/{stars.webp,cloud-sea.webp,CREDITS.md}
tests/unit: grid, reveal, curtain, clouds, windowBezel (NEW); stage, destinations, introState, planeImage,
            kitAsset, aircraftAsset, navState (updated); cloudDetail, noise3d (removed)
tests/e2e: grid, reveal, curtain (NEW); shell, intro, loader, journey-choices, night, cabin, perf (updated);
           ribbons (removed)
```

---

### Task 1: A cleaner first screen and shell; ribbons gone

**Files:**
- Modify: `src/ui/Hero.tsx`, `src/ui/hero.module.css`, `src/ui/Shell.tsx`, `src/ui/shell.module.css`, `src/ui/HowItsMade.tsx`, `src/content/copy.ts`, `src/scene/Experience.tsx`
- Remove: `src/ui/Ribbons.tsx`, `src/ui/ribbons.module.css`, `tests/e2e/ribbons.spec.ts`
- Test: `tests/e2e/shell.spec.ts`, `tests/e2e/perf.spec.ts` (drop the `ribbons` shot)

**Interfaces:**
- Produces:
  - `copy.author = { line: 'Concept & code: Aslanov Rustam', link: 'GitHub', href: 'https://github.com/AslanovRustam' }`, used by the footer and `HowItsMade`;
  - `copy.hero` keeps only `title` and `scroll`;
  - `copy.ribbons` is gone.

- [ ] **Step 1: Write the failing tests**

In `shell.spec.ts`:
- Replace "the hero shows the title, three facts…" with "the hero shows only the title and the scroll hint". Assertions:
  - `hero` contains no `[data-testid="hero-note"]` and no `[data-testid="hero-leader"]`;
  - it does not contain `Board a fictional night flight`;
  - the heading `Night flight` and `Scroll to board` are visible;
  - the opacity checks stay as they are.
- Delete the two hero-note layout tests and the phone hero-notes test.
- Replace "How it's made opens from the header and the footer" with the header only.
- Add `test('the footer credits Aslanov Rustam and links to GitHub in a new tab')`:
  - `contentinfo` contains `Concept & code: Aslanov Rustam`;
  - the link `GitHub` has `href` `https://github.com/AslanovRustam`, `target` `_blank` and a `rel` containing `noopener`;
  - `contentinfo` has no `How it's made` button;
  - the How it's made dialog (opened from the banner) shows the same line.

- [ ] **Step 2: Run them to verify they fail**

Run: `npx playwright test tests/e2e/shell.spec.ts --project=chromium`
Expected: FAIL on the hero and footer tests.

- [ ] **Step 3: Implement**

- Hero: remove `NOTES`, `Note`, `planeBoxVars`, the leaders SVG, the notes list and the lead, with their CSS (`.planeBox`, `.leaders`, `.note*`, `.lead`, and their container and phone rules). `LOWEST_FARE` and the `DESTINATIONS` import go if unused.
- Shell footer: disclaimer, then the author line with the link. Remove the footer's How it's made button and `.footerLink`.
- HowItsMade: the same author line with the link.
- Experience: drop `<Ribbons />`. Delete the ribbon files and the ribbons spec. Remove `copy.ribbons`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx playwright test tests/e2e/shell.spec.ts tests/e2e/journey-choices.spec.ts --project=chromium && npm run lint && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A src tests
git commit -m "feat: a clean first screen and footer credit; the ribbons are gone"
```

---

### Task 2: A bigger hero plane and a sharp 2× picture

**Files:**
- Modify: `src/experience/introState.ts`, `tools/capture-plane.mjs`, `src/scene/CaptureMode.tsx` (only if the capture needs it), `src/ui/Loader.tsx`, `src/app/page.tsx`
- Replace: `public/images/plane-hero.png` → `public/images/plane-hero.webp`
- Test: `tests/unit/introState.test.ts`, `tests/unit/planeImage.test.ts`, `tests/e2e/loader.spec.ts`, `tests/e2e/intro.spec.ts` (unchanged logic; must still pass)

**Interfaces:**
- Produces: `INTRO.heroScale`, `INTRO.heroLift` and `HERO_FIT` retuned (spec r4 §3.2). The lift may go negative.
  - At 16:9 the plane's box is **0.62–0.70 of the frame width**. The picture is 16:9 like the frame, so the share is `(plane.right − plane.left) × heroScale(16/9)`.
  - Its vertical middle, `0.5 − lift + ((plane.top + plane.bottom)/2 − 0.5) × heroScale`, sits at **0.47–0.56 of the frame height**.
  - At 1440×800 the plane's box ends ≥ 40 px above the scroll cue's top.
  - `INTRO.picture` becomes `{ src: '/images/plane-hero.webp', width: 1600, height: 900, plane: … }`. Width and height stay CSS pixels; the file is 3200×1800. Re-measure `plane` if the capture changes it.
- Constraint: `heroScale(aspect)` keeps its narrow-screen fit: the whole plane stays within 0.9 of a phone's width.

- [ ] **Step 1: Write the failing tests**

In `introState.test.ts`, add `test('the hero plane fills two thirds of a 16:9 frame, its middle near the centre')`. Compute from `INTRO.picture.plane`, `heroScale(16/9)` and `HERO_PICTURE.lift`:
- width share in `[0.62, 0.70]`;
- vertical middle in `[0.47, 0.56]`.

In `shell.spec.ts`, add `test('the hero plane clears the scroll hint')`. At 1440×800 the plane box from `heroPictureBox` in helpers ends ≥ 40 px above the top of `Scroll to board`'s box.

The existing projection and phone tests stay.

In `planeImage.test.ts`, use `sharp(...).metadata()`:
- the file is `public/images/plane-hero.webp`, 3200×1800, has an alpha channel, and is ≤ 500 KB;
- the alpha test reads the WebP;
- add a check that the measured alpha box matches `INTRO.picture.plane` to within 0.01 (Plan 5 carry-over).

In `loader.spec.ts`, the preload regex matches `plane-hero\.webp`.

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run tests/unit/introState.test.ts tests/unit/planeImage.test.ts`
Expected: FAIL. The width share is about 0.29 today, and the file is missing.

- [ ] **Step 3: Implement**

- Retune `heroScale`/`heroLift`. The camera (`heroFov`) follows by itself.
- `capture-plane.mjs`:
  - `deviceScaleFactor: 2`;
  - screenshot to a buffer, then `sharp(buf).webp({ quality: 88, alphaQuality: 90, effort: 6 })` to `public/images/plane-hero.webp`;
  - log the size;
  - delete the old PNG.
- Run the capture with the dev server on :3200 (reuse the running one).
- `page.tsx` preload and `Loader.tsx` `src` come from `INTRO.picture.src`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run capture:plane && npx vitest run && npx playwright test tests/e2e/intro.spec.ts tests/e2e/loader.spec.ts --project=chromium`
Expected: PASS, including the hand-over at 1440×800, 2100×900 and 412×915 (mean difference ≤ 10).

- [ ] **Step 5: Commit**

```bash
git add -A src tools public/images tests
git commit -m "feat: the hero plane fills the first screen; a 2× WebP picture for the hand-over"
```

---

### Task 3: The plane shrinks away behind the globe

**Files:**
- Modify: `src/experience/stage.ts` (`departure`), `src/experience/cameraPoses.ts` (`SKY.gazeDown`/`gazeLeft` if needed), `src/experience/globe.ts` (`globeFade` sky window if needed)
- Test: `tests/unit/stage.test.ts`

**Interfaces:**
- Consumes: `GLOBE` (centre, radius), `ON_GLOBE_SCALE`, `INTRO.swapPose.position` (the sky camera).
- Produces: `aircraftStage('browse', sky t)` with the same signature. The new path (spec r4 §3.4):
  - from rest the plane turns towards the globe and flies off;
  - its scale falls geometrically from 1 to `ON_GLOBE_SCALE` (`scale = ON_GLOBE_SCALE ** e(t)`, where `e` eases 0 → 1);
  - it ends at `BEHIND_GLOBE`. That is the point on the ray from the sky camera through `GLOBE.center`, `0.5 × GLOBE.radius` beyond the centre, so the globe hides it whole;
  - the path crosses the globe's visible limb, so the visitor sees it go behind the edge, not dive through the face;
  - bank ≤ 25°.
- The destinations chapter is unchanged: the plane still arrives over the horizon. Between the two chapters it changes place hidden behind the globe.

- [ ] **Step 1: Write the failing tests** (replace the sky tests in `stage.test.ts`)

- `showing()` now applies the globe's occlusion in the sky chapter too: `globeFade ≥ 0.9` and `!unhidden`.
- `test('on the first screen it banks gently as it turns towards the globe, never past 25°')`: max roll in `(8°, 25°]`.
- For each aspect in `ASPECTS`, `test('at ${aspect} it flies off towards the globe, shrinking, and goes behind it before the first screen ends')`:
  - `inFrame(boxAt(0))`;
  - area(box at sky 0.5) ≤ 0.4 × area(box at 0);
  - from sky 0.1 on, every step's area ≤ 1.02 × the previous step's while showing;
  - while showing in the sky chapter, the box centre stays inside the frame: it never leaves through an edge;
  - there is a `tHide < 0.97` from which, at every later sky step, the box is in frame and `globeFade('browse', p) ≥ 0.9` and the plane is hidden (`!unhidden`);
  - `worstStep([...across('sky'), ...across('destinations', 0.01, 0.5)], aspect) ≤ PER_VH`.
- Keep "it changes place unseen…", now true because it is behind the globe at both ends.
- Keep all destinations, transfer and ready tests unchanged.

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run tests/unit/stage.test.ts`
Expected: FAIL. Today it leaves up and to the left at full size.

- [ ] **Step 3: Implement `departure(t)`**

A cubic Bézier in world space from the origin to `BEHIND_GLOBE`. The first control point lies along the nose (+x), so the plane starts moving forward. The second lies above the globe's upper limb as seen from the sky camera. Heading follows the curve's tangent, as today.

If the globe is not in frame at the hide point, adjust `SKY.gazeDown`/`gazeLeft` and the sky part of `globeFade`, and keep the intro projection tests green (they pin t = 0 only).

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run && npx playwright test tests/e2e/intro.spec.ts tests/e2e/journey-choices.spec.ts --project=chromium`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src tests
git commit -m "feat: the plane shrinks away from the first screen and slips behind the globe"
```

---

### Task 4: The grid backdrop

**Files:**
- Create: `src/experience/grid.ts`, `src/ui/GridBackdrop.tsx`, `src/ui/grid.module.css`, `tests/unit/grid.test.ts`, `tests/e2e/grid.spec.ts`
- Modify: `src/scene/Experience.tsx` (mount it), `src/ui/Outro.tsx` and `src/ui/ui.module.css` (the outro panel's own grid surface)

**Interfaces:**
- Produces (pure, `grid.ts`):
  - `GRID = { cell: 64, line: 'rgba(242,239,232,0.045)', glowRadius: 220, trailMs: 600 }`;
  - `gridOpacity(phase: Phase, progress: number): number`. It is 1 on the pre track's `sky`, `destinations`, `transfer` and `ready` chapters. In `door` it falls from 1 at t 0.2 to 0 at t 0.45 (`smoothstep`). It is 0 in `aisle`, for every non-browse phase and on the post track;
  - `trailAlpha(ageMs: number): number`, from 1 at age 0 to 0 at `GRID.trailMs`, eased out;
  - `cellOf(x: number, y: number): [col: number, row: number]`.
- Produces: `GridBackdrop({ surface?: boolean })`.
  - Default: a fixed full-screen layer at `z-index: -2`, under the hero title (−1) and the canvas (0), with `pointer-events: none`. Its opacity comes from `gridOpacity`.
  - `surface`: the same grid absolutely filling its parent, used inside the outro panel and masked by the panel's own left-to-right fade.
  - Layers:
    - the base lines (CSS gradients, `GRID.cell`);
    - the lit lines in `--accent` at 0.55 alpha, under a `radial-gradient(GRID.glowRadius px at var(--mx) var(--my))` mask;
    - a 2D canvas trail. Cells the mouse passes light up in accent at 0.12 alpha and fade by `trailAlpha`. Its rAF loop runs only while a cell is lit.
  - Pointer: from `pointermove` on `window` (passive).
    - A mouse sets the glow centre.
    - A touch shows the glow only while the finger is down and leaves no trail.
    - `pointerleave` on the document, or the end of a touch, fades the glow out over 300 ms.
    - Under reduced motion there is no trail.

- [ ] **Step 1: Write the failing tests**

`grid.test.ts`:
- `gridOpacity` is 1 at `sky 0.3`, `destinations 0.5`, `transfer 0.5` and `ready 0.5`;
- in `door` it is 1 at t 0.15, strictly between 0 and 1 at t 0.3, and 0 at t 0.5;
- it is 0 at `aisle 0.3`, for `seated`, and for `confirmed` at any progress;
- `trailAlpha(0) = 1`, `trailAlpha(600) = 0`, and it is monotone in between;
- `cellOf(130, 70)` is `[2, 1]`.

`grid.spec.ts` (1440×800):
- **`'the grid lies behind the plane and the title, and lets clicks through'`:**
  - `[data-testid="grid"]` has a computed `z-index` < −1 and `pointer-events: none`;
  - at sky 0.25, in an empty band (y 600–640, x 40–400) there are luminance peaks every 64 ± 1 px, with line pixels brighter than the gaps by ≥ 4.
- **`'the lines near the cursor glow terracotta'`:**
  - move the mouse to (300, 620) and wait 200 ms;
  - in a 40 px box round the cursor, the mean of `r − g` on line pixels is ≥ 12;
  - in a box 500 px away it is ≤ 4.
- **`'the glow fades when the pointer leaves'`:** dispatch `pointerleave` on `document.documentElement` and wait 500 ms; the near box falls back to ≤ 4.
- **`'inside the cabin the grid is gone'`:** at `aisle 0.3` the grid's computed opacity is 0.
- **`'with reduced motion the cells leave no trail'`:** `emulateMedia({ reducedMotion: 'reduce' })`, move the mouse along a 300 px path, and the trail canvas has 0 non-transparent pixels.
- **`'the outro panel has its grid'`:** confirm a seat, go to the outro, and `[data-testid="grid-surface"]` is visible inside the outro.

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run tests/unit/grid.test.ts && npx playwright test tests/e2e/grid.spec.ts --project=chromium`
Expected: FAIL (modules missing).

- [ ] **Step 3: Implement** `grid.ts`, `GridBackdrop`, the CSS, the mount in `Experience` before the canvas wrapper, and the outro surface.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run && npx playwright test tests/e2e/grid.spec.ts tests/e2e/journey-choices.spec.ts tests/e2e/night.spec.ts --project=chromium`
Expected: PASS. Two existing tests are the guards:
- globe drag still works ("the globe spins under the mouse…");
- "before boarding the background is the plain dark of the site" holds, because its corner probes sit in grid gaps. If one lands on a line, move the probe off the 64 px lines; do not weaken the threshold.

- [ ] **Step 5: Commit**

```bash
git add src tests
git commit -m "feat: a grid backdrop that lights up under the cursor"
```

---

### Task 5: Choreographed entrances for text and cards

**Files:**
- Create: `src/experience/reveal.ts`, `src/ui/RevealText.tsx`, `src/ui/reveal.module.css`, `tests/unit/reveal.test.ts`, `tests/e2e/reveal.spec.ts`
- Modify: `src/ui/Destinations.tsx`, `src/ui/Transfer.tsx` (title and lead only; the cards come in Task 6), `src/ui/Ready.tsx`, `src/ui/Overlay.tsx` (captions), `src/ui/Outro.tsx` (title), and their CSS modules

**Interfaces:**
- Produces (pure):
  - `nextShown(prev: boolean, t: number | null, window: { from: number; to: number }, slack = 0.03): boolean`;
    - it turns on inside `[from, to]`;
    - once on, it turns off only below `from − slack`, above `to + slack`, or when `t` is null (another chapter).
- Produces (UI):
  - `useShown(chapter: ChapterId, window)`, a hook over `nextShown` that keeps the previous value in a ref, used by Destinations, Transfer and Ready;
  - `RevealText({ as, text, base?: number, className?, ...rest })`:
    - renders its words as `<span class="w" style="--i:n">` inside an element whose accessible name is the full text (an `aria-label` on the element, `aria-hidden` on the word spans);
    - the words animate (`translateY(0.6em)` + opacity 0 → none, 0.7 s, `cubic-bezier(0.2,0.7,0.2,1)`, delay `base + i × 55 ms`) whenever an ancestor carries `[data-shown='true']` or `[data-reveal='on']`;
  - cards: elements with `data-stagger` and `--d` rise in (`translateY(1.25rem)` + opacity, 0.6 s, delay `250 ms + d × 80 ms`), the departures rows capped at `d = 8`;
  - reduced motion: opacity only, 0.25 s, no delays;
  - headings carry `data-heading="<chapterId>"` (Task 7 focuses them): sky (hero h1), destinations, transfer, ready, door, aisle and pass (captions).

- [ ] **Step 1: Write the failing tests**

`reveal.test.ts`:
- `nextShown(false, 0.3, {from: .28, to: .6})` is true, and `nextShown(false, 0.27, …)` is false;
- once on, it stays on at 0.26 and at 0.62, and turns off at 0.24 and at 0.64;
- it is false for `null`.

`reveal.spec.ts`:
- **`'chapter titles come in word by word, staggered, and settle'`:**
  - wheel to `destinations 0.45`;
  - the title's word spans have running animations whose delays strictly increase;
  - after 1.6 s every word has computed opacity 1;
  - every keyframe property is `transform` or `opacity`.
- **`'a wobble at the edge does not replay the entrance'`** (Review Focus 3):
  - at `destinations 0.29`, record the first word's animation `startTime`;
  - set progress to 0.27, then 0.29;
  - the same Animation object is still running, with the same `startTime`.
- **`'scrolling away and back replays it'`:** go to transfer, then back to destinations; the animation restarts (`currentTime` < 300 ms right after re-entry).
- **`'reduced motion: opacity only, quick'`:** every keyframe set lacks `transform`, and every duration is ≤ 300 ms.
- **`'the departures rows rise in one after another'`:** the delays of rows 1–3 increase.

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run tests/unit/reveal.test.ts && npx playwright test tests/e2e/reveal.spec.ts --project=chromium`
Expected: FAIL.

- [ ] **Step 3: Implement**

`reveal.ts`, the hook, `RevealText` and the CSS. Then wire them in:
- the chapters' `shown` selectors become `useShown`;
- the titles and leads use `RevealText`;
- the captions and the outro title use `RevealText` under `data-reveal="on"` (they mount with their chapter, so they play on mount);
- the departures rows and the flight card get `data-stagger`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run && npx playwright test tests/e2e/reveal.spec.ts tests/e2e/journey-choices.spec.ts tests/e2e/journey.spec.ts --project=chromium`
Expected: PASS. "ready: the promise lights up word by word… with opacity alone" still passes: the new entrance uses transform and opacity only.

- [ ] **Step 5: Commit**

```bash
git add src tests
git commit -m "feat: chapter words and cards come in with a staggered entrance"
```

---

### Task 6: Transfer as an accordion, with prices and the evening's timeline

**Files:**
- Modify: `src/experience/destinations.ts`, `src/content/copy.ts`, `src/ui/Transfer.tsx`, `src/ui/transfer.module.css`
- Test: `tests/unit/destinations.test.ts`, `tests/e2e/journey-choices.spec.ts`

**Interfaces:**
- Produces:
  - `TRANSFERS: { id: TransferId; minutesBefore: number | null; rideMinutes: number | null; priceUsd: number }[]`:

    | id | minutesBefore | rideMinutes | priceUsd |
    |---|---|---|---|
    | home | 180 | 60 | 24 |
    | hotel | 150 | 45 | 18 |
    | express | 120 | 40 | 9 |
    | own | null | null | 0 |

  - `CHECK_IN_CLOSES = 40` (minutes before departure);
  - `transferTimeline(departs: string, id: TransferId): { kind: 'pickup' | 'airport' | 'own' | 'checkin' | 'departs'; time: string | null }[]`:
    - with a ride: `[pickup, airport (pickup + ride), departs]`;
    - for own: `[own (time null), checkin (departs − 40), departs]`;
  - `transferHeadline(departs, id): string`, the big time: the pick-up time, or check-in closing for own;
  - copy:
    - `transfer.lead = 'Times count back from your departure.'`;
    - `transfer.price(usd) = usd === 0 ? 'Free' : '$' + usd`;
    - `transfer.timeline = { pickup: 'Pick-up', airport: 'At the airport', own: 'On your own', checkin: 'Check-in closes', departs: 'Departs' }`;
    - `transfer.selected = 'Selected ✓'`, `transfer.choose = 'Choose ↗'`.
- Layout (spec r4 §6):
  - desktop: four cards in a row, height `min(26rem, 52vh)`, inside `.side`, clear of the waiting plane;
  - the expanded card is `flex-grow: 6`, a strip is `flex-grow: 1` (min 4.5rem); widths animate 0.5 s inside `contain: layout paint`;
  - expanded content is laid out at its full width from the start, so it never reflows;
  - a strip shows its number (01–04), its icon and its name in `writing-mode: vertical-rl`;
  - the expanded card shows its number, the big line icon (stroke draw-in on expand), the name, the line, the big time (display face, size like a chapter title), the timeline and the price;
  - expanded = hovered (`(hover: hover)` only) ?? focused ?? chosen;
  - the underlay is a terracotta plate behind each card. The chosen card lifts `0.6rem` to show "Selected ✓". A hovered expanded unchosen card lifts `0.5rem` and rotates `−1.5deg` to show "Choose ↗". Transforms only;
  - `max-aspect-ratio: 6/5`: stacked rows in the same order, collapsed rows ≥ 3.25rem, the expanded row taller; a tap chooses.
- Semantics unchanged: a radiogroup named by the title, radios named by their content (they still match `/From home/`), arrow keys move and choose, Space/Enter choose.

- [ ] **Step 1: Write the failing tests**

`destinations.test.ts`:
- the prices are 24/18/9/0;
- `transferTimeline('22:40', 'home')` → times `19:40`, `20:40`, `22:40`;
- `transferTimeline('00:20', 'express')` → `22:20`, `23:00`, `00:20`;
- `own` → `[null, '22:00', '22:40']`;
- `transferHeadline('22:40', 'own')` is `'22:00'`.

`journey-choices.spec.ts`:
- Keep "getting to the airport…" as it is.
- Rewrite "transfer choices keep clear of the waiting plane and read in full":
  - for every radio: no overlap with the plane box, on screen and above the footer, height ≥ 44, no overlap with each other;
  - the expanded radio's text is not clipped (`scrollHeight ≤ clientHeight + 1`), and each strip's name is not clipped.
- Add `'hovering a strip opens it; leaving shows the chosen one again'` (1440×800):
  - hover "From home" and its width is > 2× "From your hotel"'s;
  - move the mouse away and "On my own" is the widest;
  - each move goes through the actual `boundingBox`.
- Add `'the chosen card shows its price, its times and Selected'`:
  - click From home; it contains `$24`, `19:40`, `20:40`, `22:40` (LIS departs 22:40) and the visible text `Selected ✓`;
  - On my own shows `Free` and `22:00`.
- Add `'on a phone the cards stack and the chosen one is the tallest'` (412×915, `hasTouch`):
  - the four radios have increasing `y` in order;
  - tapping "From your hotel" makes it the tallest and chosen.

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run tests/unit/destinations.test.ts && npx playwright test tests/e2e/journey-choices.spec.ts --project=chromium -g "transfer|airport|card|phone"`
Expected: FAIL.

- [ ] **Step 3: Implement** the data, the copy and the accordion (Transfer.tsx and transfer.module.css). The boarding pass keeps using `pickupTime` with no price.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run && npx playwright test tests/e2e/journey-choices.spec.ts tests/e2e/reveal.spec.ts --project=chromium`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src tests
git commit -m "feat: transfer cards open like an accordion, with prices and the evening's timeline"
```

---

### Task 7: The curtain transition with the live plane

**Files:**
- Create: `src/experience/curtain.ts`, `src/experience/curtainStore.ts`, `src/ui/transition.ts`, `src/ui/Curtain.tsx`, `src/ui/curtain.module.css`, `src/scene/CurtainPass.tsx`, `tests/unit/curtain.test.ts`, `tests/e2e/curtain.spec.ts`
- Modify:
  - `src/experience/navState.ts` (`transitionLabel`);
  - `src/scroll/SmoothScroll.tsx` (export `lockScroll(on: boolean)`);
  - `src/scene/CameraRig.tsx` (export `cameraSettled(): boolean`, true while it rides its pose);
  - `src/scene/sky/SkyAndClouds.tsx` (the moon and fill lights enable `CURTAIN_LAYER`);
  - `src/scene/Experience.tsx` (mount `CurtainPass` and `Curtain`);
  - `src/ui/Shell.tsx`, `src/ui/Overlay.tsx` (Change seat), `src/ui/Outro.tsx` (Start again);
  - `src/app/globals.css` (the `.chapter-ui` fade);
  - the chapter UI roots (`Hero` front, `Destinations`, `Transfer`, `Ready`, `Overlay`, `Outro`) get the `chapter-ui` class;
- Test: `tests/unit/navState.test.ts`; `tests/e2e/journey-choices.spec.ts` (rewrite the header-jump test); `tests/e2e/shell.spec.ts` (timeouts only if needed); `tests/e2e/perf.spec.ts` (+ a `curtain` measure)

**Interfaces:**
- Produces (pure, `curtain.ts`):
  - `CURTAIN_LAYER = 7`;
  - `CURTAIN = { cover: 0.45, accentLead: 0.08, flight: 0.75, reveal: 0.5, fade: 0.15 }` (seconds);
  - `type CurtainStage = 'idle' | 'cover' | 'covered' | 'reveal'`;
  - `curtainFrame(elapsed: number, readyAt: number | null)` returns `{ stage, accent: { top: number; bottom: number }, dark: { top: number; bottom: number }, bulge: number, plane: number | null, bar: number, done: boolean }`. The fields:

    | Field | Meaning |
    |---|---|
    | `top`/`bottom` | screen fractions from the bottom: the layer covers `[bottom, top]` |
    | cover | the accent rises first; the dark follows `accentLead` later and reaches `top = 1` at `cover` |
    | `covered` | from `cover` until `max(cover + flight, readyAt)` |
    | reveal | both bottoms rise to 1 over `reveal`, dark first, accent `accentLead` later |
    | `bulge` | the edge's curvature, 0 at rest, up to 0.35 mid-move |
    | `plane` | 0 → 1 over the first `flight` seconds of `covered`, then null |
    | `bar` | rises to 0.6 by the end of cover, holds while not ready, reaches 1 at reveal start |

  - `reducedCurtainFrame(elapsed, readyAt)`: the same shape with `stage` running `cover` (fade-in over `fade`) → `covered` → `reveal` (fade-out over `fade`), `plane` always null, `bulge` 0.
- Produces (`curtainStore.ts`, vanilla zustand):
  - `{ stage: CurtainStage; startedAt: number; readyAt: number | null; to: TransitionLabel | null }`;
  - `begin(to: TransitionLabel, now: number): boolean` is false if a transition is already running;
  - `markReady(now)`, `finish()`.
- Produces (`navState.ts`):
  - `type TransitionLabel = { number: string; name: string; heading: ChapterId }`;
  - `transitionLabel(id: HeaderId | RailId | 'cta' | 'restart' | 'change', phase: Phase): TransitionLabel`:

  | id | label | heading |
  |---|---|---|
  | flight | `01 Flight` | sky |
  | destinations | `02 Destinations` | destinations |
  | transfer | `03 Transfer` | transfer |
  | boarding | `04 Boarding` | ready |
  | cabin, cta, change | `05 Cabin` | aisle |
  | seat, pass | `06 Your seat` | `pass` once confirmed, else `aisle` |
  | restart | `01 Flight` | sky |

  `takeoff` is not a transition id.
- Produces (`transition.ts`): `transitionTo(to: TransitionLabel, jump: () => void)`:
  1. `begin`, lock the scroll, set `document.documentElement.dataset.curtain` to the stage on every frame;
  2. at the first `covered` frame: run `jump`;
  3. `markReady` once `cameraSettled()` has held for 2 consecutive frames;
  4. on `done`: `finish`, unlock the scroll (unless the phase is `seated`) and focus `[data-heading="<to.heading>"]` (`tabIndex = -1` if needed);
  5. under reduced motion it uses `reducedCurtainFrame`.
- Produces (`CurtainPass.tsx`, inside the Canvas):
  - a full-screen quad `CurtainQuad` (ShaderMaterial; `transparent`, `depthTest: false`, `depthWrite: false`, `renderOrder: 1e9`, `frustumCulled: false`, visible in `cover`/`reveal`):
    - two layers with quadratic curved edges driven by `curtainFrame`;
    - accent: a terracotta gradient `#d4683a → #8f3a1e`;
    - dark: `#07080b` with a faint navy lift at the top;
  - `CurtainPlane`, a `useGLTF('/models/airliner.glb').scene.clone(true)` with `Cabin*` meshes removed, plus `<NightLights />`, all on `CURTAIN_LAYER` only, visible in `covered` while `plane !== null`. Its pose each frame, from the main camera:
    - `D = 37.6 / (0.55 × 2 tan(fov/2))` ahead;
    - screen-vertical position from +0.75 to −0.75 of the frame height (top to bottom) by `plane`, eased in/out;
    - nose pointing down-screen, top towards the camera;
    - bank `10° × sin(π × plane)`;
    - a stretched additive glow streak behind it, fading;
  - during `covered`: `camera.layers.set(CURTAIN_LAYER)` and `scene.background = new Color('#07080b')`; both restore after;
  - the clone and the quad compile under the loader: mount them inside `CompileAsync`, hidden, and add them to `LoadTracker`'s parts.
- Produces (`Curtain.tsx`): fixed at `z-index: 3`. The chapter UI under it is hidden while the curtain runs. The shell (header, rail, footer, z 4) stays above. The label sits centred, clear of the header. It shows:
  - the label (number in accent, name in ink, display face);
  - a 2 px bar that scales X by `bar`;
  - `aria-hidden`;
  - fades with the stage.
- Global CSS: `html[data-curtain] .chapter-ui { opacity: 0 !important; transition: opacity 0.25s }`, and `visibility: hidden` while `covered`.
- Callers:
  - `Shell.go` calls `transitionTo(transitionLabel(item.id, phase), () => { standUp if needed; scrollToProgress(target, true) })` for every target except `'stay'`, `'panel'`, null and the rail's `takeoff`, which keeps `scrollToProgress(..., false)`;
  - the CTA uses `'cta'`;
  - Overlay Change seat: `transitionTo(transitionLabel('change', phase), changeSeat)`;
  - Outro Start again: `transitionTo(transitionLabel('restart', phase), () => { restart(); scrollToProgress(0, true) })`;
  - Take off on the pass is unchanged.

- [ ] **Step 1: Write the failing tests**

`curtain.test.ts`:
- **stage sequence:** at `0` cover, at `0.2` cover with `accent.top > dark.top`, at `0.46` covered, at `0.46 + 0.75 + 0.01` with `readyAt = 0.5` the stage is `reveal`, and at `0.46 + 0.75 + 0.6` `done`;
- **waiting:** with `readyAt = null` it stays `covered` at `5`, `plane` is null after `cover + flight`, and `bar` holds at 0.6;
- **edges:** `dark.top` is monotone non-decreasing through cover, both `bottom`s are monotone through reveal, and at covered `dark` spans `[0, 1]`;
- `bulge` is 0 at stage boundaries and ≤ 0.35;
- **reduced:** `plane` is never set and `done` arrives at `2 × fade + hold` once ready.

`navState.test.ts`:
- `transitionLabel('destinations', 'browse')` is `{ number: '02', name: 'Destinations', heading: 'destinations' }`;
- `'cta'` → `'05'`, `'Cabin'`;
- `'restart'` → `'01'`;
- `('pass', 'confirmed')` → heading `'pass'`, and `('seat', 'browse')` → heading `'aisle'`.

`curtain.spec.ts` (1440×800):
- **`'a rail click covers the screen, flies the plane across and reveals the chapter'`:**
  - from the top, click rail `03 Transfer`;
  - within 300 ms `html[data-curtain]` is `cover`;
  - later `covered`, with the label text `03 Transfer` visible;
  - while covered, `CurtainPlane.visible` is true at some frame, and its projected y falls across frames;
  - the attribute disappears within 3.5 s;
  - progress ≈ `pre('transfer', 0.7)` (±0.002).
- **`'the jump only ever happens under the curtain'`:** record `{ p, curtain }` every rAF through a click on `Cabin`; every frame-to-frame `|Δp| > 0.005` has `curtain === 'covered'`.
- **`'a second click during the transition is ignored'`:** click `03 Transfer`, then 100 ms later `02 Destinations`; the end progress is the transfer target.
- **`'keyboard: focus goes to the chapter heading'`** (Review Focus 2): focus rail `02 Destinations`, press Enter; after the end, `document.activeElement` has `data-heading="destinations"`.
- **`'from the seat, Destinations reveals only on a settled camera'`** (Review Focus 1):
  - sit in 14F and click header `Destinations`;
  - at the first frame whose stage is `reveal`, the camera's distance to `poseOnPreTrack(target)` is < 0.05 m.
- **`'Take off still flies the camera to the window'`:** on the pass click `Take off`; `html[data-curtain]` never appears, and progress reaches `WINDOW_ON_EXIT`.
- **`'Start again goes through the curtain to the top'`.**
- **`'reduced motion: a short fade, no plane'`:** the stage passes `covered`, and `CurtainPlane` is never visible.
- **`'the first curtain compiles no shader'`:** `gl.info.programs.length` is the same before the first rail click and after it ends (the probe intro.spec uses).

`journey-choices.spec.ts`: replace "a header jump from the aisle to Destinations and back moves the plane on screen without a jump" with "a header jump to Destinations and back happens under the curtain". It uses the same frame recorder: frames with a large Δp are `covered` (both directions).

`perf.spec.ts`: add `curtain`. Click rail `02 Destinations` from the aisle and time 40 frames inside `covered`, using the same gate.

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run tests/unit/curtain.test.ts tests/unit/navState.test.ts && npx playwright test tests/e2e/curtain.spec.ts --project=chromium`
Expected: FAIL.

- [ ] **Step 3: Implement**

The modules, the pass, the DOM and the wiring above.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run && npx playwright test --project=chromium`
Expected: PASS (the whole chromium suite: navigation is everywhere).

- [ ] **Step 5: Commit**

```bash
git add src tests
git commit -m "feat: chapter jumps pass under a liquid curtain that the live plane flies across"
```

---

### Task 8: The door's warm light hugs its outline

**Files:**
- Create: `src/scene/aircraft/doorGlow.ts`
- Modify:
  - `src/scene/aircraft/Aircraft.tsx`: the `DoorGlow` quad and its shader go; `withDoorGlow` goes on the `Livery` and `DoorSeam` materials; `uDoorGlow` is fed from `doorGlow()` and `uToAircraft` from the group's inverse world matrix each frame;
  - `src/experience/geometry.ts`: `DOOR_1L.radius = 0.15`, `WINDOW.r = 0.09`;
  - `tools/blender/aslanair/export.py`: meta `door1L.radius`, `window.r`;
  - `public/models/airliner.{glb,meta.json}` (rebuilt).
- Test: `tests/unit/aircraftAsset.test.ts`, `tests/e2e/journey-choices.spec.ts` ("ready: door 1L glows…" rewritten)

**Interfaces:**
- Produces: `withDoorGlow<T extends Material>(m: T): T`, which chains after any existing `onBeforeCompile` and sets its own `customProgramCacheKey` suffix. Shared uniforms:
  - `DOOR_GLOW_UNIFORMS`: `uDoorGlow` (float, 0), `uToAircraft` (Matrix4), `uDoor` (Vector4 `cx, cy, halfW, halfH`), `uDoorRadius` (float), `uDoorColor` (Color `#ffb46e`);
  - `cx = stationToX(DOOR_1L.station)`, `cy = DOOR_1L.y`, `halfW = DOOR_1L.width / 2`, `halfH = DOOR_1L.height / 2`.
- Fragment rule: `p = (uToAircraft × worldPosition).xyz`. Only where `p.z < 0`, and `p` is within 0.6 m of the outline in (x, y):
  - `d` = rounded-rect SDF of `p.xy` (with `uDoorRadius`);
  - `emissive += uDoorColor × uDoorGlow × (exp(−max(d, 0) × 9) × 0.9 + step(d, 0) × (0.25 + 0.6 × exp(d × 16)))`.
  - The door panel sliding away leaves the outline, so its own glow fades with it.

- [ ] **Step 1: Write the failing tests**

`aircraftAsset.test.ts`: `meta.door1L.radius` equals `DOOR_1L.radius`, and `meta.window.r` equals `WINDOW.r`.

`journey-choices.spec.ts`: rewrite as `'door 1L's warm light hugs its outline from every angle of the approach'`, at `ready 0.9`, `door 0.08` and `door 0.16`:
- project the door's rounded-rect outline at the skin (z = −1.79, the aircraft frame) and the same outline grown by 0.35 m;
- the mean luminance within ±4 px of the outline exceeds the grown outline's band by ≥ 15;
- the glow's centroid (luminance above the scene's mean, in the box round the door grown by 0.5 m) lies within 12 % of the door's projected width of the projected door centre. The old quad sat aft of the door and fails this.

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run tests/unit/aircraftAsset.test.ts && npx playwright test tests/e2e/journey-choices.spec.ts --project=chromium -g "door 1L"`
Expected: FAIL.

- [ ] **Step 3: Implement**

The export keys, then `npm run build:aircraft` (Blender headless; the triangle count must stay 119 794), the TS constants and `doorGlow.ts`. In `Aircraft.tsx`, apply `withDoorGlow` in the material traversal and remove the quad.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test:blender && npx vitest run && npx playwright test tests/e2e/journey-choices.spec.ts tests/e2e/aircraft.spec.ts tests/e2e/intro.spec.ts --project=chromium`
Expected: PASS, including "scrolling the first screen compiles and uploads nothing".

- [ ] **Step 5: Commit**

```bash
git add src tools public/models tests
git commit -m "fix: the door's warm light hugs its outline on the curved skin"
```

---

### Task 9: A lettered flight-deck door and a real galley

**Files:**
- Modify:
  - `tools/blender/aslanair/kit.py` (`build_galley`, the placard in `build_cockpit_door`);
  - `tools/blender/aslanair/geometry.py` (`COCKPIT_PLACARD`);
  - `tools/blender/build_kit.py` (meta);
  - `public/models/cabin-kit.{glb,meta.json}`;
  - `src/experience/cabinLayout.ts` (`COCKPIT_PLACARD`);
  - `src/scene/cabin/EntryZone.tsx`, `src/scene/cabin/materials.ts`.
- Create: `src/scene/cabin/brushed.ts`, `tests/unit/brushed.test.ts`
- Test: `tests/unit/kitAsset.test.ts`, `tests/e2e/cabin.spec.ts`

**Interfaces:**
- Produces:
  - `COCKPIT_PLACARD = { y: FLOOR_Y + 1.74, w: 0.30, h: 0.11 }`, in cabinLayout and in the kit meta `placard`;
  - kit parts:
    - `GalleySteel`: cart doors with a raised edge frame, oven doors with a handle bar, a coffee-maker body;
    - `GalleyLatches`: two turn latches per cart door, one per oven;
    - `GalleyDark`: oven windows, the coffee-maker front, vent grilles, number plates;
    - triangles of the three together ≤ 4 000;
  - materials (`materials.ts`):
    - `steel` gains a brushed `roughnessMap` (a DataTexture of horizontal streaks, generated by a pure `brushedTexels(size, seed)` in `src/scene/cabin/brushed.ts`; kit UVs are in metres, repeat 4);
    - `latch`: Lambert `#c8322b`;
    - `dark`: Standard `#15181d`, roughness 0.3;
    - all `withCabinLight(..., { sun: false })`;
  - `EntryZone`: a `CockpitPlacard` plane on the placard's face. Its CanvasTexture has two lines, `FLIGHT DECK` (bold, larger) over `CREW ONLY`, dark ink on a warm light plate. It records `texture.userData.lines` outside production, like the pass.

- [ ] **Step 1: Write the failing tests**

`brushed.test.ts`: `brushedTexels(64, 1)` is deterministic per seed, and its variance along a row is ≥ 4× its variance down a column (the streaks run horizontally).

`kitAsset.test.ts`:
- the nodes `GalleyLatches` and `GalleyDark` exist;
- `triangles.GalleySteel + GalleyLatches + GalleyDark ≤ 4000`;
- `kit.placard` matches `COCKPIT_PLACARD`;
- the kit size is still ≤ 600 KB.

`cabin.spec.ts`, at `door 0.78` (ENTRY):
- **`'the flight-deck door reads FLIGHT DECK / CREW ONLY'`:** `CockpitPlacard`'s map has `userData.lines` equal to `['FLIGHT DECK', 'CREW ONLY']`, and the mesh is visible and on screen.
- **`'the galley is equipment, not blank mirrors'`:**
  - in the galley's projected box (cabinLayout `GALLEY`), the screenshot holds ≥ 30 latch-red pixels (`r > 150`, `g < 90`, `b < 90`);
  - the luminance standard deviation is ≥ 18.

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run tests/unit/kitAsset.test.ts && npx playwright test tests/e2e/cabin.spec.ts --project=chromium -g "flight-deck|galley"`
Expected: FAIL.

- [ ] **Step 3: Implement**

The kit parts, the placard size and the meta, then `npm run build:kit`. Then the materials, `brushed.ts` and EntryZone. "Only the exterior casts sun shadows" must keep passing: the new parts cast none.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test:blender && npx vitest run && npx playwright test tests/e2e/cabin.spec.ts tests/e2e/night.spec.ts --project=chromium`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src tools public/models tests
git commit -m "feat: a lettered flight-deck door and a galley with real equipment"
```

---

### Task 10: Smooth window outlines with cabin bezels

**Files:**
- Move: `tests/unit/linerProfile.ts` → `src/experience/linerProfile.ts`, updating its imports in tests
- Create: `src/experience/windowBezel.ts`, `src/scene/cabin/WindowBezels.tsx`, `tests/unit/windowBezel.test.ts`
- Modify: `src/scene/Experience.tsx` (`CabinFurnishing` gets `<WindowBezels />`), `src/scene/cabin/materials.ts` (`bezel` material)
- Test: `tests/e2e/cabin.spec.ts`

**Interfaces:**
- Produces (pure):
  - `BEZEL = { margin: 0.08, inset: 0.012, cornerInset: 0.006, standoff: 0.004, grid: [6, 8] as const }`;
  - `bezelGeometryData(meta, windows = windowCentres())` returns `{ positions: Float32Array; uvs: Float32Array; indices: Uint32Array }`:
    - one curved panel per window, `(WINDOW.w + 2 × margin) × (WINDOW.h + 2 × margin)`;
    - each vertex sits at `|z| = linerHalfWidthAt(meta, s, y) − standoff` on the window's side, so the panel follows the liner's curve;
    - `uv` is the local (along, up) offset from the window centre, in metres;
  - `windowCentres(): { station: number; y: number; side: -1 | 1 }[]`, both sides of `windowStations()`;
  - the opening's half-size `(w/2 − inset, h/2 − inset)` and its corner radius `WINDOW.r − cornerInset`.
- Produces: `WindowBezels`, one merged mesh named `WindowBezels`.
  - Its material is the cabin wall's: a clone of the GLB `CabinWall` material plus `withCabinLight({ sun: false })` and an `onBeforeCompile` that does three things:
    - computes the rounded-rect SDF from `vUv`;
    - sets alpha `smoothstep(-fw, fw, d)` with `alphaToCoverage: true`, so there is no transparency sorting;
    - darkens by up to 18 % within 15 mm of the opening, for a lip.
  - The outer edge feathers to alpha 0 over the last 30 mm.
- Constraint: the airliner GLB is not touched (spec r4 §9.4: smoothness without new GLB triangles).

- [ ] **Step 1: Write the failing tests**

`windowBezel.test.ts`:
- one panel per window centre: `(6+1)×(8+1)` vertices each, and the count matches `2 × windowStations().length`;
- every vertex lies `standoff ± 0.001` inside the liner (`linerHalfWidthAt` from the meta);
- the opening is inside the liner's polygon cut: its half-size is ≤ `w/2 − 0.01` and ≥ `w/2 − 0.02`, and the same for h;
- its corner radius is `WINDOW.r − 0.006`.

`cabin.spec.ts` gets `'from a window seat the window has a smooth bezel'`: at seat 14F, the `WindowBezels` mesh is visible, on layer 0, and its material has `alphaToCoverage` true.

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run tests/unit/windowBezel.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement** the move, the module, the component and the material.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run && npx playwright test tests/e2e/cabin.spec.ts tests/e2e/night.spec.ts --project=chromium && npx playwright test --project=perf`
Expected: PASS. The `seat` and `aisle` measures stay ≤ 22.2 ms. Look at the review shot `seat` for a round outline.

- [ ] **Step 5: Commit**

```bash
git add src tests
git commit -m "feat: window bezels give the windows a smooth round outline"
```

---

### Task 11: Night sky from images, a cloud sea and sprite clouds

**Files:**
- Create:
  - `src/experience/clouds.ts`, `src/scene/sky/CloudSea.tsx`, `src/scene/sky/CloudPuffs.tsx`;
  - `public/images/sky/stars.webp`, `public/images/sky/cloud-sea.webp`, `public/images/sky/CREDITS.md`;
  - `tests/unit/clouds.test.ts`, `tests/unit/skyImages.test.ts`.
- Modify: `src/scene/sky/SkyAndClouds.tsx`, `src/scene/sky/shaders.ts`, `src/content/copy.ts` (How it's made, outro.made), `src/scene/CaptureMode.tsx` (no night sky)
- Remove: `src/scene/sky/noise3d.ts`, `src/experience/cloudDetail.ts`, `tests/unit/noise3d.test.ts`, `tests/unit/cloudDetail.test.ts`
- Test: `tests/e2e/night.spec.ts`, `tests/e2e/perf.spec.ts`

**Interfaces:**
- **Assets** (spec r4 §9.2–9.3). Before downloading, ask the user in chat, naming each file, its source and its size. Candidates, by preference:
  - stars: ESO "The Milky Way panorama" `eso0932a` (CC BY 4.0, credit "ESO/S. Brunier"), or NASA SVS "Deep Star Maps 2020" (check the licence on its page);
  - cloud sea: a top-down photo of a stratocumulus deck from NASA Earth Observatory or NASA's ISS photography (public domain, credit "NASA").

  Encode with `sharp`:
  - `stars.webp`: 4096×2048 equirectangular, ≤ 1.6 MB;
  - `cloud-sea.webp`: ≥ 2048 px, ≤ 1.2 MB, made seamless for `MirroredRepeatWrapping`.

  `CREDITS.md` lists each file, its source URL, its licence and the credit line.
- Produces (pure, `clouds.ts`):
  - `PUFFS = { count: 360, layer: { bottom: -320, top: -90 }, box: 3000, sizeMin: 40, sizeMax: 140, wind: [-55, 0, 6] }`;
  - `puffLayout(seed: number)` returns `{ centre: [x, y, z]; size: number; cluster: [x, y, z] }[]`:
    - clusters of 6–14 puffs;
    - each puff's top (`y + size/2`) is ≤ `layer.top`;
    - x and z lie within `±box/2`;
  - `wrapAround(v: number, centre: number, box: number): number` puts `v` within `centre ± box/2`;
  - `puffTexels(size: number, seed: number): Uint8Array`, a soft, billowy RGBA puff, alpha 0 at the border.
- Produces (scene):
  - `SkyAndClouds` keeps its name, lights, `MOON_DIRECTION` and `MOONLIGHT`. It drops the raymarch, blur and render targets. Its backdrop shader draws:
    - above the horizon, `stars.webp` sampled by direction × `uStarExposure`;
    - the horizon glow and moon glow from `SKY_GLSL` (retuned to the new sky);
    - the existing crisp `skyPoints` on top (the brightest stars and the moon disc stay points; the panorama alone renders stars soft at these fields of view);
    - below the horizon, `NIGHT_HORIZON` haze.
    The env map is built as now, from the gradient. Until `stars.webp` arrives, the backdrop uses a 1×1 navy placeholder through the same uniform, so there is no recompile and no black.
  - The moon and fill lights also enable `CURTAIN_LAYER` (Task 7).
  - `CloudSea`, a 40 km disc at `y = −600`. Its shader:
    - samples `cloud-sea.webp` at two scales, drifting with `PUFFS.wind`;
    - grades it to moonlit night: dark navy-grey in the hollows, silver on the tops, a forward-scatter sheen towards the moon's azimuth;
    - fogs towards `NIGHT_HORIZON` with distance;
    - is opaque, drawn after the backdrop.
  - `CloudPuffs`, one InstancedMesh of camera-facing quads (billboarded in the vertex shader). Its shader:
    - drifts with `wind × uTime`, wrapped round the camera's x/z with `wrapAround` in the vertex shader;
    - lights each instance by a pseudo-normal `normalize(centre − cluster)` against `MOON_DIRECTION`: silver on the lit side, dark navy on the far side;
    - fades the puffs within 60 m of the camera;
    - writes no depth (transparent, normal blending, sorted by instance distance once per second).
  - Both show only in the night world (`worldMode === 'night'`). They compile under the loader, as the backdrop does now.
- Copy:
  - `outro.made.lead`: "The airliner, the cabin and every seat are real-time 3D built from code; the night sky and clouds are drawn live in WebGL.";
  - How it's made: the clouds item becomes "The sky is ESO's Milky Way panorama; the clouds are a photographed cloud deck and lit sprites, live in WebGL." (name the source actually used), plus a credits item from `CREDITS.md`.

- [ ] **Step 1: Write the failing tests**

`clouds.test.ts`:
- `puffLayout(1)` has `PUFFS.count` puffs, is deterministic per seed, keeps every top ≤ −90, and keeps |x|, |z| ≤ 1500;
- `wrapAround(1600, 0, 3000)` is −1400;
- `puffTexels(64, 1)` has its corners and border at alpha 0 and its centre alpha ≥ 200;
- **`'the way out never enters a cloud'`:** for seats 14F and 1A, sample `poseOnPostTrack` over the exit and the outro (200 steps). The camera stays ≥ 30 m above the highest puff top and ≥ 400 m above the cloud sea.

`skyImages.test.ts`:
- `stars.webp` is 4096×2048 and ≤ 1.6 MB;
- `cloud-sea.webp` is ≥ 2048 on its short side and ≤ 1.2 MB;
- `CREDITS.md` names both files with a licence line each;
- `copy.outro.howItsMade.items` includes the credit.

`night.spec.ts`:
- Keep "from a window seat the night sky is dark blue with moonlit clouds" (`b > r`, `mean ≤ 110`, `bright > 0`).
- Keep "out through the window the clouds below are lit by the moon" (`variance > 40`, `mean < 120`).
- Keep "out of the window the stars are crisp points".
- Add `'the sky is the star panorama'`: `NightBackdrop`'s `uStars` texture has an image 4096 wide once loaded.
- Add `'the loader never waits for the sky images'` (Review Focus 4):
  - hold `**/images/sky/*` in `page.route`;
  - `#loader[data-ready="true"]` still arrives;
  - at `aisle 0.27` seated in 14F, the window box has `mean > 6` (never black) and `b > r`.

`perf.spec.ts`: the gate is unchanged. The `seat`, `pass`, `exit` and `aisle` measures now run on the new sky.

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run tests/unit/clouds.test.ts tests/unit/skyImages.test.ts`
Expected: FAIL.

- [ ] **Step 3: Get the images (with the user's approval), then implement**

Ask the user (file, source, size); download each image into its own new folder under the scratchpad; encode with a small `node` script run from outside that folder; then commit only the WebP outputs and `CREDITS.md`. Then implement `clouds.ts`, `CloudSea`, `CloudPuffs`, and the new backdrop, and remove the raymarch files with their tests and the `cloudScale` import sites.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run && npx playwright test --project=chromium && npx playwright test --project=perf`
Expected: PASS, every perf measure ≤ 22.2 ms on a quiet GPU (sample the user's Chrome GPU share; ≤ 3 %). Look at the review shots `seat`, `exit` and `outro` against the spec's goal: a moonlit cloud sea, silvered puffs, a real star sky.

- [ ] **Step 5: Commit**

```bash
git add -A src public/images tests
git commit -m "feat: a night sky from the Milky Way panorama over a photographed cloud sea and moonlit sprite clouds"
```

---

### Task 12: Whole-journey check and hand-over

**Files:**
- Modify: `tests/e2e/perf.spec.ts` (review shots), `docs/superpowers/plans/2026-10-22-aslanair-plan-5-polish.md`

- [ ] **Step 1: Review shots**

In `perf.spec.ts`'s screenshot set:
- remove `ribbons`;
- add `grid` (sky 0.25 with the mouse at 300, 620), `curtain` (mid-flight, covered), `transfer-open` (From home chosen), `galley` (ENTRY) and `window-bezel` (seat 14F, close).

All are judged by the existing "never a black screen" guard.

- [ ] **Step 2: Plan 5 hand-over**

In Plan 5:
- strike the carried-over items done here: the faceted seat window, the author placeholders, the 2× hero picture, `planeImage` checking the alpha box, the ribbons' hard-coded copy;
- replace Task 1's cloud knobs (`cloudScale`, `uSteps`, `uDetail`) with "the sprite cloud count per tier (`PUFFS.count` × 1 / 0.75 / 0.5)";
- note that the curtain, grid and reveals need reduced-motion coverage in its accessibility task only if gaps remain.

- [ ] **Step 3: Full verification**

Run: `npm run lint && npx tsc --noEmit && npm test && npm run test:blender && npm run e2e`
Expected: all green; perf within the gate on a quiet GPU.

- [ ] **Step 4: Commit**

```bash
git add tests docs
git commit -m "test: review shots for the polish; Plan 5 picks up where 4c leaves off"
```

- [ ] **Step 5: Whole-branch review** — one fresh reviewer on the most capable model over `feat/plan-4b-journey..feat/plan-4c-polish`, then fix what it finds; merges wait for the user.
