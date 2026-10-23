# AslanAir — Plan 4b: The Journey Before Boarding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Before the cabin, take the visitor on a short journey — a first screen whose title flies apart, a night globe where they pick a destination from Chișinău and watch the plane fly the arc, a transfer choice, and a "Ready to choose your seat?" moment — with one live 3D plane escorting them all the way, and both choices printed on the boarding pass.

**Architecture:** The pre-boarding track grows from `sky → door → aisle` to `sky → destinations → transfer → ready → door → aisle`. Two pure functions place everything per chapter: the camera (`poseOnPreTrack`, now taking the aspect ratio and a lens lift) and a new `aircraftStage` (position, rotation, scale of the one aircraft group). The live plane starts at the loader's hand-over: the hero framing is the capture camera zoomed and lens-shifted, so it lands on the loader's picture to the pixel and `IntroPlane`'s mid-scroll swap goes away. The globe is a 3D object in the same scene, shown only in its chapter; destination labels are DOM buttons projected onto it. Choices live in the store and feed the boarding pass.

**Tech Stack:** as in Plans 1–4 (Next 16, React 19, R3F 9, three 0.186, drei, zustand, GSAP/Lenis, Vitest, Playwright, Blender kit pipeline); new: `world-atlas` + `topojson-client` for the globe's land (see Task 5 — install only after the user approves the download).

**Spec:** `docs/superpowers/specs/2026-10-23-aslanair-design-r3-journey.md` (r3), on top of r2 (`…-design-r2-night.md`) and the base spec (`…-design.md`).

**Depends on:** Plan 4 merged into main (night flight, shell, loader, the fixes of 2026-10-23).

## Global Constraints

