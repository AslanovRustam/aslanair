# AslanAir Plan 4d — the author's r5 feedback: implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Seven changes from the author's review of Plan 4c:
- the loader's plane grows into the hero's;
- no empty stretch after the globe;
- the transfer cards show themselves on scroll and stop tilting;
- larger Ready words;
- door 1L sits on the hull;
- How it's made is gone, with the image credits moved to the footer.

**Architecture:** Every rule is a pure, unit-tested function in `src/experience/`, and thin components apply it:
- `introState` timings;
- `stage.waiting`;
- `transferOpen`;
- `doorPose`.

The door follows the real hull through a new skin grid that the Blender exporter writes into `airliner.meta.json`, read the same way as the liner grid.

**Tech Stack:** Next 16 (Turbopack), React 19, React Three Fiber 9, three 0.186, zustand vanilla stores, Lenis, CSS modules, Vitest, Playwright (projects `chromium` and `perf`), Blender headless (`npm run build:aircraft`, `npm run test:blender`).

**Spec:** `docs/superpowers/specs/2026-10-25-aslanair-design-r5-feedback.md` (r5). It builds on r4 (`…-r4-polish.md`).

## Global Constraints

- **Perf gate:** 22.2 ms median and mean on the integrated GPU (`npx playwright test --project=perf --no-deps`). Judge it only on a quiet GPU: no game running, and the user's Chrome GPU process at most 3 %.
- **Transitions:** nothing compiles or uploads to the GPU at a chapter change; programs compile under the loader.
- **Copy:** all strings live in `src/content/copy.ts`. The pinned labels from Plan 1 keep their wording.
- **Reduced motion and phones** (412×915 and 390×844) are covered for items 1, 3, 5 and 7.
- **Branch:** `feat/plan-4d-feedback`, cut from `feat/plan-4c-polish`. 4b, 4c and 4d merge only on the author's word.
- **Dev server:** port 3200.
- **Test runs:** the whole chromium e2e suite runs at the end of every task.
- **Line endings:** files mix CRLF and LF; edits keep each file's own.

## Review Focus

- **Scrolling during the loader's growth** (≈ 0.9 s after `ready`): the picture and the live plane must still meet. The scroll is held until the hand-over ends (Task 1 test).
- **Arriving at Transfer mid-chapter:** a curtain jump lands at `trackProgress('pre', 'transfer', 0.7)`. It shows that point's preview card, and a pick made earlier in the visit still holds (Task 3 test).
- **Touch with no hover:** a tap picks the card and stops the preview, and the preview never steals the open card from keyboard focus (Task 3 tests).
- **Start again:** the preview comes back and the pick resets to "On my own" (Task 3 test).
- **The phone footer at night:** the disclaimer, the author line and the sky credit fit within 412 px with nothing hidden that the licence needs (Task 6 test).

---

### Task 1: The loader's plane grows into the hero

**Files:**
- Modify: `src/experience/introState.ts`, `src/ui/Loader.tsx`, `src/ui/loader.module.css`, `src/ui/Hero.tsx`
- Test: `tests/unit/introState.test.ts`, `tests/e2e/loader.spec.ts`

**Interfaces:**
- **Produces** `export const LOADER = { start: 0.5, grow: 0.9, fade: 0.6 } as const` in `introState.ts`:
  - `start` is the picture's scale while loading;
  - `grow` is the growth to the hero's size after `ready`, in seconds;
  - `fade` is the loader's fade-out after the growth, in seconds.
- **Produces** `export function heroEntranceDelay(reduced: boolean): number`:
  - returns `LOADER.grow` normally;
  - returns `0` under reduced motion.

How the hand-off works now (keep it): the loader's picture sits exactly where the live camera frames the plane (`heroPictureBox` in `tests/e2e/helpers.ts`). The opaque loader fades and the live plane is simply there; the hero has no picture of its own.

New behaviour:
- while loading, the picture is `scale: 0.5` around its own centre, which is the hero box's centre;
- on `data-ready='true'` it transitions to `scale: 1` over `grow` (`cubic-bezier(0.22, 1, 0.36, 1)`);
- only after that does the loader fade (its `opacity` / `visibility` transition gets a `grow` s delay);
- the hero's entrance waits the same `grow`;
- Lenis is held still from `ready` until `grow + fade`, so the live plane cannot move away from the picture during the hand-over.

