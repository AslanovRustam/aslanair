# AslanAir — Plan 1: End-to-End Skeleton Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A working Next.js site where scrolling carries a first-person camera through every chapter of the AslanAir story — sky → door → aisle → seated → boarding pass → exit through the window → outro form — rough but complete.

**Architecture:** One fixed full-screen R3F `<Canvas>` holds the whole world (aircraft GLB, a placeholder cabin inside the fuselage, raymarched clouds as the scene background). A zustand store is the single source of truth (phase, seats, scroll progress). Pure TypeScript modules compute seat data, chapter ranges and camera poses; React components only read the store and render. Lenis + GSAP ScrollTrigger turn page scroll into a 0..1 progress on one of two scroll "tracks" (before and after the seat is confirmed).

**Tech Stack:** Next.js 16.4.2 (App Router, TypeScript), React 19.3.1, three 0.186.1, @react-three/fiber 9.8.2, @react-three/drei 10.7.9, maath 0.10.8, gsap 3.15.0, lenis 1.3.27, zustand 5.0.16, Vitest 5.0.5, Playwright 1.64.1, TypeScript 5.9.3.

**Spec:** `docs/superpowers/specs/2026-10-22-aslanair-design.md`

**Roadmap (later plans, written when this one ships):**
- Plan 2 — Aircraft asset v3 (Blender): door 1L as a separate opening object, real window openings, AslanAir lettering, GLB compression, export script.
- Plan 3 — Realistic cabin: panels with window reveals, bins, ceiling lights, entry/galley area, signs, realistic seat model and materials, headrest covers.
- Plan 4 — Polish: sound with mute, drag-to-flip boarding pass, seat lock animation, mobile quality tiers, branded loader, `prefers-reduced-motion`, final copy, Vercel deploy.

## Global Constraints

- Site language is English; prices are in USD.
- Brand name is written `AslanAir`. The airline is fictional; a "concept" disclaimer is visible in the outro and in the footer.
- Livery/UI colours: navy `#1b2541`, terracotta `#d4683a`, teal (free seat) `#3aa6a0`.
- Seat states: free = teal `#3aa6a0`; extra legroom = terracotta `#d4683a`; occupied = no colour, not clickable; selected = navy `#1b2541` with an accent outline.
- The final form is visual only: it never sends data anywhere.
- Free assets only (the aircraft comes from `tools/blender/airliner.py`).
- WebGL2 is required; without it the site shows a fallback message.
- Camera never jumps: every change of pose is damped/animated.
- Pinned versions as in Tech Stack; React must stay `<19.4` (R3F peer range).
- All user-facing strings live in `src/content/copy.ts`. Wording is the implementer's, except these labels, which the e2e tests pin: buttons "Pick for me", "Choose this seat", "See another", "Change seat", "Buy", "Start again"; the no-WebGL fallback mentions "WebGL2"; the thank-you text contains the word "concept"; form inputs are labelled "Name", "E-mail", "Comment".

## Review Focus

- Resizing the window or rotating a phone mid-experience → canvas and cloud render targets resize, no stretching (test in Task 7).
- Reloading the page halfway down → the experience restarts cleanly at the sky, not at a random camera pose (test in Task 7).
- No WebGL2 → a readable fallback instead of a blank page (test in Task 7).
- Clicking "Pick for me" while the scroll still has momentum → the scroll stops at once and progress does not drift while seated (test in Task 9).
- Keyboard-only visitor → the overlay buttons work with Tab/Enter (test in Task 9).

---

## File Structure

```
package.json, next.config.ts, tsconfig.json, vitest.config.ts, playwright.config.ts, .gitignore
public/models/airliner.glb                 copied from the spike (airliner-v2.glb)
tools/blender/airliner.py                  moved from .superpowers/blender/
src/app/layout.tsx, src/app/page.tsx, src/app/globals.css
src/content/copy.ts                        every English string
src/experience/geometry.ts                 aircraft/cabin constants + coordinate helpers (pure)
src/experience/seats.ts                    seat map, labels, prices, recommendation, visual state (pure)
src/experience/chapters.ts                 scroll tracks and chapter lookup (pure)
src/experience/cameraPoses.ts              camera poses per track + aircraft fly-away (pure, three math only)
src/experience/boardingPass.ts             boarding pass data (pure)
src/experience/store.ts                    zustand store (phase machine)
src/scroll/SmoothScroll.tsx                Lenis + ScrollTrigger, track sections, progress → store
src/scene/Experience.tsx                   <Canvas> root + WebGL2 check + test hooks
src/scene/sky/noise3d.ts                   bakeNoise3D (pure)
src/scene/sky/shaders.ts                   GLSL ported from the v4 spike
src/scene/sky/SkyAndClouds.tsx             cloud pass, blur, background, environment, sun light
src/scene/aircraft/Aircraft.tsx            GLB, idle motion, fly-away
src/scene/cabin/CabinShell.tsx             placeholder walls/floor/ceiling with window cut-outs
src/scene/cabin/Seats.tsx                  instanced seats + headrest covers + pointer events
src/scene/CameraRig.tsx                    pose → damped camera
src/scene/BoardingPass3D.tsx               card with canvas textures, flip on click
src/ui/Overlay.tsx, src/ui/Outro.tsx, src/ui/ui.module.css
src/dev/testHooks.ts                       window.__aslan in non-production builds
tests/unit/*.test.ts, tests/e2e/*.spec.ts
```

