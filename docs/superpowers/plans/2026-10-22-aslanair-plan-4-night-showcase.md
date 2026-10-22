# AslanAir — Plan 4: Night Flight and the Showcase Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn AslanAir into a dark, editorial night flight: a branded loader, a showcase hero where a small picture of our plane flies down and becomes the live 3D model, a header with chapter navigation, a chapter rail, a footer and a "How it's made" panel; a night world (moon, stars, moonlit clouds) seen from the cabin and on the exit; a night-lit aircraft (navigation lights, beacons, strobes, floodlit fin, glowing windows) and a dimmed night cabin that stays readable.

**Architecture:** A pure `worldState.ts` decides the world mode per frame — `showcase` (plain dark background, no cloud pass, studio-lit plane) until the walking camera is inside the cabin, `night` from then on; lights keep a constant count and only change intensities. The sky shaders become a night sky (same raymarch, moonlight). Overlay UI moves to a design-token CSS layer with free Google fonts. The hero plane picture is captured from the live scene by a Playwright tool in a `?capture=plane` mode, so the swap to 3D lines up to the pixel; a pure `introState.ts` drives the picture's flight and the swap.

**Tech Stack:** as in Plans 1–3b; `next/font/google` (Archivo for display, Inter for UI — both OFL); drei `useProgress`; Playwright for the capture tool.

**Spec:** `docs/superpowers/specs/2026-10-22-aslanair-design-r2-night.md` §2–§6, §9 (and §4 navigation rules); base spec §4.1 scroll rules.

**Depends on:** Plan 3b merged (realistic cabin, seat card).

## Global Constraints

- Night throughout. Before the camera is inside the cabin the scene background is plain dark (`#07080b`); from then on (and on the exit) it is the night sky.
- The site never reads as a black screen: in every chapter the plane or the cabin is clearly lit (luminance checks in Task 10).
- Visual tokens: background `#07080b`, text `#f2efe8`, dim text `rgba(242,239,232,.55)`, accent terracotta `#d4683a`, navy `#1b2541`; display font Archivo (heavy), UI font Inter.
- Navigation obeys the seat gate (r2 §4): before confirmation Flight/Cabin go to their chapters, "Your seat" goes to the aisle, Boarding pass is disabled; after confirmation Flight/Cabin are disabled, "Your seat"/Boarding pass go to the pass; "How it's made" is a panel available always.
- Light count is constant from the first frame (shader keys never change); world modes change intensities and uniforms only.
- Frame-rate gate (integrated GPU, `perf` project): showcase, door, aisle, seat, pass, exit — median and mean ≤ 22.2 ms.
- The hero plane picture is ours, captured from our scene (no stock imagery); `public/images/plane-hero.png` ≤ 500 KB.
- Strings in `src/content/copy.ts`; Plan 1's pinned labels keep their wording.

## Review Focus

- The picture-to-3D swap shows no jump in size, position or colour on 16:9, 21:9 and phone aspect ratios (pixel-difference test across the swap, Task 7).
- Header navigation and the rail never let the visitor skip the seat gate or lose a confirmed seat (nav-state unit tests + e2e after confirmation, Task 4).
- The night cabin stays readable — seats, aisle and availability colours visible (luminance + hue test, Task 3).
- Navigation lights and strobes blink on a deterministic schedule and never change the light count (unit timing tests; light-count e2e, Task 2).
- Resizing or reloading in the middle of the intro keeps the picture and the 3D in step (e2e resize at the swap point, Task 7).

---

## File Structure

```
src/experience/worldState.ts          NEW (pure): cameraInsideCabin(), worldMode() — cloudDetail.ts reuses cameraInsideCabin
src/experience/introState.ts          NEW (pure): introState(progress, aspect)
src/experience/navState.ts            NEW (pure): navItems(phase, chapter)
src/experience/blink.ts               NEW (pure): beacon(t), strobe(t)
src/experience/readingLights.ts       NEW (pure): readingLightSeats(seats)
src/scene/sky/shaders.ts, SkyAndClouds.tsx   night sky, moonlight, showcase background, studio lights
src/scene/aircraft/NightLights.tsx     NEW: nav lights, beacons, strobes, fin floodlight, window glow
src/scene/cabin/cabinLight.ts, Bins.tsx, ReadingLights.tsx (NEW)   night cabin
src/scene/CaptureMode.tsx              NEW: ?capture=plane renderer setup
tools/capture-plane.mjs                NEW: writes public/images/plane-hero.png
src/ui/Shell.tsx (header, rail, footer), HowItsMade.tsx, Hero.tsx, IntroPlane.tsx, Loader.tsx (+ CSS modules) NEW
src/ui/Overlay.tsx, Outro.tsx          restyled to the tokens
src/app/layout.tsx, page.tsx           fonts; server-rendered loader shell; preload of the plane picture
tools/blender/aslanair/export.py       meta lights: navPort, navStarboard, tail, beaconTop, beaconBottom, strobePort, strobeStarboard
tests/unit/worldState, introState, navState, blink, readingLights tests (NEW); e2e shell.spec.ts, intro.spec.ts, night.spec.ts (NEW); perf.spec.ts extended
```