Reduced motion:
- no scale transition: the picture fades out over 0.3 s while the loader fades;
- the live plane appears at its hero size (the spec's crossfade);
- no hold beyond that fade.

- [ ] **Step 1: Write the failing tests**
  - `introState.test.ts`: `expect(LOADER).toEqual({ start: 0.5, grow: 0.9, fade: 0.6 })`; `expect(heroEntranceDelay(false)).toBe(0.9)`; `expect(heroEntranceDelay(true)).toBe(0)`.
  - `loader.spec.ts`, in the existing 1440×800 / 412×915 loop:
    - **`before`:** while loading, the loader `img` box has width and height `0.5 × heroPictureBox` and the same centre (±2 px).
    - **Growth:** after `data-ready='true'`, poll the `img` box every animation frame until the loader is hidden. It reaches `heroPictureBox` (±2 px) within 1.2 s. Its width never changes by more than 6 % of the hero width between two frames.
    - **Opacity:** the loader's computed `opacity` stays `1` until the box has reached full size.
    - **Hand-over:** the old `before === heroPictureBox` assertion becomes this end-of-growth check.
  - New e2e `the page holds still while the loader hands over`:
    - right after `data-ready='true'`, `page.mouse.wheel(0, 600)` three times;
    - when the loader is hidden, the store's `progress` is still `0`.
  - New e2e `under reduced motion the picture fades out at its small size`:
    - with `emulateMedia({ reducedMotion: 'reduce' })`, the `img` box never grows;
    - the loader is hidden within 1.0 s of `ready`.

- [ ] **Step 2: Run them, expect FAIL**

  Run: `npx vitest run tests/unit/introState.test.ts && npx playwright test tests/e2e/loader.spec.ts --project=chromium`. Expect FAIL: `LOADER` is undefined, and the boxes are equal at the start.

- [ ] **Step 3: Implement**
  - Add `LOADER` and `heroEntranceDelay` to `introState.ts`.
  - `loader.module.css`:
    - `.picture { scale: 0.5 }`;
    - `.loader[data-ready='true'] .picture { scale: 1; transition: scale 0.9s cubic-bezier(0.22,1,0.36,1) }`;
    - delay the loader's own transition by `0.9s`;
    - add a `@media (prefers-reduced-motion: reduce)` block (picture fade 0.3 s, no delays).

    Expose the values as CSS vars from `LOADER` through `Loader.tsx`'s style, as `PICTURE_BOX` does today.
  - `Hero.tsx`: `data-ready` turns true `heroEntranceDelay(reduced) * 1000` ms after the store's `ready` (`setTimeout` in an effect).
  - Scroll hold: in the component that sees `ready` first (`Loader.tsx`), call `lockScroll(true)` on `ready` and `lockScroll(false)` after `grow + fade`. Under reduced motion, release after the 0.3 s fade. Both from `src/scroll/SmoothScroll`.

- [ ] **Step 4: Run the tests, expect PASS**

  Run: `npx vitest run && npx playwright test --project=chromium`. Expect all to pass.

- [ ] **Step 5: Commit**

  `git commit -m "feat: the loader's plane grows into the hero's before the page lets go"`

---

### Task 2: After the globe, the plane flies straight in from the right

**Files:**
- Modify: `src/experience/stage.ts` (`WAITING`, `waiting`)
- Test: `tests/unit/stage.test.ts`

**Interfaces:**
- **Produces:** `aircraftStage(phase, progress)` keeps its signature; only the transfer chapter's `waiting(t)` changes.
- **Consumes:** `projectedBox(stage, pose, aspect)` and `poseOnPreTrack(progress, aspect)`, unchanged.

The leaving over the globe's horizon (`globe.ts`) is unchanged.

New `waiting(t)`:
- **Entry:** the plane enters the frame from beyond its right edge, nose first (its heading along its motion), at the very start of the chapter.
- **Settle:** it is settled beside the cards by t ≈ 0.18 (`WAITING.settle` 0.4 → 0.18).
- **After settling:** the slow turn (`turn → away`) and the ready chapter are as now.

The entry vector and the approach heading are the implementer's call; the tests below fix them.

- [ ] **Step 1: Rewrite the transfer tests in `stage.test.ts`**
  - The existing expectation `'out of view as the transfer begins'` (`showing(transfer 0) === false`) becomes the opposite requirement. For both test aspects (1440/800 and 390/844):
    - at `transfer t = 0.03`, the projected box intersects the frame `[0,1]²`;
    - its centre x is greater than 0.8;
    - its y range lies inside `[0, 1]`.
  - `transfer t = 0.2`: the box lies wholly inside the frame.
  - New: from `transfer 0` to `0.2` the box's centre x never increases (it comes in from the right and does not overshoot back).
  - Keep the continuity test (`across(...)` per vh) and the yaw test, and make both pass over the new entry.

- [ ] **Step 2: Run, expect FAIL**

  Run: `npx vitest run tests/unit/stage.test.ts`. Expect FAIL at transfer t = 0.03: the box is above the frame today, y < 0.

- [ ] **Step 3: Implement the new entry in `waiting(t)`**

  Keep it a pure function of `t`.

- [ ] **Step 4: Run, expect PASS**

  Run: `npx vitest run && npx playwright test --project=chromium`. Expect all to pass. `journey-choices` holds the transfer layout, and the plane must not cover the cards.

- [ ] **Step 5: Commit**

  `git commit -m "feat: as the globe goes, the plane flies straight in from the right"`

---

### Task 3: The transfer cards show themselves on scroll; no tilt

**Files:**
- Create: `src/experience/transferOpen.ts`
- Modify: `src/experience/store.ts`, `src/ui/Transfer.tsx`, `src/ui/transfer.module.css`
- Test: `tests/unit/transferOpen.test.ts`, `tests/unit/store.test.ts`, `tests/e2e/journey-choices.spec.ts`

**Interfaces:**
- **Produces** `export const PREVIEW = { from: 0.2, to: 0.85 } as const`.
- **Produces** `export function previewCard(t: number): TransferId | null`. It returns:
  - `null` outside `[from, to)`;
  - otherwise `TRANSFERS[Math.min(3, Math.floor((t - from) / ((to - from) / 4)))].id`.
- **Produces** `export function openTransfer(s: { t: number | null; picked: boolean; chosen: TransferId; hovered: TransferId | null; focused: TransferId | null }): TransferId`. The rule is `hovered ?? focused ?? (picked || t === null ? chosen : previewCard(t) ?? chosen)`.
- **Store:**
  - new field `transferPicked: boolean` (initially `false`);
  - `chooseTransfer` sets it `true` when it succeeds;
  - `restart()` resets it to `false` and `transferId` to `DEFAULT_TRANSFER`, as now.

Behaviour:
- the preview never touches `transferId`;
- a card opened by the preview and not chosen shows the "Choose ↗" plate, as on hover today;
- the chapter's height stays 150 vh (my call within the spec's ≤ 210 vh);
- **tilt:** remove `rotate(-1.5deg)` from `transfer.module.css` (the hover rule at line ~159), keeping the lift;
- **the reduced-motion block** keeps `transform: none` for hover (4c).