Coordinate convention used everywhere (three.js, Y up): the GLB nose points to **+X**; fuselage station `s` (metres from the nose) maps to `x = 18.8 - s`; the aircraft's left (port) side is **−Z**; seats A–C are on −Z, D–F on +Z.

---

### Task 1: Scaffold, tooling and a smoke test

**Files:**
- Create: Next.js app at the repo root, `vitest.config.ts`, `playwright.config.ts`, `tests/e2e/smoke.spec.ts`, `tests/unit/sanity.test.ts`
- Move: `.superpowers/blender/airliner.py` → `tools/blender/airliner.py`
- Copy: `.superpowers/brainstorm/44-1792652677/content/airliner-v2.glb` → `public/models/airliner.glb`

**Interfaces:**
- Produces: `npm run dev` (port 3000), `npm test` (Vitest, `tests/unit`), `npm run e2e` (Playwright, `tests/e2e`, starts `npm run dev -- -p 3100`), path alias `@/*` → `src/*`.

- [ ] **Step 1: Initialise git and the app**

```bash
cd D:/projects/clickable/AI/3d_site
git init
npx create-next-app@16.4.2 _scaffold --ts --app --eslint --src-dir --import-alias "@/*" --no-tailwind --use-npm --yes
# move everything from _scaffold (including dotfiles) to the repo root, then remove _scaffold
```
Append `.superpowers/`, `test-results/`, `playwright-report/` to `.gitignore`.

- [ ] **Step 2: Pin dependencies**

```bash
npm i next@16.4.2 react@19.3.1 react-dom@19.3.1 three@0.186.1 @react-three/fiber@9.8.2 @react-three/drei@10.7.9 maath@0.10.8 gsap@3.15.0 lenis@1.3.27 zustand@5.0.16
npm i -D typescript@5.9.3 @types/three@0.186.0 vitest@5.0.5 @playwright/test@1.64.1
npx playwright install chromium
```
Add scripts `"test": "vitest run"`, `"e2e": "playwright test"`. `vitest.config.ts`: environment `node`, include `tests/unit/**/*.test.ts`, alias `@` → `src`. `playwright.config.ts`: `testDir: 'tests/e2e'`, `webServer: { command: 'npm run dev -- -p 3100', port: 3100, reuseExistingServer: true, timeout: 120000 }`, `use.baseURL: 'http://localhost:3100'`, project chromium, viewport 1440×800.

- [ ] **Step 3: Write the failing smoke test** — `tests/e2e/smoke.spec.ts`

```ts
test('home renders a WebGL canvas without console errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto('/');
  await expect(page.locator('canvas')).toBeVisible();
  expect(errors).toEqual([]);
});
```
Plus `tests/unit/sanity.test.ts` asserting `1 + 1 === 2` so Vitest has a target.

- [ ] **Step 4: Run it — expect FAIL** (`npm run e2e` → no canvas on the default Next page)

- [ ] **Step 5: Minimal page** — `src/app/page.tsx` renders a client `<Canvas>` (dynamic import, `ssr: false`) filling the viewport with a black background; `globals.css` resets margins, `html, body { background: #000 }`. Move the Blender script and copy the GLB.

- [ ] **Step 6: Run `npm test` and `npm run e2e` — expect PASS**

- [ ] **Step 7: Commit** — include the spec and plan docs under `docs/`

```bash
git add -A && git commit -m "chore: scaffold Next.js + R3F app, tooling, smoke test"
```

---

### Task 2: Aircraft and cabin geometry constants

**Files:**
- Create: `src/experience/geometry.ts`, `tests/unit/geometry.test.ts`

**Interfaces:**
- Produces:
  - `FUSELAGE_LENGTH = 37.6`; `stationToX(s: number): number` (= 18.8 − s)
  - `FLOOR_Y = -0.45`, `EYE_STANDING = 1.2`, `EYE_SEATED = 0.7`, `CEILING_Y = 1.75`, `CABIN_WALL_Z = 1.8`
  - `ROWS = 30`, `FIRST_ROW_STATION = 7.3`, `ROW_PITCH = 0.78`; `rowStation(row: number): number`; `rowX(row: number): number`
  - `type SeatLetter = 'A'|'B'|'C'|'D'|'E'|'F'`; `SEAT_LETTERS: SeatLetter[]`; `SEAT_Z: Record<SeatLetter, number>` = A −1.42, B −0.94, C −0.46, D 0.46, E 0.94, F 1.42; `sideOf(letter): -1 | 1`
  - `WINDOW = { y: 0.62, firstStation: 6.55, pitch: 0.533, lastStation: 29.0, w: 0.23, h: 0.33 }`; `windowStations(): number[]`; `nearestWindowStation(s: number): number`
  - `DOOR_1L = { station: 4.9, y: 0.05, width: 0.82, height: 1.86, side: -1 }`
  - `seatWorldPosition(row: number, letter: SeatLetter): [number, number, number]` → `[rowX(row), FLOOR_Y, SEAT_Z[letter]]`

These values mirror `tools/blender/airliner.py` (window pitch/start/end and door station come from `paint_livery`).

- [ ] **Step 1: Write the failing tests**