---

### Task 1: World modes and the night sky

**Files:**
- Create: `src/experience/worldState.ts`, `tests/unit/worldState.test.ts`, `tests/e2e/night.spec.ts`
- Modify: `src/experience/cloudDetail.ts` (uses `cameraInsideCabin`), `src/scene/sky/shaders.ts`, `src/scene/sky/SkyAndClouds.tsx`

**Interfaces:**
- Produces: `cameraInsideCabin(phase: Phase, progress: number): boolean` (the pre-track camera inside the liner and aft of the front bulkhead; every non-browse phase counts as aboard); `worldMode(phase, progress): 'showcase' | 'night'` — `showcase` while browsing and not yet inside, else `night`.
- Produces (shaders): night `skyCol` — deep navy zenith to dark horizon, moon disk + glow at `MOON_DIRECTION` (elevation 32°, behind-left of the hero camera), procedural stars above the horizon, dark sea below with a moon glitter path; clouds lit by the moon (cool, low intensity, silver edges); the environment map built from the night sky. `uMode` uniform (0 showcase / 1 night): in showcase the cloud pass is skipped entirely and `scene.background` is the plain dark colour.
- The directional light becomes the moon (cool `#b9c7ff`), shadows as now.

- [ ] **Step 1: Write the failing tests**

```ts
test('showcase until the camera is inside, night from then on', () => {
  expect(worldMode('browse', trackProgress('pre', 'sky', 0.5))).toBe('showcase');
  expect(worldMode('browse', trackProgress('pre', 'door', 0.3))).toBe('showcase');
  expect(worldMode('browse', trackProgress('pre', 'door', 0.9))).toBe('night');
  expect(worldMode('browse', trackProgress('pre', 'aisle', 0.5))).toBe('night');
  expect(worldMode('confirmed', trackProgress('post', 'exit', 0.5))).toBe('night');
});
```
`night.spec.ts`: at progress 0.05 the frame's corners are near `#07080b` (each channel ≤ 16); seated at 14F the window region is dark blue (b > r, mean ≤ 110) with some bright pixels (moon/clouds); at post progress 0.45 (exit) the lower half shows moonlit clouds (luminance variance > 40).

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run tests/unit/worldState.test.ts`, `npx playwright test tests/e2e/night.spec.ts`
Expected: FAIL.

- [ ] **Step 3: Implement** (keep `cloudScale`'s behaviour via `cameraInsideCabin`; tune the moon and clouds by screenshots)

- [ ] **Step 4: Run tests; view sky, seat-14F and exit screenshots**

Run: `npm test && npm run e2e`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src tests
git commit -m "feat: night sky with moon and stars; dark showcase background until boarding"
```

---

### Task 2: The aircraft at night

**Files:**
- Create: `src/experience/blink.ts`, `src/scene/aircraft/NightLights.tsx`, `tests/unit/blink.test.ts`
- Modify: `tools/blender/aslanair/export.py` (meta `lights`), `src/experience/geometry.ts` (mirror), `src/scene/aircraft/Aircraft.tsx` (fin floodlight via emissive, window glass glow), `src/scene/sky/SkyAndClouds.tsx` (showcase studio rim + fill: intensities by world mode), `tests/unit/aircraftAsset.test.ts`, `tests/e2e/night.spec.ts`

**Interfaces:**
- Produces: meta `lights: { navPort, navStarboard, tail, beaconTop, beaconBottom, strobePort, strobeStarboard }` (three.js coordinates, from the wing-tip, tail-cone and fuselage geometry); `beacon(t: number): number` — red flash 0→1 for 0.12 s once per 1.0 s; `strobe(t: number): number` — two 0.05 s white flashes 0.15 s apart every 1.2 s; `NightLights` — small emissive spheres + additive glow sprites (no real lights), red port, green starboard, white tail, beacons, strobes; fin emblem floodlit (fin material emissive from its own map at 0.35); `WindowGlass` emissive warm `#ffcf8a` at 0.6; studio lights: a cool rim light from behind-above and a soft fill, on in showcase, dimmed in night (constant count).