- [ ] **Step 1: Write the failing tests**
  - `transferOpen.test.ts`:
    - `previewCard(0.1) === null`;
    - `previewCard(0.25) === 'home'`;
    - `previewCard(0.45) === 'hotel'`;
    - `previewCard(0.6) === 'express'`;
    - `previewCard(0.8) === 'own'`;
    - `previewCard(0.9) === null`;
    - `openTransfer({ t: 0.45, picked: false, chosen: 'own', hovered: null, focused: null }) === 'hotel'`;
    - with `picked: true` it is `'own'`;
    - `hovered: 'home'` wins over both;
    - `focused: 'express'` wins over the preview;
    - `t: null` gives `chosen`.
  - `store.test.ts`:
    - `chooseTransfer('hotel')` sets `transferPicked` true;
    - `restart()` sets it false and `transferId` to `'own'`.
  - `journey-choices.spec.ts`, new tests:
    - `scrolling through Transfer opens each card in turn without choosing it`: at `pre('transfer', 0.25 / 0.45 / 0.6 / 0.8)` the open card (`data-open='true'`) is home / hotel / express / own, and the store's `transferId` stays `'own'` throughout.
    - `once a card is picked, scrolling keeps it open`: click "From your hotel", then at the same four points it stays open.
    - `a tap on a phone picks the card and stops the preview`: at 412×915, `tap` on "Airport express"; at the four points it stays open.
    - `arriving by the rail mid-chapter shows that point's card, and an earlier pick still holds`:
      - curtain jump to Transfer (lands at t 0.7): the open card is `'express'`;
      - after Start again → pick "From home" → jump to Destinations and back to Transfer: `'home'` is open.
    - `no transfer card ever tilts`: hover each card; `getComputedStyle(option).transform` has no rotation (as a matrix, `b === 0 && c === 0`).
    - `Start again brings the preview back`: pick "From home", confirm a seat, Start again, scroll to `pre('transfer', 0.45)`: `'hotel'` is open and `transferId` is `'own'`.
  - Update the tests whose expectations change: `getting to the airport: On my own at first…` checks the open card at t 0.75, which is now the preview's `'own'`. Keep its intent.