```ts
expect(stationToX(0)).toBe(18.8);
expect(stationToX(37.6)).toBeCloseTo(-18.8);
expect(rowStation(1)).toBe(7.3);
expect(rowStation(30)).toBeCloseTo(29.92);
expect(windowStations()).toHaveLength(43);
expect(windowStations()[0]).toBe(6.55);
expect(nearestWindowStation(16.0)).toBeCloseTo(16.144, 3);
expect(sideOf('A')).toBe(-1); expect(sideOf('F')).toBe(1);
expect(seatWorldPosition(1, 'A')).toEqual([11.5, -0.45, -1.42]);
```

- [ ] **Step 2: Run `npx vitest run tests/unit/geometry.test.ts` — expect FAIL (module missing)**
- [ ] **Step 3: Implement `src/experience/geometry.ts`** (window centres are `firstStation + k·pitch` while `< lastStation`)
- [ ] **Step 4: Run — expect PASS**
- [ ] **Step 5: Commit** — `feat: aircraft and cabin geometry constants`

---

### Task 3: Seat map, prices and recommendations

**Files:**
- Create: `src/experience/seats.ts`, `tests/unit/seats.test.ts`

**Interfaces:**
- Consumes: `ROWS`, `SEAT_LETTERS`, `SeatLetter` from Task 2.
- Produces:
  - `type SeatPosition = 'window' | 'middle' | 'aisle'` (A/F window, B/E middle, C/D aisle)
  - `interface Seat { id: string; row: number; letter: SeatLetter; position: SeatPosition; extraLegroom: boolean; status: 'free' | 'occupied'; priceUsd: number }`
  - `EXTRA_LEGROOM_ROWS = [1, 12, 13]`; `PRICE_USD = { window: 29, aisle: 25, middle: 15, extraLegroom: 40 }`
  - `generateSeatMap(seed = 270): Seat[]` — 180 seats, row-major `1A…30F`; occupied when a mulberry32 draw `< 0.42`; afterwards, if no window seat in rows 9–18 is free, set `14A` free
  - `seatLabel(seat: Seat): string` → `"14C · Aisle · $25"`, `"12A · Window · Extra legroom · $69"`
  - `pickRecommendedSeat(seats: Seat[]): Seat` — free window seat in rows 9–18 closest to row 14; ties → lower row, then A before F
  - `type SeatVisual = 'free' | 'extra' | 'occupied' | 'hovered' | 'selected'`; `seatVisual(seat, hoveredId: string | null, selectedId: string | null): SeatVisual` (selected beats hovered; hovered only for free seats)
  - `SEAT_COLORS: Record<SeatVisual, string>` = free `#3aa6a0`, extra `#d4683a`, occupied `#b9bec6`, hovered `#6fd3cc`, selected `#1b2541`

- [ ] **Step 1: Write the failing tests**

```ts
const seats = generateSeatMap();
expect(seats).toHaveLength(180);
expect(seats[0].id).toBe('1A'); expect(seats[179].id).toBe('30F');
expect(new Set(seats.map((s) => s.id)).size).toBe(180);
expect(generateSeatMap()).toEqual(seats);                      // deterministic
const occ = seats.filter((s) => s.status === 'occupied').length / 180;
expect(occ).toBeGreaterThan(0.3); expect(occ).toBeLessThan(0.55);
const byId = (id: string) => seats.find((s) => s.id === id)!;
expect(byId('12A').priceUsd).toBe(69); expect(byId('14B').priceUsd).toBe(15); expect(byId('14C').priceUsd).toBe(25);
expect(seatLabel(byId('14C'))).toBe('14C · Aisle · $25');
expect(seatLabel(byId('12A'))).toBe('12A · Window · Extra legroom · $69');
const pick = pickRecommendedSeat(seats);
expect(pick.status).toBe('free'); expect(pick.position).toBe('window');
expect(pick.row).toBeGreaterThanOrEqual(9); expect(pick.row).toBeLessThanOrEqual(18);
// only 9A free in the wing zone → 9A
const onlyNine = seats.map((s) => ({ ...s, status: s.id === '9A' ? 'free' : s.row >= 9 && s.row <= 18 && s.position === 'window' ? 'occupied' : s.status })) as Seat[];
expect(pickRecommendedSeat(onlyNine).id).toBe('9A');
expect(seatVisual(byId('12A'), null, null)).toBe(byId('12A').status === 'occupied' ? 'occupied' : 'extra');
expect(seatVisual(pick, pick.id, pick.id)).toBe('selected');
```

- [ ] **Step 2: Run — expect FAIL**
- [ ] **Step 3: Implement `src/experience/seats.ts`** (inline mulberry32; no dependency)
- [ ] **Step 4: Run — expect PASS**
- [ ] **Step 5: Commit** — `feat: seat map, pricing and recommendation`

---

### Task 4: Scroll tracks, chapters and camera poses

**Files:**
- Create: `src/experience/chapters.ts`, `src/experience/cameraPoses.ts`, `tests/unit/chapters.test.ts`, `tests/unit/cameraPoses.test.ts`