- [ ] **Step 1: Write the failing tests**

```ts
test('beacon flashes once a second', () => {
  expect(beacon(0.05)).toBeGreaterThan(0.8);
  expect(beacon(0.5)).toBe(0);
  expect(beacon(1.05)).toBeGreaterThan(0.8);
});
test('strobes double-flash every 1.2 s', () => {
  expect(strobe(0.02)).toBe(1);
  expect(strobe(0.1)).toBe(0);
  expect(strobe(0.17)).toBe(1);
  expect(strobe(0.6)).toBe(0);
  expect(strobe(1.22)).toBe(1);
});
```
Asset: `meta.lights.navPort[2] < 0 < meta.lights.navStarboard[2]` and the tips are ≥ 16 m from the centreline. e2e: `NightLights` children include red, green and white lights at the meta positions; the visible light count is the same at progress 0.05 and 0.6.

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run tests/unit/blink.test.ts tests/unit/aircraftAsset.test.ts`, `npx playwright test tests/e2e/night.spec.ts`
Expected: FAIL.

- [ ] **Step 3: Implement; `npm run build:aircraft`**

- [ ] **Step 4: Run tests; view the hero, door and exit screenshots (white fuselage reads on black; lights blink)**

Run: `npm test && npm run e2e`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add tools/blender src public/models tests
git commit -m "feat: night aircraft — navigation lights, beacons, strobes, floodlit fin, glowing windows"
```

---

### Task 3: The night cabin

**Files:**
- Create: `src/experience/readingLights.ts`, `src/scene/cabin/ReadingLights.tsx`, `tests/unit/readingLights.test.ts`
- Modify: `src/scene/cabin/cabinLight.ts` (night colour/intensity), `src/scene/cabin/Bins.tsx` (mood strips `#5b6fb5` mixed with warm white), `tests/e2e/night.spec.ts`

**Interfaces:**
- Produces: `readingLightSeats(seats: Seat[]): string[]` — a deterministic quarter of the occupied seats (seeded), never the hovered/selected one; `ReadingLights` — an emissive disc on the PSU above each and a soft additive cone down to the seat (no real lights); cabin light warm and dimmer than Plan 3.

- [ ] **Step 1: Write the failing tests**