- [ ] **Step 2: Run, expect FAIL**

  Run: `npx vitest run tests/unit/transferOpen.test.ts tests/unit/store.test.ts`. Expect FAIL: the module and the field are missing.

- [ ] **Step 3: Implement**
  - Write `transferOpen.ts` and add the store field.
  - `Transfer.tsx`:
    - `t` comes from `useExperience((s) => chapterAt('pre', s.progress).id === 'transfer' && s.phase === 'browse' ? round(t, 3) : null)`;
    - `open = openTransfer({ t, picked, chosen, hovered, focused })`.
  - Remove the tilt in CSS.

- [ ] **Step 4: Run, expect PASS**

  Run: `npx vitest run && npx playwright test --project=chromium`.

- [ ] **Step 5: Commit**

  `git commit -m "feat: scrolling through Transfer shows each way to the airport; a pick stops it; no tilt"`

---

### Task 4: Larger Ready words

**Files:**
- Modify: `src/ui/ready.module.css`
- Test: `tests/e2e/journey-choices.spec.ts` (or the spec that already holds the Ready tests)

The reveal (RevealText title, outline → ink promise) is unchanged:
- **Title:** about `clamp(3.1rem, 6.5vw, 5.9rem)`.
- **Promise:** about `clamp(1.8rem, 3.1vw, 2.75rem)`.
- **Column:** as wide as fits left of the plane at ready t ≤ 0.5 (it may stay `min(36rem, 46vw)` and wrap more).
- **Phones:** keep their own block. Nothing overflows 412 px.

- [ ] **Step 1: Write the failing tests**
  - `the Ready words are larger`: at 1440×800, the computed `line-height` × lines of the promise. In practice, the promise's first word's `getBoundingClientRect().height` must be at least 1.25 × today's value (measure today's value and write it as a number in the test).
  - `the Ready words stay left of the plane while it is far`: at 1440×800 and 1280×720, at `pre('ready', 0.3)` and `pre('ready', 0.5)`, the box of `[data-testid="ready"] .words` must not intersect `projectedBox(aircraftStage('browse', p), poseOnPreTrack(p, aspect), aspect)` in pixels.
  - `on a phone the Ready words fit`: at 412×915, at `pre('ready', 0.5)`, `document.documentElement.scrollWidth <= 412`, and the words' box is within `[0, 412]`.

- [ ] **Step 2: Run, expect FAIL** (only the size test fails today)

  Run: `npx playwright test tests/e2e/journey-choices.spec.ts --project=chromium -g "Ready words"`.

- [ ] **Step 3: Implement the sizes in `ready.module.css`**

- [ ] **Step 4: Run the whole chromium suite, expect PASS**

- [ ] **Step 5: Commit**

  `git commit -m "feat: larger Ready words, still clear of the plane"`

---

### Task 5: Door 1L sits on the hull

**Files:**
- Modify: `tools/blender/aslanair/export.py` (meta), `tools/blender/tests/test_export.py` (or the existing meta test), `public/models/airliner.meta.json` (regenerated), `src/experience/linerProfile.ts`, `src/experience/aircraftAnimation.ts`, `src/scene/aircraft/Aircraft.tsx`
- Test: `tests/unit/aircraftAnimation.test.ts`, `tests/unit/aircraftAsset.test.ts`, `tests/e2e/journey.spec.ts` (door chapter)

**Interfaces:**
- **Meta:** `door1L.skin = { stations: number[], heights: number[], halfWidth: number[][] }`. This is the hull's outer half-width at stations `door_rect s_min − 1.3 … s_max + 0.1` and heights `sill … sill + height`, every 0.1 m, from `geometry.hull_half_width_at` (three.js `y` = Blender `Z`).
- **`linerProfile.ts`:**
  - export `interface SkinGrid { stations: number[]; heights: number[]; halfWidth: number[][] }` (the liner grid has the same shape);
  - generalise the bilinear lookup to `export function gridHalfWidthAt(grid: SkinGrid, station: number, y: number): number`;
  - keep `linerHalfWidthAt(meta, station, y)` as a call to it.