**Interfaces:**
- Consumes: Task 2 geometry; `Seat` from Task 3 (only `row`, `letter`).
- Produces (`chapters.ts`):
  - `type Track = 'pre' | 'post'`; `type ChapterId = 'sky' | 'door' | 'aisle' | 'pass' | 'exit' | 'outro'`
  - `TRACKS: Record<Track, { id: ChapterId; start: number; end: number; heightVh: number }[]>`:
    pre = sky 0–0.2 (100vh), door 0.2–0.45 (125vh), aisle 0.45–1 (275vh); post = pass 0–0.15 (60vh), exit 0.15–0.7 (220vh), outro 0.7–1 (120vh)
  - `chapterAt(track: Track, progress: number): { id: ChapterId; t: number }` (progress clamped to 0..1, `t` local 0..1; a boundary belongs to the later chapter)
  - `trackProgress(track: Track, id: ChapterId, t: number): number`
- Produces (`cameraPoses.ts`):
  - `interface CameraPose { position: THREE.Vector3; target: THREE.Vector3; fov: number }`
  - `poseOnPreTrack(progress: number): CameraPose`
  - `aisleProgressForRow(row: number): number` — pre-track progress where the camera stands at `x = rowX(row) + 0.6`
  - `seatedPose(seat: { row: number; letter: SeatLetter }): CameraPose`
  - `exitControlPoints(seat): THREE.Vector3[]` — `[seated eye, window centre, outside, pull-back]`
  - `poseOnPostTrack(progress: number, seat): CameraPose`
  - `aircraftFlyAway(postProgress: number): { offsetX: number; climb: number; bank: number }`

Choreography values (tunable later, but the tests pin the anchor points):
- sky: position (42, 6.5, −36) → (34, 4.5, −30); target (0, 0, 0) → (8, 0.5, −1); fov 30.
- door: `CatmullRomCurve3` (centripetal) through (34, 4.5, −30), (24, 2.2, −16), (17, 1.0, −7.5), (13.9, 0.95, −4.2), (13.9, 1.1, −2.4), (13.9, 1.2, −0.9), (13.1, 1.2, −0.15), (12.6, 1.2, 0); sample with `getPoint` (passes exactly through control points). Target = door centre (13.9, 0.6, −1.9) for t < 0.7, then blends to (5, 1.1, 0). fov 30 → 60 over t 0.55–0.9.
- aisle: x from 12.6 to −11.6 at y = `EYE_STANDING`, z = 0; target = position + (−6, −0.15, 0); fov 60.
- seated: position (`rowX(row)` − 0.15, `EYE_SEATED`, `SEAT_Z[letter]`); target (`stationToX(nearestWindowStation(rowStation(row)))`, `WINDOW.y` − 0.05, `sideOf(letter)` × (`CABIN_WALL_Z` + 3)); fov 55.
- exit control points: seated position; window centre (`wx`, `WINDOW.y`, side × `CABIN_WALL_Z`); outside (`wx` + 0.5, 0.9, side × 7); pull-back (`wx` + 16, 7, side × 44). Post track: pass → seated pose; exit → along the curve, target blends from the seated target to (0, 0, 0) after t 0.35, fov 55 → 35; outro → pull-back position, target follows the aircraft (`offsetX`, `climb`).
- fly-away: `u = clamp((progress − 0.6) / 0.4, 0, 1)`; `offsetX = 900·u²`, `climb = 60·u²`, `bank = −0.22·sin(πu)`.

- [ ] **Step 1: Write the failing tests**

```ts
// chapters
expect(chapterAt('pre', 0)).toEqual({ id: 'sky', t: 0 });
expect(chapterAt('pre', 0.2)).toEqual({ id: 'door', t: 0 });
expect(chapterAt('pre', 1)).toEqual({ id: 'aisle', t: 1 });
expect(chapterAt('post', 0.425).id).toBe('exit'); expect(chapterAt('post', 0.425).t).toBeCloseTo(0.5);
expect(chapterAt('pre', -1)).toEqual({ id: 'sky', t: 0 });
expect(trackProgress('post', 'exit', 0.5)).toBeCloseTo(0.425);
// poses
expect(poseOnPreTrack(0).position.toArray()).toEqual([42, 6.5, -36]);
expect(poseOnPreTrack(0).fov).toBe(30);
const doorEnd = poseOnPreTrack(trackProgress('pre', 'door', 1));
expect(doorEnd.position.distanceTo(new Vector3(12.6, 1.2, 0))).toBeLessThan(1e-6);
const doorSamples = Array.from({ length: 401 }, (_, i) => poseOnPreTrack(trackProgress('pre', 'door', i / 400)).position);
expect(Math.min(...doorSamples.map((p) => p.distanceTo(new Vector3(13.9, 1.1, -2.4))))).toBeLessThan(0.02);
expect(poseOnPreTrack(aisleProgressForRow(14)).position.x).toBeCloseTo(rowX(14) + 0.6, 3);
expect(poseOnPreTrack(0.9).fov).toBe(60);
const seat = { row: 14, letter: 'A' as const };
expect(seatedPose(seat).position.toArray().map((v) => +v.toFixed(3))).toEqual([+(rowX(14) - 0.15).toFixed(3), 0.7, -1.42]);
expect(exitControlPoints(seat)[1].toArray()).toEqual([stationToX(nearestWindowStation(rowStation(14))), 0.62, -1.8]);
expect(poseOnPostTrack(0, seat).position.equals(seatedPose(seat).position)).toBe(true);
expect(poseOnPostTrack(1, seat).position.equals(exitControlPoints(seat)[3])).toBe(true);
expect(aircraftFlyAway(0.5)).toEqual({ offsetX: 0, climb: 0, bank: 0 });
expect(aircraftFlyAway(1).offsetX).toBe(900);
```