- Home is **Chișinău, Moldova — RMO** (IATA since 18.01.2024; ICAO LUKK). Every flight departs from it; the visitor chooses only the destination (r3 §4).
- The 14 destinations, regions and preliminary fares are r3 §4's table; **Lisbon (LIS) is preselected** ("tonight's pick"). Fares and seat prices stay separate — no total anywhere (r3 §4).
- Transfer options: `From home`, `From your hotel`, `Airport express`, `On my own`; default **On my own**; free; pick-up time counts back from departure; none for On my own (r3 §6).
- Destination and transfer can change until the seat is confirmed, then lock; **Start again** resets them to LIS / On my own (r3 §8).
- No chapter ever blocks the scroll; every choice has a default (r3 §2).
- The plane is one live 3D object from the loader's hand-over to the end; it never vanishes or jumps on screen between chapters (r3 §9).
- Effects (r3 §3.1): the hero title scatters into letters on scroll (and reassembles on the way back); one paragraph lights up word by word in the Ready chapter; tilted crossing ribbons pass at the seams sky→destinations, destinations→transfer, transfer→ready. **No** percentage loader, **no** HUD captions.
- DOM motion uses `transform` and `opacity` only (the compositor keeps it smooth while scripts load) — the lesson of 2026-10-23.
- The camera rides the scroll exactly on a track (`CameraRig`); glides only after a phase change.
- Night throughout; before the camera is inside the cabin the background stays the plain showcase dark; the globe is part of that dark scene; never a black screen (luminance guards).
- Light count constant; new effects change uniforms only.
- Frame-rate gate (perf project, integrated GPU, judged on a quiet GPU — `pid` of the user's Chrome ≤ 3 % on the 3D engine throughout): every pose median and mean ≤ 22.2 ms, the new chapters included.
- Phones (portrait) supported in every new chapter; destination by tap.
- Free assets only; English copy in `src/content/copy.ts`; pinned labels keep their wording; USD.
- Airliner GLB stays ≤ 120 000 triangles (no landing gear — the transfer plane does not stand on the ground, r3 §11).

## Review Focus

- **Scroll flung or a header/rail jump across the new chapters:** the plane is continuous on screen at every seam and never shows two poses in one frame — unit continuity tests on the projected aircraft box (Tasks 2, 4, 6, 7, 8) and an e2e jump test (Task 10).
- **A new destination picked while the plane is still flying to the last one:** the flight restarts from where the plane is, never teleports — unit test on the flight tween and an e2e double-click test (Task 6).
- **Resize or rotation in the globe chapter:** labels stay on their markers and stay clickable — e2e resize test (Task 6).
- **Keyboard-only and screen-reader visitors:** destinations and transfers are reachable and selectable without a pointer, and announce their state — e2e keyboard tests (Tasks 6, 7).
- **Choices after sitting, after confirming, after Start again:** seated → still changeable and the pass follows; confirmed → locked; Start again → LIS / On my own — store unit tests (Task 1) and an e2e path (Task 10).

---

## File Structure

```
src/experience/destinations.ts   NEW (pure): HOME, DESTINATIONS, SUGGESTED, TRANSFERS, pickupTime()
src/experience/store.ts          destinationId, transferId, chooseDestination(), chooseTransfer(); restart resets
src/experience/boardingPass.ts   boardingPassFor(seat, destination, transfer)
src/experience/chapters.ts       pre track: sky, destinations, transfer, ready, door, aisle (ranges from heights)
src/experience/cameraPoses.ts    poseOnPreTrack(progress, aspect?) with lens lift; poses for the new chapters
src/experience/stage.ts          NEW (pure): aircraftStage() — where the one aircraft group stands per chapter
src/experience/globe.ts          NEW (pure): latLonToVector, greatCircle, arcFlight(), globeTurnFor()
src/experience/introState.ts     keeps INTRO (picture, swap pose) and HERO_PICTURE; the picture's flight retires
src/scene/CameraRig.tsx          applies the lens lift (setViewOffset)
src/scene/aircraft/Aircraft.tsx  applies aircraftStage; always visible
src/scene/globe/Globe.tsx        NEW: night Earth (dotted land, city lights), home and destination markers, arcs
src/ui/Hero.tsx                  title split into letters that scatter; facts about AslanAir
src/ui/Destinations.tsx          NEW: projected destination labels (buttons), flight card
src/ui/Transfer.tsx              NEW: four transfer cards (radio group)
src/ui/Ready.tsx                 NEW: "Ready to choose your seat?", word-by-word paragraph, scroll cue
src/ui/Ribbons.tsx               NEW: crossing marquee ribbons at the seams
src/ui/IntroPlane.tsx            REMOVED (the loader hands over to the live plane)
src/scene/BoardingPass3D.tsx     pass drawn from the choices
src/experience/navState.ts, src/ui/Shell.tsx   Destinations and Transfer in the header and the rail
tests/unit: destinations, stage, globe (NEW); chapters, store, boardingPass, cameraPoses, navState, aircraftAnimation
tests/e2e: journey-choices.spec.ts (NEW), intro.spec.ts (rewritten), helpers.ts (pre()), perf.spec.ts
```

---

### Task 1: Destinations, choices and the pass data

**Files:**
- Create: `src/experience/destinations.ts`, `tests/unit/destinations.test.ts`
- Modify: `src/experience/store.ts`, `src/experience/boardingPass.ts`, `src/content/copy.ts`, `tests/unit/store.test.ts`, `tests/unit/boardingPass.test.ts`, `src/scene/BoardingPass3D.tsx` (call site only)

**Interfaces:**
- Produces:
  - `HOME = { code: 'RMO', city: 'Chișinău', country: 'Moldova', lat: 46.927, lon: 28.931 }`
  - `type Region = 'Europe' | 'Middle East' | 'Asia' | 'North America' | 'South America' | 'Africa'`
  - `interface Destination { code: string; city: string; country: string; region: Region; lat: number; lon: number; fareUsd: number; flight: string; departs: string }` — `flight` is `'AS '` + three digits (LIS keeps `'AS 270'`); `departs` is a night time `'HH:MM'` between 21:00 and 02:00
  - `DESTINATIONS: Destination[]` — exactly r3 §4's 14 cities, codes and fares; `SUGGESTED = 'LIS'`
  - `type TransferId = 'home' | 'hotel' | 'express' | 'own'`; `TRANSFERS: { id: TransferId; minutesBefore: number | null }[]` (home 180, hotel 150, express 120, own null); `DEFAULT_TRANSFER: TransferId = 'own'`; labels in `copy.transfer`
  - `pickupTime(departs: string, minutesBefore: number): string` (wraps past midnight)
  - store: `destinationId: string`, `transferId: TransferId`, `chooseDestination(code: string): boolean`, `chooseTransfer(id: TransferId): boolean` — accepted while `phase` is `browse` or `seated`, refused (false, no change) once `confirmed`/`thanks` or for an unknown id; `restart()` resets both
  - `boardingPassFor(seat: Seat, destination: Destination, transfer: TransferId): BoardingPassData` — `from` RMO/Chișinău, `to` the destination, its `flight`, `boarding` = departs − 40 min, new `transfer: { label: string; pickup: string | null }`

- [ ] **Step 1: Write the failing tests**

```ts
test('fourteen destinations on five continents, home not among them', () => {
  expect(DESTINATIONS).toHaveLength(14);
  expect(new Set(DESTINATIONS.map((d) => d.code)).size).toBe(14);
  expect(DESTINATIONS.map((d) => d.code)).not.toContain('RMO');
  expect(new Set(DESTINATIONS.map((d) => d.region))).toEqual(new Set(['Europe', 'Middle East', 'Asia', 'North America', 'South America', 'Africa']));
  expect(DESTINATIONS.find((d) => d.code === SUGGESTED)!.flight).toBe('AS 270');
});
test('every flight leaves at night', () => { /* each departs ≥ 21:00 or ≤ 02:00 */ });
test('pick-up counts back from departure, past midnight too', () => {
  expect(pickupTime('22:40', 180)).toBe('19:40');
  expect(pickupTime('00:30', 180)).toBe('21:30');
});
test('choices change until the seat is confirmed, then lock; Start again resets them', () => {
  expect(s().destinationId).toBe('LIS'); expect(s().transferId).toBe('own');
  expect(s().chooseDestination('HND')).toBe(true);
  s().setProgress(0.95); s().sit(freeSeatId); expect(s().chooseTransfer('home')).toBe(true);   // seated: still open
  s().confirm(); expect(s().chooseDestination('JFK')).toBe(false); expect(s().destinationId).toBe('HND');
  expect(s().chooseDestination('XXX')).toBe(false);
  s().restart(); expect([s().destinationId, s().transferId]).toEqual(['LIS', 'own']);
});
test('the pass carries the route, the flight and the transfer', () => {
  const d = DESTINATIONS.find((x) => x.code === 'HND')!;
  const pass = boardingPassFor(seat, d, 'home');
  expect(pass.from.code).toBe('RMO'); expect(pass.to).toEqual({ code: 'HND', city: 'Tokyo' });
  expect(pass.flight).toBe(d.flight); expect(pass.transfer).toEqual({ label: 'From home', pickup: pickupTime(d.departs, 180) });
  expect(boardingPassFor(seat, d, 'own').transfer.pickup).toBeNull();
});
```

- [ ] **Step 2: Run them to verify they fail** — `npx vitest run tests/unit/destinations.test.ts tests/unit/store.test.ts tests/unit/boardingPass.test.ts` — Expected: FAIL (module missing).
- [ ] **Step 3: Implement** (BoardingPass3D passes the store's current choices; drawing changes come in Task 10).
- [ ] **Step 4: Run** `npm test` — Expected: PASS.
- [ ] **Step 5: Commit** — `git commit -m "feat: destinations from Chișinău, transfers, and choices in the store and on the pass data"`

---

### Task 2: The journey's chapters

**Files:**
- Modify: `src/experience/chapters.ts`, every consumer of chapter ids (`aircraftAnimation.ts`, `worldState.ts`, `cloudDetail.ts`, `cameraPoses.ts`, `navState.ts`, `src/ui/Hero.tsx`, `src/ui/Overlay.tsx`), `tests/e2e/helpers.ts`, every unit and e2e test that uses a raw pre-track progress number (15× `setProgress(0.6)`, `0.05`, `0.3`, `0.36`, `0.42` in `aircraft`, `cabin`, `camera`, `journey`, `night`, `perf`, `shell` specs; post-track numbers stay)
- Test: `tests/unit/chapters.test.ts`, `tests/unit/cameraPoses.test.ts`

**Interfaces:**
- Produces: `ChapterId` adds `'destinations' | 'transfer' | 'ready'`; pre track in order `sky 110vh, destinations 170vh, transfer 110vh, ready 130vh, door 125vh, aisle 275vh`; `TRACKS` ranges are derived from the heights (start/end = cumulative share) so a height change never desynchronises them; e2e helper `pre(id: ChapterId, t: number): number` (= `trackProgress('pre', id, t)`).
- Until Tasks 4–8 fill them, the three new chapters hold the camera at the sky chapter's end pose and the aircraft at the origin (continuity tests stay green).

- [ ] **Step 1: Write the failing tests** — `chapters.test`: the pre track's ids in that order; ranges contiguous from 0 to 1 and proportional to the heights; post track unchanged. `cameraPoses.test`: the pre-track continuity loop covers every pre seam (`for (const r of TRACKS.pre.slice(1)) close(pose(r.start − ε), pose(r.start))`).
- [ ] **Step 2: Run** `npx vitest run tests/unit/chapters.test.ts tests/unit/cameraPoses.test.ts` — Expected: FAIL.
- [ ] **Step 3: Implement; migrate every raw pre-track number in the tests to `pre(id, t)` with the same meaning** (`0.6` → `pre('aisle', 0.27)`, `0.05` → `pre('sky', 0.25)`, `0.3` → `pre('door', 0.4)`, `0.36` → `pre('door', 0.64)`, `0.42` → `pre('door', 0.88)`, `1` stays).
- [ ] **Step 4: Run** `npm test && npx playwright test --project=chromium` — Expected: PASS (the same 74 + new unit tests).
- [ ] **Step 5: Commit** — `git commit -m "feat: the pre-boarding track gains destinations, transfer and ready chapters"`

---

### Task 3: The live plane from the first screen

**Files:**
- Modify: `src/experience/cameraPoses.ts` (`CameraPose.lift?: number`; hero pose), `src/scene/CameraRig.tsx`, `src/scene/aircraft/Aircraft.tsx` (no intro hiding), `src/experience/introState.ts` (retire `introState()`; keep `INTRO`, `HERO_PICTURE`), `src/scene/Experience.tsx`, `src/ui/Loader.tsx` (fades over the live plane)
- Remove: `src/ui/IntroPlane.tsx`, `src/ui/introPlane.module.css`
- Test: `tests/unit/cameraPoses.test.ts`, `tests/e2e/intro.spec.ts` (rewritten)

**Interfaces:**
- Consumes: `INTRO.swapPose`, `HERO_PICTURE` (Plan 4)
- Produces: `CameraPose.lift` — the frame's centre moves up by `lift` frame heights (a lens shift; `CameraRig` applies it with `camera.setViewOffset`); `poseOnPreTrack(progress, aspect = 16 / 9)`: at sky t = 0 the camera is `INTRO.swapPose` with `fov = 2·atan(tan(15°) / heroScale(aspect))` and `lift = HERO_PICTURE.lift` — exactly the loader's picture, scaled and lifted. `heroScale(aspect)` is exported from `introState.ts`.

- [ ] **Step 1: Write the failing tests** — unit: projecting the swap pose's eight plane-box corners (from `INTRO.picture.plane`) through the hero pose lands them inside the loader's picture box at 16:9, 21:9 and 412×915 within 1 % of the frame. e2e `intro.spec`: with the models held back, screenshot the loader's picture; after `ready`, screenshot the live plane: mean difference ≤ 10 levels over the plane box at 1440×800, 2100×900 and 412×915; the aircraft group is visible at the top of the page; there is no `[data-testid=intro-plane]`.
- [ ] **Step 2: Run** them — Expected: FAIL.
- [ ] **Step 3: Implement** (re-run `npm run capture:plane` only if the swap pose changes; it should not).
- [ ] **Step 4: Run** `npm test && npx playwright test --project=chromium` — Expected: PASS.
- [ ] **Step 5: Commit** — `git commit -m "feat: the live plane takes over from the loader's picture at the hero"`

---

### Task 4: First screen — the plane crosses, the title scatters

**Files:**
- Create: `src/experience/stage.ts`, `tests/unit/stage.test.ts`
- Modify: `src/scene/aircraft/Aircraft.tsx` (applies the stage, composed with the fly-away), `src/experience/cameraPoses.ts` (sky chapter), `src/ui/Hero.tsx`, `src/ui/hero.module.css`, `src/content/copy.ts` (facts about AslanAir: `From Chișinău · RMO`, `14 destinations · 5 continents`, `Fares from $X` with X = the lowest fare)
- Test: `tests/e2e/shell.spec.ts`

**Interfaces:**
- Produces: `aircraftStage(phase: Phase, progress: number, onGlobe?: { position: Vector3; heading: Vector3 }): { position: Vector3; rotation: Euler; scale: number }` — `onGlobe` is the plane's current point over the globe (Task 6 computes it with `flightAt`; the stage stays independent of `globe.ts`); identity at sky t = 0 and from the door chapter on; in the sky chapter the plane banks (≤ 25°) and crosses the frame diagonally, leaving it by sky t = 1; `projectedBox(stage, pose, aspect): { x0, y0, x1, y1 }` (normalised screen box of the aircraft) for continuity tests.
- Hero: the title is one `<h1>` whose letters are `<span aria-hidden>` children with a visually hidden full text for assistive tech; each letter's scatter vector is deterministic (seeded by its index); scatter amount = smoothstep(sky t, 0.1, 0.7); transform and opacity only.

- [ ] **Step 1: Write the failing tests** — unit: stage identity at sky t 0 and in door/aisle; the projected box moves at most 3 % of the frame per 1 % of progress across the sky chapter and its seam to destinations; by sky t 1 the box is out of frame or handed to Task 5's pose (shared seam test). e2e: at the top every letter sits in place (transform none/identity); at sky t 0.5 every letter has moved; scrolling back to the top restores them; the heading's accessible name is still "Night flight"; the letters' animations use transform/opacity only.
- [ ] **Step 2: Run** — Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `npm test && npx playwright test --project=chromium` — Expected: PASS; view the first screen at 1440×800 and 412×915 at sky t 0, 0.4, 0.8.
- [ ] **Step 5: Commit** — `git commit -m "feat: on the first screen the plane banks across and the title flies apart"`

---

### Task 5: The night globe

**Files:**
- Create: `src/experience/globe.ts`, `tests/unit/globe.test.ts`, `src/scene/globe/Globe.tsx`, `src/experience/cities.ts` (≈150 large cities' lat/lon for the night lights, written by hand from general knowledge — no download)
- Modify: `package.json` (dependencies), `src/scene/Experience.tsx`, `src/experience/cameraPoses.ts` (destinations chapter pose)

**Interfaces:**
- Produces: `type LatLon = { lat: number; lon: number }`; `GLOBE = { radius: number; center: Vector3 }` (its own space, away from the aircraft's origin; the implementer picks the numbers, the camera frames the globe at ≈ 60 % of the frame height); `latLonToVector(lat: number, lon: number, radius?: number): Vector3`; `greatCircle(a: LatLon, b: LatLon, n: number): Vector3[]` (on the sphere) and `arcPoints(a, b, n): Vector3[]` (lifted: peak height ∝ distance); `globeTurnFor(a: LatLon, b: LatLon): Quaternion` — the globe's rotation that puts the whole arc on the visible hemisphere, centred.
- Globe look: dark sphere, land as fine dots (from a land mask rasterised at runtime from `world-atlas` 110m `land` + `topojson-client`), warm city-light points from `cities.ts`, home (RMO) marker in terracotta, destination markers in warm white; additive glow sprites; showcase light only; visible only from the sky→destinations seam to the destinations→transfer seam.

- [ ] **Step 0: Ask the user to approve the download** of `world-atlas@2.0.2` (Natural Earth 1:110m, public domain, ≈ 110 KB) and `topojson-client@3.1.0` (ISC, ≈ 20 KB) via `npm install`. If declined: the land mask comes from a hand-made low-poly continent outline in `cities.ts`' module (ruling).
- [ ] **Step 1: Write the failing tests** — unit: `latLonToVector(0, 0)` on +x… (pin the convention in the test), RMO and LIS at the right great-circle distance (≈ 2 760 km on a 6 371 km sphere, ±1 %); `arcPoints` starts and ends on the markers and peaks mid-way; for every destination `globeTurnFor(HOME, d)` leaves every arc point facing the camera (dot > 0.1). e2e (in `journey-choices.spec.ts`): the globe is hidden on the first screen's top and in the aisle, visible mid-destinations; 15 markers (home + 14).
- [ ] **Step 2: Run** — Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `npm test && npx playwright test --project=chromium` — Expected: PASS; view the globe chapter.
- [ ] **Step 5: Commit** — `git commit -m "feat: a night globe of AslanAir's destinations"`

---

### Task 6: Choosing a destination — arc, flight, card

**Files:**
- Create: `src/ui/Destinations.tsx`, `src/ui/destinations.module.css`, `tests/e2e/journey-choices.spec.ts`
- Modify: `src/experience/globe.ts` (`ArcFlight`, `flightAt()`), `src/experience/stage.ts` (destinations chapter), `src/scene/globe/Globe.tsx` (arc drawing, globe turn), `src/scene/aircraft/Aircraft.tsx`, `src/content/copy.ts`

**Interfaces:**
- Produces: `type LatLon = { lat: number; lon: number }` (in `globe.ts`, Task 5 — `Destination` and `HOME` satisfy it); `interface ArcFlight { from: Vector3; to: LatLon; startedAt: number }`; `flightAt(flight: ArcFlight, now: number): { position: Vector3; heading: Vector3; done: boolean }` — 1.6 s eased flight along the arc, starting from `from` (wherever the plane was when the visitor chose: a re-pick mid-flight starts there); its sample is passed to `aircraftStage` as `onGlobe`; the plane in this chapter is the aircraft group at small scale (≈ 6 % of the globe's diameter long) over the globe, waiting over RMO until a flight, nose along the heading.
- Labels: one `<button>` per destination, absolutely positioned at its marker's projected screen point each frame (hidden when the marker faces away), text `LIS · from $129`, `aria-pressed` for the chosen one; hover/focus highlights the marker; click/tap/Enter calls `chooseDestination` and starts a flight; the globe eases to `globeTurnFor(HOME, chosen)`. Flight card (DOM): city, code, flight, departure, `from $fare`.
- The preselected LIS shows its arc and card from the chapter's start, the plane already over Lisbon (no flight until the visitor picks).

- [ ] **Step 1: Write the failing tests** — unit: `flightAt` at 0 = `from`, at ≥ 1.6 s = the destination marker + cruise height, heading tangent to the arc; a flight whose `from` is a mid-arc point never passes through RMO. e2e: in the chapter, click `Tokyo` → store `HND`, card shows `Tokyo · HND · AS …`, the plane's world position reaches Tokyo's marker within 2.2 s; click `New York` then `Rome` 0.4 s apart → the plane's path between the clicks has no step > 5 % of the globe radius per frame; Tab to a label and Enter selects it (`aria-pressed`); resize to 1000×800 → every visible label's centre within 12 px of its marker's projection, and still clickable.
- [ ] **Step 2: Run** — Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `npm test && npx playwright test --project=chromium` — Expected: PASS; view a short and a long-haul pick.
- [ ] **Step 5: Commit** — `git commit -m "feat: pick a destination — the arc draws and the plane flies it"`

---

### Task 7: Transfer

**Files:**
- Create: `src/ui/Transfer.tsx`, `src/ui/transfer.module.css`
- Modify: `src/experience/stage.ts`, `src/experience/cameraPoses.ts` (transfer chapter), `src/content/copy.ts`, `tests/e2e/journey-choices.spec.ts`

**Interfaces:**
- Produces: four cards in a `role="radiogroup"` (`role="radio"`, `aria-checked`, arrow keys move, Space/Enter choose), each with an icon (inline SVG, drawn for this site) and a short line; `chooseTransfer` on choice; On my own checked by default. The plane "waits": in the dark showcase scene, smaller than in the hero and beside the cards, a slow idle turn (≤ 8°/s), windows lit; no ground (r3 §11).

- [ ] **Step 1: Write the failing tests** — unit: the stage across destinations→transfer and transfer→ready seams is continuous (projected box test). e2e: On my own is checked at first; click From home → store `home` and `aria-checked`; ArrowRight moves the choice; the cards never overlap the plane's projected box at 1440×800 and stack readably at 412×915.
- [ ] **Step 2: Run** — Expected: FAIL. **Step 3: Implement.** **Step 4: Run** `npm test && npx playwright test --project=chromium` — Expected: PASS.
- [ ] **Step 5: Commit** — `git commit -m "feat: choose how to get to the airport"`

---

### Task 8: Ready to choose your seat?

**Files:**
- Create: `src/ui/Ready.tsx`, `src/ui/ready.module.css`
- Modify: `src/experience/stage.ts`, `src/experience/cameraPoses.ts` (ready chapter; its end is the door flight's start), `src/experience/aircraftAnimation.ts` (door ajar in the ready chapter), `src/scene/aircraft/Aircraft.tsx` (warm glow in the doorway), `src/content/copy.ts`

**Interfaces:**
- Produces: the phrase "Ready to choose your seat?", a paragraph whose words light up from a faint outline to full ink by ready t (each word's opacity = smoothstep over its own slice of t; `<span>` per word, transform/opacity only), the shared `ScrollCue` "Scroll to board"; the plane turns to face the camera over the chapter; `doorOpenAmount` rises to 0.15 in the ready chapter and continues from there in the door chapter (continuous); a warm glow (emissive quad or sprite in the doorway, uniform-driven) grows with it.

- [ ] **Step 1: Write the failing tests** — unit: `doorOpenAmount` continuous across ready→door; pose and stage continuous across ready→door (the door flight starts where the ready chapter ends). e2e: lit words increase monotonically over ready t 0.1 → 0.9 and all are lit by t 0.95; animations transform/opacity only; the doorway glow is visible (luminance in the door's projected box > its surroundings by ≥ 20 levels at ready t 0.9).
- [ ] **Step 2: Run** — Expected: FAIL. **Step 3: Implement.** **Step 4: Run** `npm test && npx playwright test --project=chromium` — Expected: PASS.
- [ ] **Step 5: Commit** — `git commit -m "feat: ready to choose your seat — the door glows, the promise lights up word by word"`

---

### Task 9: Ribbons at the seams

**Files:**
- Create: `src/ui/Ribbons.tsx`, `src/ui/ribbons.module.css`
- Modify: `src/scene/Experience.tsx`, `src/content/copy.ts`

**Interfaces:**
- Produces: two ribbons crossing at ±4° (terracotta with ink text, navy with ink text), each a marquee of short flight phrases (`RMO → 14 DESTINATIONS`, `NIGHT FLIGHT`, the chosen route once picked), passing over the screen in a window of ±0.04 progress around each of the three seams: they slide in from opposite sides as the seam nears and out as it passes (scroll-driven `transform`); the marquee itself runs on the compositor (infinite `transform` animation); `pointer-events: none`; static under reduced motion.

- [ ] **Step 1: Write the failing tests** — e2e: ribbons hidden at sky t 0.3, destinations t 0.5, transfer t 0.5; visible at each seam; their animations use transform only; with `prefers-reduced-motion` the marquee does not run.
- [ ] **Step 2: Run** — Expected: FAIL. **Step 3: Implement.** **Step 4: Run** `npm test && npx playwright test --project=chromium` — Expected: PASS.
- [ ] **Step 5: Commit** — `git commit -m "feat: ribbons sweep across the seams of the journey"`

---

### Task 10: The pass and the shell follow the choices

**Files:**
- Modify: `src/scene/BoardingPass3D.tsx` (front: RMO → code, cities, flight, boarding time, new Transfer field; redraws when choices change), `src/experience/navState.ts`, `src/ui/Shell.tsx`, `src/content/copy.ts`, `tests/unit/navState.test.ts`, `tests/e2e/journey-choices.spec.ts`

**Interfaces:**
- Produces: header items `Flight, Destinations, Transfer, Cabin, Your seat, Boarding pass, How it's made`; rail `Flight, Destinations, Transfer, Boarding, Cabin, Your seat, Take-off` (Boarding = the ready chapter); before confirmation Destinations/Transfer jump to their chapters; after confirmation they are disabled like Flight/Cabin; the seated `stay` rule stands.

- [ ] **Step 1: Write the failing tests** — unit navState: the new items' targets and gates. e2e: pick Tokyo and From home, sit, confirm → the pass texture's source data shows `RMO → HND`, Tokyo's flight and `From home · <pick-up>`; after confirming, the header's Destinations is disabled; Start again → store LIS/own and the first screen; a header jump from the aisle to Destinations and back leaves the plane on screen every frame (projected box never empty during the jump).
- [ ] **Step 2: Run** — Expected: FAIL. **Step 3: Implement.** **Step 4: Run** `npm test && npx playwright test --project=chromium` — Expected: PASS.
- [ ] **Step 5: Commit** — `git commit -m "feat: the boarding pass and the navigation follow the visitor's choices"`

---

### Task 11: Phones, frame rate and review shots

**Files:**
- Modify: `tests/e2e/perf.spec.ts` (poses: first screen mid, destinations with a flight in progress, transfer, ready; review set adds them), any component the phone pass shows wrong

- [ ] **Step 1: Extend the probe and the review set** (each new shot passes the not-a-black-screen guard; showcase shots judged on the plane's or the globe's box).
- [ ] **Step 2: Run** `npx playwright test --project=perf --no-deps` on a quiet GPU — Expected: pass, or the failing medians.
- [ ] **Step 3: Levers, one at a time, chosen with WebGL timer queries** (globe dot count, glow sprite count, label update cadence, cloud scale where the sky shows) until it passes; ledger each.
- [ ] **Step 4: Phone pass at 412×915** — every new chapter readable, nothing overflows, destination by tap; fix what fails with a test.
- [ ] **Step 5: View every shot; fix what does not read as a premium night journey.**
- [ ] **Step 6: Commit** — `git commit -m "test: frame rate, phones and review shots for the journey"`

---

## Spec coverage (r3)

| Spec | Where |
|------|-------|
| §2 journey before boarding, choices with consequences, no blocking | Tasks 1, 2, 6, 7 |
| §3 chapters 0–4, plane per chapter | Tasks 2–8 |
| §3.1 letters scatter, word-by-word, ribbons; no HUD/percent | Tasks 4, 8, 9 |
| §4 RMO home, 14 destinations, fares separate, LIS preselected | Tasks 1, 6 |
| §5 night globe, option A flight, turn to fit, hover/tap, card, re-pick | Tasks 5, 6 |
| §6 transfer options, default, pick-up time, free | Tasks 1, 7, 10 |
| §7 pass: route, flight, time, transfer | Tasks 1, 10 |
| §8 shell chapters, lock after confirm, Start again resets | Tasks 1, 10 |
| §9 live plane from the first screen, continuous | Tasks 3, 4, 6–8, 10 |
| §10 unchanged: 45 fps iGPU, phones, free assets | Tasks 5, 11 |