- **`aircraftAnimation.ts`** produces `export function doorPose(amount: number, skin: SkinGrid): { offset: [number, number, number]; yaw: number }`. It replaces `doorOffset` and is applied in `Aircraft.tsx` (position = closed + offset, `rotation.y` = yaw). Parameters:
  - **Outward clearance:** `DOOR_OPEN = { clear: 0.1, forward: 1.0 }`.
  - **Out:** `clear × smoothstep(amount, 0, 0.3)`, then held at that gap from the skin.
  - **Forward:** `forward × smoothstep(amount, 0.2, 1)`.
  - **Offset z:** at the door's centre station `s = 4.9 − forwardNow`, the door stands off the skin under it by the current clearance: `side × (skin(s, yCentre) + out − skin(4.9, yCentre))`.
  - **Yaw:** follows the skin's slope there: `side × atan(d skin / d station)`, by central difference.
- **`doorOpenAmount`:**
  - in the ready chapter it is `0` (no ajar);
  - in the door chapter it is `smoothstep(t, 0.15, 0.5)`;
  - aisle and seated are `1` as now;
  - remove `DOOR_AJAR`.

  `doorGlow` is unchanged (it lights the outline).

- [ ] **Step 1: Write the failing tests**
  - **Blender** (`npm run test:blender`): the exported meta has `door1L.skin`, and its half-widths equal `hull_half_width_at` at three sampled points (±1e-4).
  - **`aircraftAnimation.test.ts`:**
    - `doorOpenAmount('browse', pre('ready', 0.9)) === 0`;
    - `doorPose(0, skin)` gives offset `[0, 0, 0]` and yaw `0`;
    - for `amount` in `0.3, 0.4, … 1.0`, each of the closed panel's sample points (the 3 × 3 grid over the door rectangle on the skin), moved by the pose, stands off the skin at its new station by 0.02–0.12 m (spec r5 §7);
    - for every `amount` in `0 … 1` step 0.05, no sample point goes inside the skin by more than 0.005 m;
    - `doorPose(1, skin).offset[0]` ≥ 0.95 (clear of the doorway forward).
  - **`aircraftAsset.test.ts`:** the meta's `door1L.skin` covers stations 3.5–5.4 and the door's heights.
  - **e2e** (`journey.spec.ts`): at `pre('ready', 0.9)` the node `Door1L`'s position equals its closed position (±1 mm). Along the door chapter (20 samples), the camera's position never comes within 0.25 m of the door panel's centre.

- [ ] **Step 2: Run, expect FAIL**

  Run: `npm run test:blender && npx vitest run tests/unit/aircraftAnimation.test.ts tests/unit/aircraftAsset.test.ts`. Expect FAIL: there is no skin and no `doorPose`.

- [ ] **Step 3: Implement**
  - Exporter key, then run `npm run build:aircraft`.
  - If only the meta changed and the GLB differs by encoder noise alone (same triangle count, 119 794), keep the committed GLB (as in Plan 4c Task 8) and ledger it.
  - Add `gridHalfWidthAt` and `doorPose`, then apply the pose in `Aircraft.tsx`. The pose key that triggers the shadow redraw already includes `open`.

- [ ] **Step 4: Run, expect PASS**

  Run: `npm run test:blender && npx vitest run && npx playwright test --project=chromium`. Then look at a shot at `pre('door', 0.3)` and `pre('door', 0.6)`: the door lies along the skin, with no visible air gap or protruding corner.

- [ ] **Step 5: Commit**

  `git commit -m "feat: door 1L stays closed until boarding, then swings out and forward along the hull"`

---

### Task 6: No How it's made; the image credits move to the footer, on every screen

**Files:**
- Delete: `src/ui/HowItsMade.tsx` (move `AuthorCredit` into `src/ui/AuthorCredit.tsx` first)
- Modify: `src/ui/Shell.tsx`, `src/ui/shell.module.css`, `src/ui/Outro.tsx`, `src/experience/navState.ts`, `src/content/copy.ts`
- Test: `tests/e2e/shell.spec.ts`, `tests/e2e/journey.spec.ts`, `tests/e2e/curtain.spec.ts`, `tests/unit/navState.test.ts`, `tests/unit/skyImages.test.ts`

**Interfaces:**
- **`src/ui/AuthorCredit.tsx`** exports the same `AuthorCredit({ className })` (it moves unchanged).
- **`navState`:**
  - `HeaderId` loses `'made'`;
  - `NavTarget` loses `'panel'`;
  - `TransitionId` stays `Exclude<HeaderId | RailId, 'takeoff'> | 'cta' | 'restart' | 'change'`.