- [ ] **Step 2: Run — expect FAIL**
- [ ] **Step 3: Implement both modules** (use `THREE.MathUtils.smoothstep`/`lerp`; build curves once at module load)
- [ ] **Step 4: Run — expect PASS**
- [ ] **Step 5: Commit** — `feat: scroll tracks, chapters and camera poses`

---

### Task 5: Boarding pass data and the experience store

**Files:**
- Create: `src/experience/boardingPass.ts`, `src/experience/store.ts`, `tests/unit/boardingPass.test.ts`, `tests/unit/store.test.ts`

**Interfaces:**
- Consumes: `generateSeatMap`, `pickRecommendedSeat`, `Seat` (Task 3); `aisleProgressForRow` (Task 4); `Track` (Task 4).
- Produces (`boardingPass.ts`): `interface BoardingPassData { airline: 'AslanAir'; flight: 'ASLAN 270'; from: { code: 'IST'; city: 'Istanbul' }; to: { code: 'LIS'; city: 'Lisbon' }; date: '22 OCT'; boarding: '14:35'; gate: 'B12'; seat: string; zone: 1 | 2 | 3; passenger: 'Guest'; barcode: number[] }`; `boardingPassFor(seat: Seat): BoardingPassData` — zone 1 for rows ≤10, 2 for ≤20, else 3; barcode = 48 bar widths in 1..4 seeded from the seat id.
- Produces (`store.ts`):
  - `type Phase = 'browse' | 'seated' | 'confirmed' | 'thanks'`
  - `interface ExperienceState { phase: Phase; seats: Seat[]; hoveredSeatId: string | null; selectedSeatId: string | null; progress: number; soundOn: boolean; setProgress(p: number): void; hover(id: string | null): void; sit(id: string): boolean; standUp(): void; confirm(): void; changeSeat(): void; autoPick(): void; submitForm(): void; restart(): void }`
  - `trackOf(phase: Phase): Track` — `'post'` for confirmed/thanks, else `'pre'`
  - `experienceStore` (zustand `createStore`), `useExperience<T>(selector: (s: ExperienceState) => T): T`
  - Rules: `sit` only in browse on a free seat (returns false otherwise, clears hover); `standUp` seated → browse, clears selection, sets progress to `aisleProgressForRow(row)`; `confirm` seated → confirmed, progress 0; `changeSeat` confirmed → browse, clears selection, progress `aisleProgressForRow(row)`; `autoPick` browse → seated on `pickRecommendedSeat`; `submitForm` confirmed → thanks; `restart` → browse, progress 0, no selection/hover; `setProgress` clamps to 0..1; `hover` ignored outside browse; actions in the wrong phase are no-ops.

- [ ] **Step 1: Write the failing tests** (reset with `experienceStore.getState().restart()` in `beforeEach`)

```ts
const s = () => experienceStore.getState();
expect(s().phase).toBe('browse');
const occupied = s().seats.find((x) => x.status === 'occupied')!;
const free = s().seats.find((x) => x.status === 'free')!;
expect(s().sit(occupied.id)).toBe(false); expect(s().phase).toBe('browse');
expect(s().sit(free.id)).toBe(true); expect(s().phase).toBe('seated'); expect(s().selectedSeatId).toBe(free.id);
expect(s().sit(free.id)).toBe(false);
s().standUp(); expect(s().phase).toBe('browse'); expect(s().selectedSeatId).toBeNull();
expect(s().progress).toBeCloseTo(aisleProgressForRow(free.row));
s().autoPick(); expect(s().selectedSeatId).toBe(pickRecommendedSeat(s().seats).id);
s().confirm(); expect(s().phase).toBe('confirmed'); expect(s().progress).toBe(0); expect(trackOf(s().phase)).toBe('post');
s().changeSeat(); expect(s().phase).toBe('browse');
s().autoPick(); s().confirm(); s().submitForm(); expect(s().phase).toBe('thanks');
s().restart(); expect(s().phase).toBe('browse'); expect(s().progress).toBe(0);
s().setProgress(2); expect(s().progress).toBe(1);
s().autoPick(); s().hover(free.id); expect(s().hoveredSeatId).toBeNull();
// boarding pass
const p14c = boardingPassFor({ ...free, id: '14C', row: 14, letter: 'C' });
expect(p14c.zone).toBe(2); expect(p14c.barcode).toHaveLength(48);
expect(boardingPassFor({ ...free, id: '14C', row: 14, letter: 'C' }).barcode).toEqual(p14c.barcode);
expect(boardingPassFor({ ...free, id: '3F', row: 3, letter: 'F' }).barcode).not.toEqual(p14c.barcode);
```

- [ ] **Step 2: Run — expect FAIL**
- [ ] **Step 3: Implement both modules**
- [ ] **Step 4: Run — expect PASS**
- [ ] **Step 5: Commit** — `feat: experience store and boarding pass data`

---

### Task 6: Sky and volumetric clouds

**Files:**
- Create: `src/scene/sky/noise3d.ts`, `src/scene/sky/shaders.ts`, `src/scene/sky/SkyAndClouds.tsx`, `tests/unit/noise3d.test.ts`
- Modify: `src/app/page.tsx` (mount `<SkyAndClouds />` inside the Canvas)