Unit: the selection is deterministic, ⊂ occupied seats, size = round(occupied / 4). e2e (`night.spec.ts`) — the anti-goal: in the aisle view (progress 0.6) the seats crop's mean luminance ≥ 45 and ≥ 2 % of its pixels are teal-ish (covers readable).

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run tests/unit/readingLights.test.ts`, `npx playwright test tests/e2e/night.spec.ts -g readable`
Expected: FAIL (module missing; the luminance test may already pass — if so, record the value and keep it as the guard).

- [ ] **Step 3: Implement; tune by screenshots so the cabin reads as a night cabin, not a dim day cabin**

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test && npm run e2e`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src tests
git commit -m "feat: night cabin — warm dim light, mood strips, reading lights"
```

---

### Task 4: The shell — tokens, fonts, header, rail, footer, How it's made

**Files:**
- Create: `src/experience/navState.ts`, `src/ui/Shell.tsx`, `src/ui/shell.module.css`, `src/ui/HowItsMade.tsx`, `tests/unit/navState.test.ts`, `tests/e2e/shell.spec.ts`
- Modify: `src/app/layout.tsx` (Archivo + Inter via `next/font/google`), `src/app/globals.css` (tokens), `src/ui/ui.module.css`, `src/ui/Overlay.tsx`, `src/ui/Outro.tsx` (restyle; the short How it's made block stays), `src/scene/Experience.tsx`, `src/content/copy.ts`

**Interfaces:**
- Produces: `navItems(phase: Phase, chapter: ChapterId): { id: 'flight' | 'cabin' | 'seat' | 'pass' | 'made'; label: string; enabled: boolean; active: boolean; target: { track: Track; progress: number } | 'panel' | null }[]` and `railItems(phase, chapter)` (01 Flight · 02 Boarding · 03 Cabin · 04 Your seat · 05 Take-off) with the r2 §4 gate rules; header buttons scroll with `scrollToProgress` on the current track; the CTA "Choose your seat" goes to the aisle and is hidden after confirmation (it would break the gate); the header's right group keeps an empty slot before the CTA for Plan 5's sound button; `HowItsMade` — a dialog (`role="dialog"`, Esc and the close button close it, focus returns to the opener).
- Phones (≤ 720 px wide): the nav collapses into a "Menu" button that opens the same items as a full-screen list; the rail is hidden; the footer shrinks to the disclaimer and the How it's made link.

- [ ] **Step 1: Write the failing tests**

```ts
test('before confirmation the pass is out of reach', () => {
  const items = navItems('browse', 'aisle');
  expect(items.find((i) => i.id === 'pass')).toMatchObject({ enabled: false });
  expect(items.find((i) => i.id === 'seat')!.target).toEqual({ track: 'pre', progress: trackProgress('pre', 'aisle', 0) });
});
test('after confirmation the cabin is out of reach and the seat goes to the pass', () => {
  const items = navItems('confirmed', 'exit');
  expect(items.find((i) => i.id === 'flight')).toMatchObject({ enabled: false });
  expect(items.find((i) => i.id === 'cabin')).toMatchObject({ enabled: false });
  expect(items.find((i) => i.id === 'seat')!.target).toEqual({ track: 'post', progress: 0 });
});
test('How it is made is always a panel', () => {
  for (const [ph, ch] of [['browse', 'sky'], ['seated', 'aisle'], ['confirmed', 'outro']] as const)
    expect(navItems(ph, ch).find((i) => i.id === 'made')).toMatchObject({ enabled: true, target: 'panel' });
});
```
`shell.spec.ts`: header, rail and footer visible on load; "Cabin" scrolls to the aisle (chapter becomes `aisle`); after confirming a seat, "Cabin" is disabled and clicking it changes nothing, and "Choose your seat" is hidden; "How it's made" opens the dialog from header and footer, Esc closes it; at 412×915 the "Menu" button is visible, the rail is hidden and `body.scrollWidth ≤ innerWidth`.

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run tests/unit/navState.test.ts`, `npx playwright test tests/e2e/shell.spec.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

- [ ] **Step 4: Run tests to verify they pass; view the header/rail/footer over sky, aisle and outro**

Run: `npm test && npm run e2e`
Expected: PASS (Plan 1 pinned labels intact).

- [ ] **Step 5: Commit**

```bash
git add src tests
git commit -m "feat: dark shell — header with gated chapter nav, chapter rail, footer, How it's made panel"
```

---

### Task 5: The showcase hero

**Files:**
- Create: `src/ui/Hero.tsx`, `src/ui/hero.module.css`
- Modify: `src/ui/Overlay.tsx` (chapter captions restyled; the old sky caption replaced by the hero), `src/content/copy.ts` (`hero: { title: 'Night flight', notes: [...], lead, scroll }`), `tests/e2e/shell.spec.ts`

**Interfaces:**
- Produces: `Hero` — visible in the showcase chapter, fades out as the intro flight starts; huge display title (Archivo heavy, terracotta), three notes with thin SVG lines (route & time "IST → LIS · 22:40", "180 seats · 3+3", "Seats from $15" — computed from the seat map's minimum price), lead paragraph, "Scroll to board"; notes appear staggered after the loader hands over. Phones: the title scales with the viewport width, the notes stack in a column under the plane without their lines.

- [ ] **Step 1: Write the failing test**

```ts
test('the hero shows the title, three notes and the scroll hint, then gives way on scroll', async ({ page }) => {
  // after the loader: title 'Night flight', notes contain 'IST → LIS', '180 seats', '$15'; 'Scroll to board' visible
  // wheel down 600 px → hero opacity < 0.2
});
test('on a phone the hero notes stack and nothing overflows', async ({ page }) => {
  // 412×915: the three notes' boxes do not overlap each other or the title; body.scrollWidth ≤ innerWidth
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx playwright test tests/e2e/shell.spec.ts -g hero`
Expected: FAIL.

- [ ] **Step 3: Implement**

- [ ] **Step 4: Run tests; view the hero at 16:9, 21:9 and phone sizes**

Run: `npm run e2e`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src tests
git commit -m "feat: showcase hero — Night flight, notes, lead and scroll hint"
```

---

### Task 6: Capturing the plane picture from our scene

**Files:**
- Create: `src/experience/introState.ts` (only `INTRO.swapPose` in this task), `src/scene/CaptureMode.tsx`, `tools/capture-plane.mjs`, `public/images/plane-hero.png`, `tests/unit/planeImage.test.ts`
- Modify: `src/scene/Experience.tsx` (`?capture=plane`), `package.json` (`"capture:plane": "node tools/capture-plane.mjs"`)

**Interfaces:**
- Produces: `INTRO.swapPose: CameraPose` — three-quarter front view of the whole aircraft, nose to the left, the plane filling ~70 % of a 16:9 frame's width; Task 7 adds the rest of `INTRO`.
- Produces: `?capture=plane` — renders only the aircraft at `INTRO.swapPose` with showcase lighting, transparent clear colour, no overlays, a fixed 1600 × 900 canvas; `tools/capture-plane.mjs` — Playwright opens it against the dev server, waits for two settled frames, screenshots with `omitBackground: true` to `public/images/plane-hero.png`.

- [ ] **Step 1: Write the failing test**

```ts
test('the plane picture is a transparent 1600×900 PNG under 500 KB', () => {
  const png = readFileSync('public/images/plane-hero.png');
  expect(png.readUInt32BE(16)).toBe(1600);
  expect(png.readUInt32BE(20)).toBe(900);
  expect(png[25]).toBe(6);                       // colour type RGBA
  expect(statSync('public/images/plane-hero.png').size).toBeLessThanOrEqual(500_000);
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/unit/planeImage.test.ts`
Expected: FAIL — no file.

- [ ] **Step 3: Implement; run `npm run capture:plane`; view the PNG (plane centred, clean alpha edges, night studio light)**

- [ ] **Step 4: Run tests**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src tools package.json public/images tests
git commit -m "feat: capture the hero plane picture from our own scene"
```

---

### Task 7: From picture to 3D

**Files:**
- Create: `src/ui/IntroPlane.tsx`, `tests/unit/introState.test.ts`, `tests/e2e/intro.spec.ts`
- Modify: `src/experience/introState.ts` (from Task 6), `src/experience/cameraPoses.ts` (the sky chapter holds `INTRO.swapPose` until the swap, then the door flight starts from it), `src/scene/aircraft/Aircraft.tsx` (hidden before the swap), `tests/unit/cameraPoses.test.ts`

**Interfaces:**
- Produces: `INTRO = { swapAt: 0.8, crossfade: 0.06, heroScale: 0.42, heroLift: 0.18, swapPose }` (fractions of the sky chapter; `swapPose` = the camera pose the picture was captured at); `introState(progress: number): { imageScale: number; imageY: number; imageOpacity: number; aircraftVisible: boolean }` — the picture starts small and high (hero), flies down and grows to scale 1 / y 0 exactly at `swapAt`, cross-fades out over `crossfade` while the 3D aircraft is shown from `swapAt − crossfade`; `IntroPlane` — the picture as a full-height, centred image (`height: 100vh; width: auto`) so it matches the 3D frame at any aspect.

- [ ] **Step 1: Write the failing tests**

```ts
test('the picture flies down and grows, matching the 3D frame at the swap', () => {
  const p = (t: number) => trackProgress('pre', 'sky', t);
  expect(introState(p(0))).toMatchObject({ imageScale: INTRO.heroScale, aircraftVisible: false, imageOpacity: 1 });
  expect(introState(p(INTRO.swapAt))).toMatchObject({ imageScale: 1, imageY: 0, aircraftVisible: true });
  expect(introState(p(INTRO.swapAt + INTRO.crossfade)).imageOpacity).toBe(0);
  for (let t = 0; t < INTRO.swapAt; t += 0.05) expect(introState(p(t + 0.05)).imageScale).toBeGreaterThanOrEqual(introState(p(t)).imageScale);
});
test('the camera holds the capture pose until the swap', () => {
  expect(poseOnPreTrack(trackProgress('pre', 'sky', 0.3)).position.equals(INTRO.swapPose.position)).toBe(true);
});
```
`intro.spec.ts`: at progress 0 the picture is visible and the `Aircraft` group invisible; screenshots just before and just after the swap differ by a mean of ≤ 10 levels over the plane's bounding box at 1440×800, 2100×900 and 412×915; resizing at the swap point keeps them aligned.

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run tests/unit/introState.test.ts tests/unit/cameraPoses.test.ts`, `npx playwright test tests/e2e/intro.spec.ts`
Expected: FAIL.

- [ ] **Step 3: Implement** (re-run `npm run capture:plane` if the swap pose changes; keep the pre-track continuity tests green)

- [ ] **Step 4: Run tests; watch the intro at three aspect ratios**

Run: `npm test && npm run e2e`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src tests public/images
git commit -m "feat: the hero picture flies down and becomes the live 3D plane"
```

---

### Task 8: Branded loader

**Files:**
- Create: `src/ui/Loader.tsx`, `src/ui/loader.module.css`, `tests/e2e/loader.spec.ts`
- Modify: `src/app/page.tsx` (server-rendered loader shell; `<link rel="preload" as="image" href="/images/plane-hero.png">`), `src/experience/store.ts` (`loadProgress`, `ready`, `setLoad`), `src/scene/Experience.tsx` (drei `useProgress` → store; `ready` after `CompileAsync` has shown the cabin and two frames have rendered), `src/content/copy.ts` (`loader.label: 'Preparing your night flight'`)

**Interfaces:**
- Produces: `#loader` (`role="progressbar"`, `aria-valuenow`) — the sun-over-horizon emblem drawn by an SVG stroke animation, a thin progress line, the plane picture fading in at its hero size and place (so the hero picks it up without a jump); fades out when `ready`.

- [ ] **Step 1: Write the failing test**

```ts
test('the loader paints first, shows progress and hands the plane picture to the hero', async ({ page }) => {
  await page.route('**/models/*.glb', async (r) => { await new Promise((f) => setTimeout(f, 1500)); await r.continue(); });
  await page.goto('/');
  await expect(page.locator('#loader')).toBeVisible();
  await expect.poll(async () => Number(await page.locator('#loader').getAttribute('aria-valuenow'))).toBeGreaterThan(0);
  await expect(page.locator('#loader')).toBeHidden({ timeout: 30_000 });
  // the intro picture's box before and after the hand-over differs by ≤ 2 px
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx playwright test tests/e2e/loader.spec.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test && npm run e2e`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src tests
git commit -m "feat: branded loader that hands the plane picture to the hero"
```

---

### Task 9: Outro and captions in the night style

**Files:**
- Modify: `src/ui/Outro.tsx`, `src/ui/ui.module.css`, `src/ui/Overlay.tsx`, `src/content/copy.ts`, `tests/e2e/journey.spec.ts` (only if a selector changes; pinned labels stay)

**Interfaces:**
- Produces: outro as a dark editorial page (display title "Have a nice flight", the form in the token style, the short How it's made block with a button opening the full panel, Start again); seated bar, pass bar and chapter captions restyled to the tokens.

- [ ] **Step 1: Write the failing test** — e2e: the outro's background is the token colour (computed style `rgb(7, 8, 11)` or a translucent panel over it) and its title uses the display font (computed `font-family` contains `Archivo`).
- [ ] **Step 2: Run it** — Expected: FAIL.
- [ ] **Step 3: Implement**
- [ ] **Step 4: Run** `npm test && npm run e2e` — Expected: PASS; view outro, seated and pass screenshots.
- [ ] **Step 5: Commit** — `git commit -m "feat: night-style outro, bars and captions"`

---

### Task 10: Frame rate, readability and review shots

**Files:**
- Modify: `tests/e2e/perf.spec.ts` (poses: showcase 0.05, door, aisle, seat, pass, exit; review set: loader, hero, intro-swap, door, entry, aisle, aisle-end, seat-1A, seat-14F, seat-30A, pass, exit, outro; each shot asserts luminance variance > 1 and, except the loader, a mean luminance ≥ 18 — the "not a black screen" guard)

- [ ] **Step 1: Extend the probe and shots**
- [ ] **Step 2: Run** `npx playwright test --project=perf --no-deps` — Expected: pass, or the failing medians.
- [ ] **Step 3: Optimise one lever at a time (cloud resolution, star density, glow sprite count, shadow-map size) until it passes; ledger each**
- [ ] **Step 4: View every shot; fix what does not read as a premium night flight**
- [ ] **Step 5: Commit** — `git commit -m "test: frame rate, readability and review shots for the night flight"`

---

## Spec coverage (r2)

| Spec | Where |
|------|-------|
| §2 night throughout, not a black screen | Tasks 1–3, 10 |
| §3 ch. 0 loader | Task 8 |
| §3 ch. 1 hero, ch. 2 picture → 3D | Tasks 5–7 |
| §4 header, nav gate, rail, footer, How it's made | Task 4 |
| §4 phones: menu, stacked notes, hidden rail | Tasks 4–5 (full phone pass in Plan 5) |
| §5 night sky, moonlit clouds, night aircraft | Tasks 1–2 |
| §6 night cabin | Task 3 |
| §3 ch. 7 dark finale | Task 9 |
| 45+ fps on integrated graphics | Task 10 |