- **`copy`:**
  - remove `nav.made`, `outro.made.open` and `outro.howItsMade`;
  - keep `outro.made.lead`;
  - `footer.sky` gains `clouds: 'Clouds: NASA'`.

Footer:
- **Sky credit:** "Milky Way: ESO/S. Brunier, adapted · CC BY 4.0 · Clouds: NASA" (ESO and licence linked as now). It shows while the night sky is on screen, at every width.
- **Author line:** shows at every width.
- **On phones:** the footer may take two lines (`--footer-h` grows there), and the disclaimer may shorten to `copy.footer.disclaimerShort` ("A concept airline.", my call). Nothing overflows 412 px.

- [ ] **Step 1: Write the failing tests**
  - `navState.test.ts`: no item has label `"How it's made"` in any phase.
  - `shell.spec.ts`:
    - `there is no How it's made`:
      - `getByRole('banner').getByRole('button', { name: "How it's made" })` has count 0;
      - the same in the phone menu;
      - on the outro (`confirm` → progress 0.9), `getByRole('button', { name: "Read how it's made" })` has count 0;
      - the outro still shows `copy.outro.made.lead`.
    - `on a phone at night the footer shows the author and the sky credit without overflowing`:
      - at 412×915, at `pre('aisle', 0.27)`, the footer contains "Concept & code: Aslanov Rustam";
      - the ESO link and "CC BY 4.0" link are visible;
      - the footer contains "Clouds: NASA";
      - `document.documentElement.scrollWidth <= 412`;
      - no footer child's box exceeds the viewport.
  - Remove or rewrite the panel's tests:
    - `How it's made opens from the header and closes with Escape`: remove;
    - the dialog half of `the footer credits Aslanov Rustam…`: remove;
    - `journey.spec` line ~76: remove;
    - the curtain test `How it's made does not open under it`: rewrite to `the header's links wait under the curtain` with the Destinations rail button;
    - `skyImages.test` `How it's made credits…`: rewrite to `the footer credits the sky's sources` (`copy.footer.sky`: ESO/S. Brunier, adapted, CC BY 4.0, Clouds: NASA).

- [ ] **Step 2: Run, expect FAIL**

  Run: `npx vitest run tests/unit/navState.test.ts tests/unit/skyImages.test.ts && npx playwright test tests/e2e/shell.spec.ts --project=chromium -g "no How it's made|phone at night"`.

- [ ] **Step 3: Implement the removals and the footer**

- [ ] **Step 4: Run, expect PASS**

  Run: `npm run lint && npx tsc --noEmit && npx vitest run && npx playwright test --project=chromium`.

- [ ] **Step 5: Commit**

  `git commit -m "feat: How it's made goes; the footer carries the author and the sky's credits on every screen"`

---

### Task 7: Review shots, Plan 5 hand-over, full verification

**Files:**
- Modify: `tests/e2e/perf.spec.ts` (review shots), `docs/superpowers/plans/2026-10-22-aslanair-plan-5-polish.md`

- [ ] **Step 1: Review shots**
  - Add `loader-small` (the loader before `ready`, judged as dark).
  - Add `transfer-preview` (`pre('transfer', 0.45)`, judged on the plane's box).
  - Add `door-open` (`pre('door', 0.45)`).
  - Raise the expected count by 3.

- [ ] **Step 2: Plan 5 hand-over**
  - **Task 7 (copy):** its copy test drops the How it's made items. The image credits now live in `copy.footer.sky`.
  - **Accessibility:** strike the panel's focus-trap and focus-return items from the Plan 4 carry-over.
  - **Global constraint:** add "the author line and the sky credit stay visible in the footer on every screen".
  - **Reduced motion (Task 5):** note that the loader's growth and the transfer preview already honour reduced motion.

- [ ] **Step 3: Full verification**

  Run: `npm run lint && npx tsc --noEmit && npm test && npm run test:blender && npx playwright test --project=chromium`. Then run `npx playwright test --project=perf --no-deps` on a quiet GPU. Expect everything green, with the gate within 22.2 ms (it was last measured after 4c Task 11: seat 12.2, pass 12.7, exit 19.8).

- [ ] **Step 4: Commit**

  `git commit -m "test: review shots for r5; Plan 5 picks up after 4d"`

- [ ] **Step 5: Whole-branch review**

  One fresh reviewer, on the most capable model, reviews `feat/plan-4c-polish..feat/plan-4d-feedback`. Fix what it finds. Merges wait for the author.