**Interfaces:**
- Produces: `bakeNoise3D(size: number, seed: number): Uint8Array` (port of `makeNoise3D` from the v4 spike, octaves `[[4,0.45],[8,0.3],[16,0.17],[32,0.08]]`, quintic fade, tileable); `SUN_DIRECTION: THREE.Vector3` = `setFromSphericalCoords(1, 50°, 160°)`; `<SkyAndClouds />` — sets `scene.background` to the blurred cloud target and `scene.environment` to a PMREM of the analytic sky, adds the sun `DirectionalLight` (`#fff4e6`, 3.0, shadows 2048, box ±26).
- Source of truth for GLSL: `.superpowers/brainstorm/44-1792652677/content/spike-plane-v4.html` — copy `SKY_GLSL`, the cloud fragment shader and the blur shader verbatim into `shaders.ts` as exported strings.

- [ ] **Step 1: Write the failing test**

```ts
const a = bakeNoise3D(16, 1337);
expect(a).toHaveLength(16 * 16 * 16);
expect(bakeNoise3D(16, 1337)).toEqual(a);
const mean = a.reduce((s, v) => s + v, 0) / a.length;
expect(mean).toBeGreaterThan(100); expect(mean).toBeLessThan(155);
expect(bakeNoise3D(16, 7)).not.toEqual(a);
```

