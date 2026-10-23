# AslanAir — Plan 5: Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make AslanAir feel finished on every device: quality tiers that keep phones smooth, live-synthesised sound with a remembered mute, the seat-lock and boarding-pass entrance, drag-to-flip, a reduced-motion version, a phone pass, final copy and metadata, and a production build ready for Vercel.

**Architecture:** Pure decision modules (`quality.ts`, `audio/mix.ts`, `audio/synth.ts`, `passMotion.ts`, `reducedMotion.ts`) hold every rule and are unit-tested; thin components apply them (Canvas settings, cloud uniforms, a WebAudio graph, gsap timelines, a veil). The store gains `quality`, `soundOn` persistence, `confirmedAt` and `reducedMotion`; load progress and `ready` already come from Plan 4's loader.

**Tech Stack:** as in Plans 1–4; Web Audio API (no audio files); Playwright device emulation (`devices['Pixel 7']`) and `page.emulateMedia({ reducedMotion: 'reduce' })`.

**Spec:** `docs/superpowers/specs/2026-10-22-aslanair-design.md` — §2 (60 / 45+ / 30+ fps, phones in reduced quality, sound with a toggle), §4.1 ch. 5 (seat fixed by a short animation, pass slides in, flip by mouse or finger), §4.7 (sound design, start on first interaction, toggle always visible, choice remembered), §4.8 (quality tiers, touch, model ≤ 1.5 MB, `prefers-reduced-motion`), §4.6 (copy tone), §4.5 (How it's made, concept disclaimer), §6 (Vercel); revision 2 `docs/superpowers/specs/2026-10-22-aslanair-design-r2-night.md` §3 (the intro), §4 (sound button in the header, phones), §7.2 (first tap shows the seat card, the second sits). The branded loader moved to Plan 4.

**Depends on:** Plan 4 merged (night world, shell with header/rail/footer, loader `ready`, `introState`, `IntroPlane`) and, through it, Plan 3b (seat card, two-tap seating).

## Global Constraints

- Sounds are synthesised at runtime with Web Audio; no audio files are added.
- No AudioContext exists before the visitor's first activation gesture (pointerdown, keydown or touchend); scrolling alone never starts sound. Sound defaults to on after that gesture unless the visitor muted before; the choice lives in `localStorage['aslanair:sound']` (`'on' | 'off'`). The toggle sits in the header's right group (Plan 4's slot) and stays visible on phones, outside the collapsed menu.
- Tiers: `high` (discrete desktop GPU), `medium` (integrated desktop GPU), `low` (phones, tablets, ≤ 4 GB devices). `?quality=high|medium|low` overrides. The tier never changes the light count or the cloud shader's defines (uniforms only), so switching never recompiles shaders.
- Under `prefers-reduced-motion: reduce` the camera never flies and the hero picture never flies: scroll moves between key poses through a 0.5 s veil (the hero picture gives way to the live 3D under the veil); no idle bob; hero notes and the pass fade in without stagger or slide; the loader emblem is drawn without the stroke animation.
- All strings in `src/content/copy.ts`; the e2e-pinned labels from Plan 1 keep their wording (`Pick for me`, `Choose this seat`, `See another`, `Change seat`, `Buy`, `Start again`, `Name`, `E-mail`, `Comment`, "WebGL2", "concept").
- Author name and portfolio links stay as visible placeholders (`[Author name]`, `[Portfolio link]`) — the author fills them (spec §6).
- Deploying to Vercel publishes the site: it happens only after the user confirms in chat (Task 8 stops there).
- Production build: no console errors; `/models/*` served with `Cache-Control: public, max-age=86400, stale-while-revalidate=604800`; models ≤ 2.1 MB total transfer (airliner ≤ 1.5 MB + kit ≤ 0.6 MB, Plan 3b); `/images/*` cached the same way.

## Review Focus

- A phone's first visit → `low` tier, then the hero; the first tap on a seat shows its card, the second sits; no layout overflow (Tasks 1, 6).
- Sound never starts before a gesture, a mute survives reload, and muting is instant (Task 2).
- A reduced-motion visitor never sees a camera flight or the flying hero picture, including the exit through the window (Task 5).
- Dragging the pass with a finger turns the card and does not scroll the page; a tap still flips it (Task 4).
- The production server (test hooks off) renders with no console errors and caches the models (Task 8).

## Carried over from Plan 4

Found while executing and reviewing Plan 4 and deliberately left for this plan; fold each into the task that owns it, with a test.

- Phones (Task 6): in portrait the 3D frame at fov 30 shows only ~37 % of the plane's width after the intro swap. A portrait fov for the outside shots must scale `IntroPlane`'s picture height by the same zoom (`tan(15°) / tan(fov/2)`), or the swap stops lining up.
- Seat view: the window outline is faceted at the seated eye (`CORNER_SEGMENTS = 5` in tools/blender/aslanair/openings.py; 12 is smooth but costs +25.7k triangles and the airliner sits at 119.5k of its 120k budget — trade triangles elsewhere), and the wall reads bright and warm rather than night.
- The moon is a front key with an ambient fill; spec r2 §9 pictures a rim light — a fresnel rim in the hull material is nearly free (needs the user's sign-off on the look).
- Six react-hooks lint errors in SkyAndClouds.tsx and BoardingPass3D.tsx (from Plan 1).
- Accessibility: the Menu sheet and the How it's made panel are `aria-modal` without a focus trap; the Menu button lacks `aria-expanded`; opening the panel from the phone menu returns focus to an unmounted button. The page has no `<main>` landmark (Task 6's test queries it).
- `?capture=plane` should only work outside production; `sharp` (used by tests/unit/planeImage.test.ts) belongs in devDependencies; planeImage.test should compute the picture's alpha box and compare it with `INTRO.picture.plane`.
- On DPR-2 screens the 1600×900 hero picture is upscaled at the swap: consider a 2× WebP capture within 500 KB.
- `planeBoxVars` in Hero.tsx uses the fixed `heroScale`, not the aspect-aware one (only below aspect 0.59 above 720 px wide).
- Perf measurement: the user's own browser on the dev server shares the GPU; judge the gate on a quiet GPU and choose levers with WebGL timer queries (`__aslan.gl`).

---

## File Structure

```
src/experience/quality.ts            NEW (pure): pickTier, TIER settings, stepDown
src/experience/passMotion.ts         NEW (pure): lockPulse, passEntrance, dragAngle, flipAfterDrag
src/experience/reducedMotion.ts      NEW (pure): key poses per chapter, keyIndex
src/experience/store.ts              + quality, setQuality, confirmedAt, reducedMotion, toggleSound, soundOn from storage
src/audio/synth.ts                   NEW (pure): hum, ding, rustle, gust sample generators
src/audio/mix.ts                     NEW (pure): ambience gains per phase/chapter, one-shot events from store transitions
src/audio/engine.ts                  NEW: WebAudio graph
src/audio/SoundController.tsx        NEW: gesture unlock, store → engine
src/ui/SoundToggle.tsx (in Plan 4's header slot), src/ui/Veil.tsx   NEW
src/ui/IntroPlane.tsx, Hero.tsx, Loader.tsx   reduced-motion variants
src/scene/QualityGovernor.tsx        NEW: applies the tier, steps down once on low fps
src/scene/sky/SkyAndClouds.tsx, src/scene/sky/shaders.ts   cloud scale / uSteps / uDetail from the tier
src/scene/cabin/Seats.tsx            seat LOD
src/scene/BoardingPass3D.tsx         entrance, drag-to-flip
src/scene/CameraRig.tsx              reduced-motion key poses
src/scroll/SmoothScroll.tsx          reduced motion: no smoothing
src/app/page.tsx, src/app/layout.tsx, src/app/icon.svg, public/og.png, next.config.ts
tools/blender/aslanair/kit.py        + low-LOD seat parts
tools/og.mjs                         NEW: renders public/og.png from the hero
playwright.config.ts                 + 'mobile' and 'prod' projects
tests/unit/quality.test.ts, passMotion.test.ts, reducedMotion.test.ts, synth.test.ts, mix.test.ts, copy.test.ts
tests/e2e/quality.spec.ts, sound.spec.ts, pass.spec.ts, reduced.spec.ts, mobile.spec.ts, prod.spec.ts
```

---

### Task 1: Quality tiers

**Files:**
- Create: `src/experience/quality.ts`, `src/scene/QualityGovernor.tsx`, `tests/unit/quality.test.ts`, `tests/e2e/quality.spec.ts`
- Modify: `src/experience/store.ts`, `src/scene/Experience.tsx`, `src/scene/sky/SkyAndClouds.tsx`, `src/scene/sky/shaders.ts`, `src/scene/cabin/Seats.tsx`, `tools/blender/aslanair/kit.py`, `tests/unit/kitAsset.test.ts`

**Interfaces:**
- Produces: `type Tier = 'high' | 'medium' | 'low'`; `interface DeviceProbe { renderer: string; maxTouchPoints: number; minScreenSide: number; deviceMemory?: number; hardwareConcurrency: number }`; `pickTier(probe: DeviceProbe, override?: string | null): Tier`; `stepDown(t: Tier): Tier`; `TIER: Record<Tier, { dpr: [number, number]; cloudScale: number; cloudSteps: number; cloudDetail: boolean; shadowMapSize: number; seatLod: 'full' | 'low' }>` with
  `high = { dpr: [1, 2], cloudScale: 0.5, cloudSteps: 40, cloudDetail: true, shadowMapSize: 2048, seatLod: 'full' }`,
  `medium = { dpr: [1, 1.5], cloudScale: 0.5, cloudSteps: 32, cloudDetail: true, shadowMapSize: 2048, seatLod: 'full' }`,
  `low = { dpr: [1, 1.25], cloudScale: 0.35, cloudSteps: 24, cloudDetail: false, shadowMapSize: 1024, seatLod: 'low' }`.
- Rules, in order: a valid override wins; touch (`maxTouchPoints > 0`) with `minScreenSide < 900` → low; `deviceMemory ≤ 4` → low; renderer matching `/Intel|UHD|Iris|Mali|Adreno|PowerVR|Apple GPU|SwiftShader|llvmpipe/i` → medium; otherwise high.
- Store: `quality: Tier`, `setQuality(t)`. Governor: reads the probe once (WEBGL_debug_renderer_info when available), applies `TIER[quality]`, and 3 s after `ready` steps down once if the median frame time over 120 frames exceeds 25 ms.
- Kit: `SeatFabricLow`, `SeatShellLow`, `SeatCoverLow` (no bevel segments, no subdivision; ≤ 400 triangles together with arm and legs).

- [ ] **Step 1: Write the failing tests**

```ts
const desktop: DeviceProbe = { renderer: 'ANGLE (NVIDIA GeForce RTX 5060 Laptop GPU)', maxTouchPoints: 0, minScreenSide: 1080, hardwareConcurrency: 16 };
test.each([
  [desktop, null, 'high'],
  [{ ...desktop, renderer: 'ANGLE (Intel(R) UHD Graphics)' }, null, 'medium'],
  [{ ...desktop, maxTouchPoints: 5, minScreenSide: 412, renderer: 'Adreno (TM) 740' }, null, 'low'],
  [{ ...desktop, deviceMemory: 4 }, null, 'low'],
  [desktop, 'low', 'low'],
  [desktop, 'ultra', 'high'],
])('pickTier %#', (probe, override, tier) => expect(pickTier(probe, override)).toBe(tier));
test('stepDown bottoms out at low', () => {
  expect([stepDown('high'), stepDown('medium'), stepDown('low')]).toEqual(['medium', 'low', 'low']);
});
```
`tests/e2e/quality.spec.ts`: `/?quality=low` → store `quality === 'low'`, `canvas.width / canvas.clientWidth ≤ 1.25`, `SeatFabricLow` instanced count 180 and `SeatFabric` absent or hidden; default desktop run → `quality !== 'low'`. `kitAsset.test.ts`: low parts present and ≤ 400 triangles.

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run tests/unit/quality.test.ts tests/unit/kitAsset.test.ts`, `npx playwright test tests/e2e/quality.spec.ts`
Expected: FAIL — module and kit parts missing.

- [ ] **Step 3: Implement**

`uSteps` (int uniform, loop to 40 with `if (i >= uSteps) break;`) and `uDetail` (float, replaces the `hq` detail-noise branch) in `shaders.ts`; `SkyAndClouds` takes scale/steps/detail from the store; Canvas `dpr` and the moon's shadow map size from the tier; `Seats` picks full/low kit parts. `npm run build:kit`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test && npm run e2e`
Expected: PASS; Plan 4's `perf.spec.ts` still within 22.2 ms (medium tier on the test browser).

- [ ] **Step 5: Commit**

```bash
git add src tools public/models tests
git commit -m "feat: device quality tiers with a one-step runtime fallback"
```

---

### Task 2: Sound

**Files:**
- Create: `src/audio/synth.ts`, `src/audio/mix.ts`, `src/audio/engine.ts`, `src/audio/SoundController.tsx`, `src/ui/SoundToggle.tsx`, `tests/unit/synth.test.ts`, `tests/unit/mix.test.ts`, `tests/e2e/sound.spec.ts`
- Modify: `src/experience/store.ts` (`soundOn` from storage, `toggleSound()`), `src/scene/Experience.tsx`, `src/ui/Shell.tsx` (mounts the toggle in its slot), `src/content/copy.ts`, `src/ui/shell.module.css`

**Interfaces:**
- Produces (pure, `synth.ts`, all mono `Float32Array` at the given sample rate, deterministic from a seed, peak ≤ 0.9): `hum(seconds, sr, seed)` — brown noise with a slow 0.13 Hz swell, loopable (first and last 50 ms crossfaded); `ding(sr)` — two-tone chime 1318.5 Hz + 987.8 Hz, 1.4 s exponential decay; `rustle(sr, seed)` — 0.35 s of band-passed noise bursts; `gust(sr, seed)` — 2.2 s noise swell, band 300–1800 Hz.
- Produces (pure, `mix.ts`): `ambience(phase: Phase, chapter: ChapterId, t: number): { outside: number; cabin: number; cabinCutoffHz: number }` — sky 0.55/0; door crossfades outside→cabin over t 0.3–0.7; aisle, seated, pass 0.05/0.35 with cutoff 650 Hz; exit crossfades back to outside over t 0–0.4; outro outside fades to 0.12; `oneShots(prev: Snapshot, next: Snapshot): ('ding' | 'rustle' | 'gust')[]` — ding when `phase` becomes `seated` or `confirmed`, rustle when the pass flips (`passFlips` counter in the store increases), gust when the post-track chapter becomes `exit`.
- Produces: `SoundToggle` — a button in the header's right group, `aria-pressed`, label `copy.sound.on` / `copy.sound.off` ('Sound on' / 'Sound off'), visible from first paint.

- [ ] **Step 1: Write the failing tests**

`synth.test.ts`:
```ts
test.each(['hum', 'ding', 'rustle', 'gust'] as const)('%s is audible, bounded and deterministic', (name) => {
  const a = make(name, 1), b = make(name, 1);           // helper calling the generator with sr 22050
  expect(a).toEqual(b);
  expect(Math.max(...a.map(Math.abs))).toBeLessThanOrEqual(0.9);
  expect(rms(a)).toBeGreaterThan(0.01);
});
test('the hum loops without a click', () => {
  const h = hum(4, 22050, 1);
  expect(Math.abs(h[0] - h[h.length - 1])).toBeLessThan(0.02);
});
```
`mix.test.ts`:
```ts
test('outside in the sky, muffled cabin in the aisle', () => {
  expect(ambience('browse', 'sky', 0.5)).toMatchObject({ outside: 0.55, cabin: 0 });
  expect(ambience('browse', 'aisle', 0.5)).toMatchObject({ outside: 0.05, cabin: 0.35, cabinCutoffHz: 650 });
});
test('the door crossfades continuously', () => {
  const a = ambience('browse', 'door', 0.49), b = ambience('browse', 'door', 0.51);
  expect(Math.abs(a.cabin - b.cabin)).toBeLessThan(0.03);
});
test('events become one-shots', () => {
  expect(oneShots(snap({ phase: 'browse' }), snap({ phase: 'seated' }))).toEqual(['ding']);
  expect(oneShots(snap({ phase: 'confirmed', chapter: 'pass' }), snap({ phase: 'confirmed', chapter: 'exit' }))).toEqual(['gust']);
});
```
`sound.spec.ts` (an init script counts `AudioContext` constructions):
```ts
test('no audio before a gesture; the toggle is remembered', async ({ page }) => {
  await page.addInitScript(() => { const A = window.AudioContext; let n = 0;
    window.AudioContext = class extends A { constructor(...a) { super(...a); (window as any).__ctx = ++n; } } as any; });
  await page.goto('/'); await waitForStore(page);
  await page.mouse.wheel(0, 1200);
  expect(await page.evaluate(() => (window as any).__ctx ?? 0)).toBe(0);
  await page.getByRole('button', { name: 'Sound on' }).click();      // first gesture: creates the context, then mutes
  await expect(page.getByRole('button', { name: 'Sound off' })).toHaveAttribute('aria-pressed', 'false');
  await page.reload(); await waitForStore(page);
  await expect(page.getByRole('button', { name: 'Sound off' })).toBeVisible();
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run tests/unit/synth.test.ts tests/unit/mix.test.ts`, `npx playwright test tests/e2e/sound.spec.ts`
Expected: FAIL — modules and toggle missing.

- [ ] **Step 3: Implement**

`engine.ts`: master gain → destination; two looping hum buffers (outside dry; cabin through a lowpass at `cabinCutoffHz`); one-shot buffers rendered once on unlock; gains ramp with `setTargetAtTime(value, now, 0.25)`; mute ramps master to 0 in 0.08 s. `SoundController` unlocks on the first `pointerdown`/`keydown`/`touchend`, then follows the store. Add `passFlips` to the store (incremented by the pass flip).

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test && npm run e2e`
Expected: PASS. Listen once on the dev machine (hum, door crossfade, ding, rustle, gust) and ledger the impression; adjust levels only, not structure.

- [ ] **Step 5: Commit**

```bash
git add src tests
git commit -m "feat: synthesised sound with a remembered mute"
```

---

### Task 3: Seat lock and the boarding pass entrance

**Files:**
- Create: `src/experience/passMotion.ts`, `tests/unit/passMotion.test.ts`, `tests/e2e/pass.spec.ts`
- Modify: `src/experience/store.ts` (`confirmedAt: number | null` set by `confirm()` from `performance.now()`), `src/scene/cabin/SeatHighlight.tsx`, `src/scene/cabin/Seats.tsx` (cover scale on the selected seat), `src/scene/BoardingPass3D.tsx`

**Interfaces:**
- Produces: `lockPulse(ms: number): { coverScale: number; glow: number }` — 0–600 ms: cover scale 1 → 1.06 → 1 (peak at 180 ms), glow 0.8 → 1.6 → 0.8; after 600 ms `{1, 0.8}`; `passEntrance(ms: number, reduced: boolean): { offsetY: number; tilt: number; opacity: number }` — starts at 600 ms, 700 ms long, `power3.out`: offsetY −0.35 → 0, tilt 0.25 → 0 rad, opacity 1; reduced: offsetY 0, tilt 0, opacity 0 → 1 over 400 ms.

- [ ] **Step 1: Write the failing tests**

```ts
test('the cover clicks into place, then rests', () => {
  expect(lockPulse(0).coverScale).toBeCloseTo(1);
  expect(lockPulse(180).coverScale).toBeCloseTo(1.06);
  expect(lockPulse(900)).toEqual({ coverScale: 1, glow: 0.8 });
});
test('the pass waits for the lock, slides up and settles', () => {
  expect(passEntrance(300, false)).toMatchObject({ offsetY: -0.35, opacity: 1 });
  expect(passEntrance(2000, false)).toEqual({ offsetY: 0, tilt: 0, opacity: 1 });
  expect(passEntrance(800, true).offsetY).toBe(0);
});
```
`pass.spec.ts`: after `Choose this seat`, sample the pass holder's camera-space y at +300 ms and +1600 ms: first below the second by > 0.2.

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run tests/unit/passMotion.test.ts`, `npx playwright test tests/e2e/pass.spec.ts`
Expected: FAIL.

- [ ] **Step 3: Implement** (all motion reads `performance.now() − confirmedAt`; nothing else changes the pass placement)

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test && npm run e2e`
Expected: PASS; `journey.spec.ts` unchanged.

- [ ] **Step 5: Commit**

```bash
git add src tests
git commit -m "feat: seat lock pulse and boarding pass entrance"
```

---

### Task 4: Drag to flip the pass

**Files:**
- Modify: `src/experience/passMotion.ts`, `src/scene/BoardingPass3D.tsx`, `src/content/copy.ts` (`pass.flipHint = 'Drag or tap the pass to turn it over.'`), `src/app/globals.css` (canvas `touch-action: pan-y`), `tests/unit/passMotion.test.ts`, `tests/e2e/pass.spec.ts`

**Interfaces:**
- Produces: `dragAngle(start: number, dxPx: number, widthPx: number): number` = `start + π·dx/width`; `flipAfterDrag(start: number, current: number, velocityRadPerS: number): number` — the nearest multiple of π to `current`, but a flick (|v| > 6 rad/s) goes to the next multiple in the flick's direction from `start`; a press that moves < 6 px is a tap and flips by π as before. Each settled flip increments the store's `passFlips`.

- [ ] **Step 1: Write the failing tests**

```ts
test('drags follow the pointer and settle on a face', () => {
  expect(dragAngle(0, 150, 300)).toBeCloseTo(Math.PI / 2);
  expect(flipAfterDrag(0, 0.4 * Math.PI, 0)).toBeCloseTo(0);
  expect(flipAfterDrag(0, 0.6 * Math.PI, 0)).toBeCloseTo(Math.PI);
  expect(flipAfterDrag(0, 0.2 * Math.PI, 9)).toBeCloseTo(Math.PI);    // flick
  expect(flipAfterDrag(Math.PI, 0.9 * Math.PI, -9)).toBeCloseTo(0);
});
```
`pass.spec.ts`: on the pass, a mouse drag of 60 % of the card width turns the card (flipper `rotation.y` ≈ π after 1 s); a plain click turns it back to ≈ 0 (mod 2π); during the drag the store `progress` does not change.

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run tests/unit/passMotion.test.ts`, `npx playwright test tests/e2e/pass.spec.ts -g drag`
Expected: FAIL.

- [ ] **Step 3: Implement** (pointer capture on the card; release animates with gsap to `flipAfterDrag`)

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test && npm run e2e`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src tests
git commit -m "feat: drag or tap to turn the boarding pass"
```

---

### Task 5: Reduced motion

**Files:**
- Create: `src/experience/reducedMotion.ts`, `src/ui/Veil.tsx`, `tests/unit/reducedMotion.test.ts`, `tests/e2e/reduced.spec.ts`
- Modify: `src/experience/store.ts` (`reducedMotion` from `matchMedia`, live), `src/scene/CameraRig.tsx`, `src/scroll/SmoothScroll.tsx`, `src/scene/aircraft/Aircraft.tsx` (no bob), `src/scene/BoardingPass3D.tsx` (fade entrance), `src/ui/IntroPlane.tsx` (picture follows the key, not the scroll), `src/ui/Hero.tsx` (no stagger), `src/ui/Loader.tsx` (static emblem)

**Interfaces:**
- Produces: `KEY_POSES: Record<Track, { chapter: ChapterId; at: number }[]>` — pre: sky `hero` (before `INTRO.swapAt`: the picture at hero scale), sky `swap` (live 3D at `INTRO.swapPose`), door 0.15, door 1.0, aisle continuous; post: pass 0.5, exit 1.0, outro 0.5; `reducedPose(track, progress, seat?) : { pose: CameraPose; key: string }` — the aisle keeps the continuous walk (it is a walk, not a flight); every other chapter returns the pose of its key point, and `key` changes only when the key point changes. `Veil` fades to `#07080b` at opacity 1 over 0.25 s, swaps, fades back over 0.25 s whenever `key` changes. Lenis runs with `lerp: 1, smoothWheel: false`.

- [ ] **Step 1: Write the failing tests**

```ts
test('flights collapse to key poses; the aisle stays a walk', () => {
  const a = reducedPose('pre', trackProgress('pre', 'door', 0.3));
  const b = reducedPose('pre', trackProgress('pre', 'door', 0.6));
  expect(a.key).not.toBe(b.key);
  expect(reducedPose('pre', trackProgress('pre', 'sky', 0.1)).pose.position.equals(reducedPose('pre', trackProgress('pre', 'sky', 0.9)).pose.position)).toBe(true);
  const w1 = reducedPose('pre', trackProgress('pre', 'aisle', 0.2)), w2 = reducedPose('pre', trackProgress('pre', 'aisle', 0.25));
  expect(w1.pose.position.distanceTo(w2.pose.position)).toBeGreaterThan(0.1);
});
```
`reduced.spec.ts` (`page.emulateMedia({ reducedMotion: 'reduce' })`): the intro picture's box keeps its size and place while the veil is below 0.5, and after the `swap` key the picture is gone and the aircraft visible; scrolling from the sky into the door chapter shows the veil (opacity > 0.5 at some sample) and the camera position sampled every frame never moves more than 0.3 m between consecutive frames while the veil is below 0.5.

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run tests/unit/reducedMotion.test.ts`, `npx playwright test tests/e2e/reduced.spec.ts`
Expected: FAIL.

- [ ] **Step 3: Implement** (CameraRig: in reduced mode it copies the pose under the veil instead of damping; the exit through the window becomes seated → veil → pull-back)

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test && npm run e2e`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src tests
git commit -m "feat: reduced-motion journey without camera flights"
```

---

### Task 6: Phones

**Files:**
- Modify: `playwright.config.ts` (project `mobile` = `devices['Pixel 7']`, runs `tests/e2e/mobile.spec.ts` only), `src/ui/ui.module.css`, `src/ui/shell.module.css` (safe-area insets, bar wrapping under 480 px, caption sizes)
- Create: `tests/e2e/mobile.spec.ts`

**Interfaces:**
- Produces (test helper in `tests/e2e/helpers.ts`): `tapScanForSeat(page): Promise<string>` — taps each point of a grid over the lower 60 % of the viewport (`page.touchscreen.tap`); when the seat card appears it taps the same point again; stops when `phase === 'seated'` and returns `selectedSeatId`.
- Produces: bars use `padding-bottom: max(1rem, env(safe-area-inset-bottom))`; the seat card stays inside the viewport (flips below the seat near the top edge); nothing overflows horizontally.

- [ ] **Step 1: Write the failing tests**

```ts
test('phone: low tier, tap a seat, nothing overflows', async ({ page }) => {
  await page.goto('/'); await waitForStore(page);
  expect(await page.evaluate(() => window.__aslan.store.getState().quality)).toBe('low');
  // scroll (touch swipes via page.mouse.wheel are fine in emulation) to the aisle, then tap-scan for a free seat
  await expect(page.getByRole('button', { name: 'Menu' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Sound (on|off)/ })).toBeVisible();
  const id = await tapScanForSeat(page);          // first tap shows the card, the second sits
  expect(id).toMatch(/^\d+[A-F]$/);
  for (const sel of ['main', 'body']) expect(await page.evaluate((s) => document.querySelector(s)!.scrollWidth <= innerWidth, sel)).toBe(true);
  const bar = await page.getByRole('button', { name: 'Choose this seat' }).boundingBox();
  expect(bar!.y + bar!.height).toBeLessThanOrEqual(page.viewportSize()!.height);
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx playwright test --project=mobile`
Expected: FAIL (no `mobile` project yet, then overflowing bars) — record what fails.

- [ ] **Step 3: Implement the CSS and coarse-pointer changes**

- [ ] **Step 4: Run all projects**

Run: `npm run e2e` (desktop + mobile)
Expected: PASS. Screenshots of the phone run at loader, hero, intro swap, aisle (with the card), seated, pass, outro viewed.

- [ ] **Step 5: Commit**

```bash
git add playwright.config.ts src tests
git commit -m "feat: phone pass — tap to sit, safe areas, no overflow"
```

---

### Task 7: Final copy, metadata and icon

**Files:**
- Modify: `src/content/copy.ts`, `src/app/layout.tsx` (metadata: title, description, Open Graph, Twitter card)
- Create: `src/app/icon.svg` (sun over horizon, navy/terracotta), `tools/og.mjs` (renders `public/og.png` 1200 × 630 from the hero at progress 0 via Playwright), `public/og.png`, `tests/unit/copy.test.ts`

**Interfaces:**
- Produces: a final copy pass in the spec's tone (calm, premium, no hype), including the hero, captions for every chapter, the seat card, the pass and outro texts, "How it's made" (stack; aircraft and cabin kit built by Python in Blender; night sky and clouds raymarched live; the hero picture captured from the live scene; every seat a real 3D object; sound synthesised live with Web Audio), the author line with the two placeholders kept.

- [ ] **Step 1: Write the failing test**

```ts
test('copy keeps the pinned labels, the disclaimer and the author placeholders', () => {
  expect(copy.aisle.pickForMe).toBe('Pick for me');
  expect(copy.outro.thanks).toMatch(/concept/);
  expect(copy.footer.disclaimer).toMatch(/fictional/);
  expect(copy.outro.howItsMade.items.some((i) => /Web Audio/.test(i))).toBe(true);
  expect(copy.outro.howItsMade.author).toMatch(/\[Author name\].*\[Portfolio link\]/);
});
```
e2e (in `smoke.spec.ts`): `<meta property="og:image">` points at `/og.png`, which returns 200; `/icon.svg` returns 200.

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run tests/unit/copy.test.ts`, `npx playwright test tests/e2e/smoke.spec.ts`
Expected: FAIL (no Web Audio line, no og meta).

- [ ] **Step 3: Implement; run `node tools/og.mjs` against the dev server; view `public/og.png`**

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test && npm run e2e`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src tools/og.mjs public/og.png tests
git commit -m "feat: final copy, metadata, icon and share image"
```

---

### Task 8: Production check and deploy

**Files:**
- Modify: `next.config.ts` (`headers()` for `/models/:path*` and `/images/:path*`), `playwright.config.ts` (project `prod`: `webServer` = `npm run build && npm run start -- -p 3200`, runs `tests/e2e/prod.spec.ts` only)
- Create: `tests/e2e/prod.spec.ts`

**Interfaces:**
- Produces: production smoke checks that use only the DOM (test hooks are off in production).

- [ ] **Step 1: Write the failing test**

```ts
test('production renders, caches the models and logs no errors', async ({ page }) => {
  const errors: string[] = []; page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  let bytes = 0; const cache: string[] = [];
  page.on('response', async (r) => { if (r.url().includes('/models/')) { bytes += (await r.body()).length; cache.push(r.headers()['cache-control'] ?? ''); } });
  await page.goto('/');
  await expect(page.locator('#loader')).toBeHidden({ timeout: 30_000 });
  await expect(page.locator('canvas')).toBeVisible();
  expect(errors).toEqual([]);
  expect(cache.every((c) => c.includes('max-age=86400'))).toBe(true);
  expect(bytes).toBeLessThanOrEqual(2_100_000);
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx playwright test --project=prod`
Expected: FAIL on the cache header.

- [ ] **Step 3: Add the headers; re-run until PASS; run every suite**

Run: `npm test && npm run test:blender && npm run e2e && npx playwright test --project=prod`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add next.config.ts playwright.config.ts tests/e2e/prod.spec.ts
git commit -m "chore: production cache headers and smoke test"
```

- [ ] **Step 5: STOP — deploy only on the user's go**

Ask the user in chat: deploying to Vercel publishes the site publicly and needs their Vercel account (`npx vercel login`, then `npx vercel --prod`). Offer to run it once they are logged in, or let them run it. Also remind them that `[Author name]` and `[Portfolio link]` in `src/content/copy.ts` are still placeholders. Do nothing further until they answer.

---

## Spec coverage (this plan)

| Spec | Where |
|------|-------|
| §2 smooth on desktop/integrated/phones; §4.8 quality tiers | Task 1 |
| §4.7 sound design, first-interaction start, toggle always visible, remembered; r2 §4 sound in the header | Task 2 |
| §4.1 ch. 5 seat fixed by a short animation, pass slides in | Task 3 |
| §4.1 ch. 5 / §4.4 / §4.8 flip by mouse or finger | Task 4 |
| §4.8 `prefers-reduced-motion`, including the r2 intro | Task 5 |
| §4.8 touch seat selection, phones; r2 §4 phones, §7.2 two-tap seating | Task 6 |
| §4.5–4.6 final copy, How it's made, disclaimer | Task 7 |
| §6 Vercel hosting | Task 8 (deploy on the user's go) |
| §4.8 branded loader | Plan 4, Task 8 |