- [ ] **Step 2: Run — expect FAIL**
- [ ] **Step 3: Implement** `noise3d.ts`, `shaders.ts`, and `SkyAndClouds.tsx`: the cloud pass and two blur passes render in a `useFrame(..., -1)` callback (negative priority keeps R3F's automatic render), cloud target at 0.5 × drawing-buffer size, `HalfFloatType`; resize targets when `size`/`dpr` change; uniforms `uCam/uInvProj/uInvView/uTime` from the R3F camera.
- [ ] **Step 4: Run unit test — expect PASS; run `npm run e2e` — smoke still PASS**
- [ ] **Step 5: Visual check** — add a temporary static camera at (42, 6.5, −36) looking at the origin; `npx playwright screenshot http://localhost:3100 test-results/sky.png` (dev server running); confirm blue sky and white clouds below the horizon, no grain.
- [ ] **Step 6: Commit** — `feat: raymarched sky and clouds as scene background`

---

### Task 7: Aircraft, camera rig and smooth scroll (sky → door → aisle)

**Files:**
- Create: `src/scene/aircraft/Aircraft.tsx`, `src/scene/CameraRig.tsx`, `src/scroll/SmoothScroll.tsx`, `src/scene/Experience.tsx`, `src/dev/testHooks.ts`, `tests/e2e/scroll.spec.ts`
- Modify: `src/app/page.tsx`, `src/app/globals.css`

**Interfaces:**
- Consumes: store (Task 5), `chapterAt`/`TRACKS`/`poseOnPreTrack`/`poseOnPostTrack`/`seatedPose`/`aircraftFlyAway` (Task 4), `<SkyAndClouds />` (Task 6).
- Produces:
  - `<Experience />` — fixed full-screen Canvas (`dpr [1, 2]`, ACES tone mapping, exposure 1.0, shadows); renders a fallback `<p>` with `copy.fallback.noWebgl` when `document.createElement('canvas').getContext('webgl2')` is null.
  - `<Aircraft />` — `useGLTF('/models/airliner.glb')`, cast/receive shadows, idle bob (`rotation.x = 0.025·sin(0.5t)`, `y = 0.4·sin(0.37t)`), applies `aircraftFlyAway(progress)` on the post track.
  - `<CameraRig />` — each frame picks the pose (pre track → `poseOnPreTrack`; seated → `seatedPose`; post track → `poseOnPostTrack`) and damps camera position/target/fov with `maath/easing` (`smoothTime 0.4`).
  - `<SmoothScroll />` — renders the sections of `TRACKS[trackOf(phase)]` (heights in vh) inside a transparent wrapper; Lenis on the window; `ScrollTrigger` on the wrapper (`start 'top top'`, `end 'bottom bottom'`) calls `setProgress`; `lenis.on('scroll', ScrollTrigger.update)` + `gsap.ticker` drives `lenis.raf`; sets `history.scrollRestoration = 'manual'` and scrolls to 0 on mount; imports `lenis/dist/lenis.css` (needed for `lenis.stop()` to block scrolling). Exports `scrollToProgress(p: number, immediate: boolean): void`.
  - `installTestHooks()` — when `NODE_ENV !== 'production'`, sets `window.__aslan = { store: experienceStore }`.

- [ ] **Step 1: Write the failing e2e tests** — `tests/e2e/scroll.spec.ts`

```ts
test('scrolling walks from the sky into the aisle', async ({ page }) => {
  await page.goto('/');
  const progress = () => page.evaluate(() => (window as any).__aslan.store.getState().progress);
  expect(await progress()).toBe(0);
  for (let i = 0; i < 40; i++) await page.mouse.wheel(0, 600);
  await expect.poll(progress, { timeout: 15000 }).toBeGreaterThan(0.95);
  await page.screenshot({ path: 'test-results/aisle.png' });
});
test('reload mid-page restarts at the sky', async ({ page }) => {
  await page.goto('/');
  for (let i = 0; i < 10; i++) await page.mouse.wheel(0, 600);
  await page.reload();
  await expect.poll(() => page.evaluate(() => (window as any).__aslan.store.getState().progress)).toBe(0);
});
test('resize keeps rendering', async ({ page }) => {
  const errors: string[] = []; page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto('/');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.setViewportSize({ width: 1440, height: 800 });
  await expect(page.locator('canvas')).toBeVisible(); expect(errors).toEqual([]);
});
test('no WebGL2 shows the fallback', async ({ page }) => {
  await page.addInitScript(() => {
    const orig = HTMLCanvasElement.prototype.getContext;
    // @ts-expect-error test shim
    HTMLCanvasElement.prototype.getContext = function (t, ...a) { return t === 'webgl2' ? null : orig.call(this, t, ...a); };
  });
  await page.goto('/');
  await expect(page.getByText(/WebGL2/i)).toBeVisible();
});
```

- [ ] **Step 2: Run `npm run e2e` — expect FAIL**
- [ ] **Step 3: Implement the files above**; `copy.ts` gains `fallback.noWebgl` (mentions WebGL2) and `chapters.sky/door/aisle` captions (shown later by the overlay).
- [ ] **Step 4: Run `npm run e2e` — expect PASS; open `test-results/aisle.png` and confirm the camera stands in the fuselage looking aft**
- [ ] **Step 5: Commit** — `feat: aircraft, damped camera rig and scroll-driven chapters`

---

### Task 8: Placeholder cabin and interactive seats

**Files:**
- Create: `src/scene/cabin/CabinShell.tsx`, `src/scene/cabin/Seats.tsx`, `src/ui/Overlay.tsx`, `src/ui/ui.module.css`
- Modify: `src/scene/Experience.tsx`, `src/content/copy.ts`

**Interfaces:**
- Consumes: geometry (Task 2), seats + `seatVisual`/`SEAT_COLORS`/`seatLabel` (Task 3), store (Task 5), `chapterAt` (Task 4).
- Produces:
  - `<CabinShell />` — floor at `FLOOR_Y`, ceiling at `CEILING_Y`, side walls at ±`CABIN_WALL_Z` spanning stations 6.2–31; `MeshStandardMaterial` with `onBeforeCompile` that discards fragments inside window rectangles (centres from `windowStations()` at `WINDOW.y`, size `WINDOW.w × WINDOW.h`); warm ambient + `HemisphereLight` + 4 point lights along the ceiling. Visible only on the pre track's door/aisle chapters and while seated/confirmed (hidden in sky and outro for performance).
  - `<Seats />` — two `instancedMesh`es (seat body: box 0.44 × 0.9 × 0.5, neutral `#d9d6cf`; headrest cover: box 0.4 × 0.16 × 0.06 at the top of the backrest) placed with `seatWorldPosition`; per-instance colour of the cover = `SEAT_COLORS[seatVisual(...)]`; seat body darkened 25% for occupied seats; `onPointerMove` → `hover(seat.id)`, `onPointerOut` → `hover(null)`, `onClick` → `sit(seat.id)`; pointer events active only when phase is browse and chapter is aisle.
  - `<Overlay />` — chapter caption from `copy.chapters[id]`; tooltip with `seatLabel` near the pointer while a seat is hovered; in the aisle chapter a hint `copy.aisle.hint` and a `<button>` `copy.aisle.pickForMe` → `autoPick()`.

- [ ] **Step 1: Manual acceptance list** (3D picking is not unit-testable; logic is covered by Tasks 3 and 5): in the aisle, covers show teal / terracotta / no colour; hovering a free seat shows the tooltip `"14C · Aisle · $25"`-style label; occupied seats ignore hover; clicking a free seat moves the camera into it; windows show the wing and clouds.
- [ ] **Step 2: Write the failing e2e test** — append to `tests/e2e/scroll.spec.ts`: after scrolling to the aisle, `page.getByRole('button', { name: /pick for me/i })` is visible.
- [ ] **Step 3: Run — expect FAIL**
- [ ] **Step 4: Implement**
- [ ] **Step 5: Run `npm run e2e` — expect PASS; walk the manual list in `npm run dev`**
- [ ] **Step 6: Commit** — `feat: placeholder cabin with interactive seat map`

---

### Task 9: Seated view, boarding pass and the track swap

**Files:**
- Create: `src/scene/BoardingPass3D.tsx`, `tests/e2e/journey.spec.ts`
- Modify: `src/ui/Overlay.tsx`, `src/scroll/SmoothScroll.tsx`, `src/content/copy.ts`

**Interfaces:**
- Consumes: store, `boardingPassFor` (Task 5), `scrollToProgress` (Task 7).
- Produces:
  - Seated panel in `<Overlay />`: `seatLabel` + buttons `copy.seated.choose` → `confirm()` and `copy.seated.another` → `standUp()`.
  - `<SmoothScroll />` phase reactions: entering `seated` → `lenis.stop()` immediately; `seated → browse` → `lenis.start()` + `scrollToProgress(progress, true)`; `→ confirmed` → re-render post-track sections, `ScrollTrigger.refresh()`, `scrollToProgress(0, true)`, `lenis.start()`; `confirmed → browse` → pre-track sections, `scrollToProgress(progress, true)`.
  - `<BoardingPass3D />` — visible in the `pass` chapter: a 0.5 × 0.24 rounded card placed 0.8 m in front of the camera; front/back `CanvasTexture`s drawn from `BoardingPassData` (airline, flight, IST → LIS, seat, gate, zone, boarding time, barcode bars); click flips it 180° (GSAP, 0.6 s). Overlay in this chapter shows `copy.pass.change` button → `changeSeat()` and `copy.pass.scrollHint`.

- [ ] **Step 1: Write the failing e2e test** — `tests/e2e/journey.spec.ts`

```ts
const state = (page) => page.evaluate(() => (window as any).__aslan.store.getState());
test('pick, reconsider, confirm', async ({ page }) => {
  await page.goto('/');
  for (let i = 0; i < 40; i++) await page.mouse.wheel(0, 600);
  await expect.poll(async () => (await state(page)).progress).toBeGreaterThan(0.95);
  await page.getByRole('button', { name: /pick for me/i }).click();
  await expect.poll(async () => (await state(page)).phase).toBe('seated');
  const seatedAt = (await state(page)).progress;
  await page.mouse.wheel(0, 2000);                                    // momentum must not move us
  await page.waitForTimeout(500);
  expect((await state(page)).progress).toBe(seatedAt);
  await page.getByRole('button', { name: /another/i }).click();
  await expect.poll(async () => (await state(page)).phase).toBe('browse');
  await page.getByRole('button', { name: /pick for me/i }).focus();
  await page.keyboard.press('Enter');                                  // keyboard path
  await page.getByRole('button', { name: /choose this seat/i }).click();
  await expect.poll(async () => (await state(page)).phase).toBe('confirmed');
  await expect(page.getByRole('button', { name: /change seat/i })).toBeVisible();
  await page.screenshot({ path: 'test-results/pass.png' });
});
```

- [ ] **Step 2: Run — expect FAIL**
- [ ] **Step 3: Implement**
- [ ] **Step 4: Run — expect PASS; check `test-results/pass.png` shows the card in front of the window**
- [ ] **Step 5: Commit** — `feat: seated view, boarding pass and post-confirmation track`

---

### Task 10: Exit through the window, fly-away and the outro

**Files:**
- Create: `src/ui/Outro.tsx`
- Modify: `src/ui/ui.module.css`, `src/content/copy.ts`, `src/app/page.tsx`, `tests/e2e/journey.spec.ts`

**Interfaces:**
- Consumes: store (`submitForm`, `restart`), `chapterAt`, `scrollToProgress`.
- Produces: `<Outro />` shown in the `outro` chapter: heading `copy.outro.title` ("Have a nice flight"-style), a `<form>` with labelled inputs Name, E-mail, Comment and a submit button `copy.outro.buy` ("Buy"); submit calls `preventDefault()` and `submitForm()` and never makes a network request; the `thanks` phase replaces the form with `copy.outro.thanks` (says it is a concept) and a `copy.outro.restart` button → `restart()` + `scrollToProgress(0, true)`; a "How it's made" block (`copy.outro.howItsMade`: stack, Blender-scripted aircraft, real-time clouds, author name/links as placeholders); a footer disclaimer `copy.footer.disclaimer` visible on every chapter ("AslanAir is a fictional airline — a concept").

- [ ] **Step 1: Extend the failing e2e test** — continue `pick, reconsider, confirm` (or a new test reusing it):

```ts
const requests: string[] = []; page.on('request', (r) => r.method() === 'POST' && requests.push(r.url()));
for (let i = 0; i < 40; i++) await page.mouse.wheel(0, 600);
await expect.poll(async () => (await state(page)).progress).toBeGreaterThan(0.95);
await page.screenshot({ path: 'test-results/outro.png' });
await page.getByLabel(/name/i).fill('Test'); await page.getByLabel(/e-mail/i).fill('t@example.com');
await page.getByRole('button', { name: /^buy$/i }).click();
await expect(page.getByText(/concept/i).first()).toBeVisible();
expect(requests).toEqual([]);
await page.getByRole('button', { name: /start again/i }).click();
await expect.poll(async () => (await state(page)).phase).toBe('browse');
await expect.poll(async () => (await state(page)).progress).toBe(0);
```

- [ ] **Step 2: Run — expect FAIL**
- [ ] **Step 3: Implement**
- [ ] **Step 4: Run `npm test` and `npm run e2e` — expect all PASS; check `test-results/outro.png`: aircraft small in the distance over the clouds, form readable**
- [ ] **Step 5: Run `npm run build` — expect a successful production build**
- [ ] **Step 6: Commit** — `feat: exit through the window, fly-away and outro form`

---

## Spec coverage (this plan vs. later plans)

| Spec item | Here | Later |
|-----------|------|-------|
| 4.1 chapters 1–7, scroll rules, «Pick for me», «Change seat» | Tasks 4, 5, 7–10 | — |
| 4.2 realistic exterior, live clouds | Task 6 | — |
| 4.2 realistic daytime cabin | placeholder (Task 8) | Plan 3 |
| 4.3 seat states/colours/prices/tooltip | Tasks 3, 8 | headrest-cover look: Plan 3 |
| 4.4 boarding pass, flip | click-flip (Task 9) | drag-flip: Plan 4 |
| 4.5 outro, form (visual only), disclaimer, How it's made | Task 10 | final copy: Plan 4 |
| 4.6 English copy in one file | `copy.ts` from Task 7 on | final pass: Plan 4 |
| 4.7 sound with mute | — | Plan 4 |
| 4.8 mobile tiers, loader, reduced motion | — | Plan 4 |
| 5 door opening, window openings, lettering, compression | — | Plan 2 |
