# AslanAir — Plan 2: Aircraft v3 and Cabin Shell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the aircraft so the camera can really enter it — a door 1L that opens, real window openings with glass, a hull-following cabin shell, "AslanAir" lettering, a corrected tail and fin — exported by one command as a compressed GLB that replaces the placeholder cabin walls on the site.

**Architecture:** `tools/blender/airliner.py` becomes a small package: a pure-Python geometry module (no `bpy`, unit-tested with `unittest`) that every builder and the web constants agree on, and Blender-only builder modules (hull, cabin shell, door, lettering, livery, export). A Node script runs Blender headless, compresses the GLB with gltf-transform (meshopt + WebP) and writes `airliner.meta.json`, which a Vitest test checks against `src/experience/geometry.ts`. On the web, the GLB's cabin shell replaces `CabinShell`'s placeholder box; the door animates from scroll progress.

**Tech Stack:** Blender 5.2.2 LTS (headless Python), Python 3.14 `unittest`, `@gltf-transform/cli` 4.5.1 (meshopt, WebP), three.js `GLTFLoader` + meshopt decoder via drei `useGLTF`, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-22-aslanair-design.md` (section 5 "Самолёт", 4.1 chapter 2 "дверь открывается навстречу").

**Roadmap change (decided while planning):** real window openings need a hull-following cabin shell behind them (otherwise you see through the fuselage), so the shell — sidewalls, ceiling, floor, bulkheads, window reveals and glass — moves from Plan 3 into this plan. Plan 3 becomes cabin *furnishing*: real seats with headrest covers, bins, ceiling lights, galley, signs.

## Global Constraints

- Free assets only; geometry is procedural; lettering uses Blender's built-in font (DejaVu-based, free licence).
- Blender is found at `$BLENDER_PATH`, else `C:\Program Files\Blender Foundation\Blender 5.2\blender.exe`.
- Coordinates: Blender X = 18.8 − s (nose +X), +Y = port (left), Z up. three.js: x = X, y = Z, z = −Y (port is −Z). Station `s` = metres from the nose.
- Livery colours unchanged: white `#f1f0ec`, navy `#1b2541`, terracotta `#d4683a`; the "sun over horizon" fin emblem stays.
- Brand name on the hull reads `AslanAir` and reads left-to-right on both sides.
- Final `public/models/airliner.glb` ≤ 1.5 MB; ≤ 120 000 triangles; textures ≤ 2048 px per side.
- Node names the site relies on: `Fuselage`, `Door1L`, `CabinShell`, `CabinFloor`, `WindowGlass`, `Lettering_L`, `Lettering_R`.
- Values shared with the web (`src/experience/geometry.ts`) come from `tools/blender/aslanair/geometry.py`; the meta file is the bridge, and a test keeps them equal.

## Review Focus

- Looking out of any window from a seat → no gap, z-fighting or see-through between the cabin reveal and the hull opening (screenshots from 1A, 14F, 30A in Task 8).
- The door swing never crosses the camera's door flight → the camera is never inside the door panel (unit test in Task 7).
- Lettering on the starboard side → reads `AslanAir`, not mirrored (render check in Task 5).
- A phone loading the model → the compressed GLB and its textures stay inside the size budget (asset test in Task 6).
- Rebuilding the aircraft twice → identical `airliner.meta.json` (determinism check in Task 6).

---

## File Structure

```
tools/blender/build.py                     Blender entry point (adds the package to sys.path, runs the build, writes renders on request)
tools/blender/aslanair/__init__.py
tools/blender/aslanair/geometry.py         PURE: sections, stations, windows, door, liner, fin root, meta values (no bpy)
tools/blender/aslanair/mesh.py             bpy helpers: make_mesh, materials, images (moved from airliner.py)
tools/blender/aslanair/livery.py           texture painters (moved; door outline follows geometry.DOOR_1L)
tools/blender/aslanair/hull.py             fuselage, wings, tail, engines, details (moved; fin root follows the hull)
tools/blender/aslanair/openings.py         window + door cutters, booleans, reveals, glass
tools/blender/aslanair/cabin.py            cabin shell: sidewalls/ceiling, floor, bulkheads
tools/blender/aslanair/door.py             Door1L panel with its origin on the hinge
tools/blender/aslanair/lettering.py        AslanAir decals shrink-wrapped onto both sides
tools/blender/aslanair/export.py           GLB export + meta.json
tools/blender/tests/test_geometry.py       unittest for geometry.py
tools/build-aircraft.mjs                   Node: Blender → gltf-transform → public/models
public/models/airliner.glb, public/models/airliner.meta.json
src/experience/geometry.ts                 updated door/tail constants
src/experience/aircraftAnimation.ts        doorOpenAmount (pure)
src/scene/aircraft/Aircraft.tsx            door animation, meshopt GLB
src/scene/cabin/CabinLights.tsx            lights only (CabinShell.tsx deleted)
tests/unit/aircraftAsset.test.ts, tests/unit/aircraftAnimation.test.ts, tests/e2e/aircraft.spec.ts
```
`tools/blender/airliner.py` is deleted once `build.py` reproduces it (Task 1).

---

### Task 1: Split the Blender script into a tested package

**Files:**
- Create: `tools/blender/build.py`, `tools/blender/aslanair/{__init__,geometry,mesh,livery,hull,export}.py`, `tools/blender/tests/test_geometry.py`
- Delete: `tools/blender/airliner.py`
- Modify: `package.json` (script `"test:blender": "python -m unittest discover -s tools/blender/tests -v"`)

**Interfaces:**
- Produces (`geometry.py`, pure, Blender coordinates): `L = 37.6`; `RW, RT, RB = 1.975, 2.10, 2.04`; `NOSE_Z = -0.55`; `TAIL0` (25.5 in this task); `X(s) -> float`; `section(s) -> tuple[half_width, centre_z, half_height]`; `hull_top(s) -> float`; `hull_half_width_at(s, z) -> float` (0.0 outside the section); `WINDOW = {z: 0.62, first: 6.55, pitch: 0.533, last: 29.0, w: 0.23, h: 0.33, r: 0.09}`; `window_stations() -> list[float]`.
- Produces (`build.py`): `blender -b --factory-startup -P tools/blender/build.py -- --out DIR [--renders hero,side,window,engine,nose,door] [--samples N]` writes `DIR/airliner.glb` (+ renders).

- [ ] **Step 1: Write the failing tests** — `tools/blender/tests/test_geometry.py` (imports `aslanair.geometry` via `sys.path`)

```python
self.assertEqual(len(window_stations()), 43)
self.assertAlmostEqual(window_stations()[0], 6.55)
self.assertAlmostEqual(X(0), 18.8)
w, zc, h = section(15.0); self.assertAlmostEqual(w, 1.975); self.assertAlmostEqual(zc, 0.03); self.assertAlmostEqual(h, 2.07)
self.assertAlmostEqual(hull_top(15.0), 2.10)
self.assertAlmostEqual(hull_half_width_at(15.0, 0.03), 1.975)
self.assertEqual(hull_half_width_at(15.0, 3.0), 0.0)
```
- [ ] **Step 2: Run `npm run test:blender` — expect FAIL (module missing)**
- [ ] **Step 3: Move code** — split `airliner.py` into the modules above with no behaviour change (section/ease/X/window constants go to `geometry.py`; painters to `livery.py`; parts to `hull.py`; GLB export to `export.py`; `build.py` keeps CLI args, sky/clouds/cameras/render).
- [ ] **Step 4: Run `npm run test:blender` — expect PASS**
- [ ] **Step 5: Build and compare** — `blender … build.py -- --out tools/blender/out`; triangle count printed must equal the old script's 68 896 and the GLB size must be within 1% of 2.7 MB.
- [ ] **Step 6: Commit** — `refactor: split the Blender aircraft script into a tested package`

---

### Task 2: Tail cone and fin root fixes

**Files:** Modify `tools/blender/aslanair/geometry.py`, `tools/blender/aslanair/hull.py`, `tools/blender/tests/test_geometry.py`

**Interfaces:**
- Produces: `TAIL0 = 27.8` (tail cone 9.8 m, keeps rows 27–30 inside a full-width section); `FLOOR_Z = -0.45`; `LINER_INSET = 0.10`; `liner_half_width_at(s, z) -> float` (= `hull_half_width_at(s, z) - LINER_INSET`, floored at 0); `FIN_ROOT_INSET = 0.08`; `fin_root_z(s) -> float` (= `hull_top(s) - FIN_ROOT_INSET`). `hull.vfin` builds its root section point-by-point at `fin_root_z(s)` for each chord point instead of the flat z = 1.2 section.

- [ ] **Step 1: Write the failing tests**

```python
# rows 27–30 (stations 27.58–29.92 + seat depth) fit inside the liner at seat height
for s in (27.58, 28.36, 29.14, 29.92, 30.17):
    self.assertGreater(liner_half_width_at(s, 0.0), 1.42 + 0.23)        # seat F outer edge
# fin root stays inside the skin but above the cabin ceiling (liner top)
for s in (28.2, 29.0, 30.0, 31.0, 33.0, 35.0):
    self.assertLess(fin_root_z(s), hull_top(s))
    self.assertGreater(fin_root_z(s), hull_top(s) - LINER_INSET)
self.assertAlmostEqual(TAIL0, 27.8)
```
- [ ] **Step 2: Run — expect FAIL**
- [ ] **Step 3: Implement** (vfin root loft section: for each airfoil point compute its station and place it at `fin_root_z(station)`)
- [ ] **Step 4: Run — expect PASS**; build with `--renders side` and check the tail silhouette and fin root in `tools/blender/out/renders/side.png`
- [ ] **Step 5: Commit** — `fix: later tail cone and a fin root that follows the hull`

---

### Task 3: Door 1L — doorway, panel and hinge

**Files:** Create `tools/blender/aslanair/door.py`; modify `geometry.py`, `livery.py`, `hull.py`, `build.py`, `tests/test_geometry.py`

**Interfaces:**
- Produces (`geometry.py`): `DOOR_1L = {station: 4.9, width: 0.82, height: 1.85, sill: FLOOR_Z + 0.05, radius: 0.15, side: +1}` (port, Blender +Y); `door_rect() -> (s_min, s_max, z_min, z_max)`; `door_hinge() -> (X, Y, Z)` = forward edge (`s_min`) at the hull surface at mid door height; `DOOR_OPEN_ANGLE_DEG = 150`.
- Produces (Blender): the hull gets a doorway hole (EXACT boolean with a rounded-rect prism along Y); object `Door1L` is the cut-out hull patch thickened 0.06 m inward, painted with the livery (same UVs) and a 0.03 m frame gap, with its **origin on `door_hinge()`** so rotating its local Z (three: Y) swings it forward along the hull; `livery.paint_livery` draws the door outline from `door_rect()` (replacing the old low door at centre 0.05).

- [ ] **Step 1: Write the failing tests**

```python
s0, s1, z0, z1 = door_rect()
self.assertAlmostEqual(s1 - s0, 0.82); self.assertAlmostEqual(z1 - z0, 1.85)
self.assertAlmostEqual(z0, FLOOR_Z + 0.05)
hx, hy, hz = door_hinge()
self.assertAlmostEqual(hx, X(s0)); self.assertAlmostEqual(hz, (z0 + z1) / 2)
self.assertAlmostEqual(hy, hull_half_width_at(s0, hz), places=3)
```
- [ ] **Step 2: Run — expect FAIL**
- [ ] **Step 3: Implement**; `build.py --renders door` adds a close-up camera on the door with `Door1L` rotated to 0° and to 150° (two images).
- [ ] **Step 4: Run tests — expect PASS; check `door-closed.png` (flush, outline only) and `door-open.png` (panel along the hull forward of the doorway, opening shows the inside)**
- [ ] **Step 5: Commit** — `feat: door 1L with a doorway and a hinged panel`

---

### Task 4: Window openings, cabin shell and glass

**Files:** Create `tools/blender/aslanair/openings.py`, `tools/blender/aslanair/cabin.py`; modify `geometry.py`, `livery.py`, `build.py`, `tests/test_geometry.py`

**Interfaces:**
- Produces (`geometry.py`): `CABIN = {front_station: 3.4, aft_station: 30.5}`; `window_centres() -> list[(s, z, side)]` (both sides, from `window_stations()`); `cabin_wall_inner(s) -> float` = `liner_half_width_at(s, WINDOW.z)`.
- Produces (Blender):
  - Hull: EXACT boolean with all window prisms (rounded rect `w × h`, radius `r`) → real openings; the livery no longer paints dark window panes (frames stay).
  - `CabinShell`: inward-facing loft of the hull section offset by `LINER_INSET`, from the floor line on one side over the top to the other, stations `front_station…aft_station`, with the same window prisms subtracted; colour `#ebe7de`, roughness 0.85.
  - Window reveals: one closed tube per window between the shell hole and the hull hole (part of `CabinShell`).
  - `WindowGlass`: one flat rounded pane per window, 0.03 m inside the hull, MeshPhysical-like glass (`#9fb3c8`, transmission off, alpha 0.25, roughness 0.05) — one mesh for all panes.
  - `CabinFloor`: plane at `FLOOR_Z` clipped to the shell width, carpet `#7d8590` with a centre aisle strip `#5e6a7a`.
  - Bulkheads at `front_station` (with a closed cockpit-door panel shape) and `aft_station`, filling the shell section above the floor.
  - Door 1L opening is also cut through the shell (reveal tube like the windows).

- [ ] **Step 1: Write the failing tests**

```python
self.assertEqual(len(window_centres()), 86)
self.assertTrue(all(abs(z - 0.62) < 1e-9 for _, z, _ in window_centres()))
self.assertAlmostEqual(cabin_wall_inner(15.0), hull_half_width_at(15.0, 0.62) - 0.10, places=6)
self.assertGreater(cabin_wall_inner(15.0), 1.75); self.assertLess(cabin_wall_inner(15.0), 1.85)
```
- [ ] **Step 2: Run — expect FAIL**
- [ ] **Step 3: Implement**; `build.py --renders window-in` adds a camera at seat 14F eye height looking at its window, and `window-out` from outside at the same window.
- [ ] **Step 4: Run tests — expect PASS; check renders: from inside the wing and sky through the window with no gap at the reveal; from outside the glass tint with the lit cabin wall behind**
- [ ] **Step 5: Commit** — `feat: real window openings, cabin shell and glass`

---

### Task 5: AslanAir lettering

**Files:** Create `tools/blender/aslanair/lettering.py`; modify `build.py`

**Interfaces:**
- Produces: `Lettering_L` and `Lettering_R` — text `AslanAir`, Blender built-in font, cap height 0.42 m, navy `#1b2541`, centred at station 12.5 and z 1.18 (above the window line, below the crown), converted to mesh, shrink-wrapped onto the hull (offset 0.004 m), both reading left-to-right from their side.

- [ ] **Step 1: Write the failing check** — `build.py` asserts after the build that both objects exist and that the text reads left-to-right for a viewer on each side: a viewer on the port side (+Y) has the nose (+X) on their left, so in `Lettering_L` the first glyph ("A") has a **larger** X than the last glyph ("r"); on the starboard side (−Y) the nose is on the viewer's right, so in `Lettering_R` the first glyph has a **smaller** X than the last. The build exits non-zero if either order is wrong.
- [ ] **Step 2: Run the build — expect FAIL (objects missing)**
- [ ] **Step 3: Implement** (text → mesh → rotate to face ±Y → Shrinkwrap "project" along ∓Y → apply)
- [ ] **Step 4: Run the build — expect PASS; check `--renders side` (starboard) and a new `port` render: `AslanAir` readable on both**
- [ ] **Step 5: Commit** — `feat: AslanAir lettering on both sides`

---

### Task 6: One-command export, compression and the meta bridge

**Files:** Create `tools/build-aircraft.mjs`, `tests/unit/aircraftAsset.test.ts`; modify `tools/blender/aslanair/export.py`, `package.json`, `src/experience/geometry.ts`, `tests/unit/geometry.test.ts`

**Interfaces:**
- Produces: `npm run build:aircraft` → runs Blender headless (`BLENDER_PATH` or the default path), then `gltf-transform optimize tools/blender/out/airliner.glb public/models/airliner.glb --compress meshopt --texture-compress webp --texture-size 2048`, then copies `tools/blender/out/airliner.meta.json` to `public/models/`. Dev dependency `@gltf-transform/cli@4.5.1`.
- Produces (`export.py`): `airliner.meta.json` in three.js coordinates: `{ floorY, cabinWallZ (cabin_wall_inner at s 15), window: {y, firstStation, pitch, lastStation, w, h}, door1L: {station, width, height, sillY, hinge: [x, y, z], openAngleDeg}, tail0, triangles }`, values rounded to 4 decimals.
- Produces (`geometry.ts`): `DOOR_1L = { station: 4.9, y: 0.525, width: 0.82, height: 1.85, side: -1, hinge: [x, y, z], openAngleDeg: 150 }` (hinge from meta); `CABIN_WALL_Z` set to the meta value.

- [ ] **Step 1: Write the failing tests** — `tests/unit/aircraftAsset.test.ts`

```ts
const meta = JSON.parse(readFileSync('public/models/airliner.meta.json', 'utf8'));
expect(meta.floorY).toBeCloseTo(FLOOR_Y, 4);
expect(meta.cabinWallZ).toBeCloseTo(CABIN_WALL_Z, 3);
expect(meta.window).toMatchObject({ y: WINDOW.y, firstStation: WINDOW.firstStation, pitch: WINDOW.pitch, lastStation: WINDOW.lastStation });
expect(meta.door1L.station).toBe(DOOR_1L.station);
expect(meta.door1L.hinge).toEqual(DOOR_1L.hinge);
expect(meta.triangles).toBeLessThanOrEqual(120_000);
expect(statSync('public/models/airliner.glb').size).toBeLessThanOrEqual(1_500_000);
const names = glbNodeNames('public/models/airliner.glb');   // parse the GLB JSON chunk
for (const n of ['Fuselage', 'Door1L', 'CabinShell', 'CabinFloor', 'WindowGlass', 'Lettering_L', 'Lettering_R']) expect(names).toContain(n);
expect(glbMaxTextureSide('public/models/airliner.glb')).toBeLessThanOrEqual(2048);
```
Determinism: `npm run build:aircraft` twice; `git diff --exit-code public/models/airliner.meta.json` after the second run.
- [ ] **Step 2: Run `npm test` — expect FAIL (no meta file; old GLB too big)**
- [ ] **Step 3: Implement**; run `npm run build:aircraft`
- [ ] **Step 4: Run `npm test` — expect PASS; run the build again and check the meta file is unchanged**
- [ ] **Step 5: Commit** (GLB and meta included) — `feat: one-command aircraft build with meshopt/WebP and a meta bridge`

---

### Task 7: Door animation on the site

**Files:** Create `src/experience/aircraftAnimation.ts`, `tests/unit/aircraftAnimation.test.ts`, `tests/e2e/aircraft.spec.ts`; modify `src/scene/aircraft/Aircraft.tsx`, `src/experience/cameraPoses.ts` (door centre → `DOOR_1L`)

**Interfaces:**
- Consumes: `chapterAt`, `trackOf`, `DOOR_1L`, `poseOnPreTrack`.
- Produces: `doorOpenAmount(phase: Phase, progress: number): number` — 0 on the post track and in the sky chapter; in the door chapter `smoothstep(t, 0.3, 0.55)`; 1 in the aisle and while seated. `<Aircraft />` rotates node `Door1L` about its local Y (three) by `−amount × DOOR_1L.openAngleDeg` (in radians; forward swing).

- [ ] **Step 1: Write the failing tests**

```ts
expect(doorOpenAmount('browse', trackProgress('pre', 'sky', 0.9))).toBe(0);
expect(doorOpenAmount('browse', trackProgress('pre', 'door', 0.2))).toBe(0);
expect(doorOpenAmount('browse', trackProgress('pre', 'door', 0.6))).toBe(1);
expect(doorOpenAmount('seated', 0.9)).toBe(1);
expect(doorOpenAmount('confirmed', 0.5)).toBe(0);
// the swung panel (a 0.82 m arc around the hinge) never comes within 0.3 m of the door flight
for (let i = 0; i <= 200; i++) {
  const p = poseOnPreTrack(trackProgress('pre', 'door', i / 200)).position;
  expect(distanceToDoorSweep(p)).toBeGreaterThan(0.3);   // helper in the test: min distance to the panel's swept 150° sector around the hinge
}
```
e2e (`aircraft.spec.ts`): at the sky chapter `Door1L` rotation is 0; after scrolling into the door chapter's middle it is > 1 rad; screenshot `test-results/door.png`.
- [ ] **Step 2: Run — expect FAIL**
- [ ] **Step 3: Implement**
- [ ] **Step 4: Run `npm test` and `npm run e2e` — expect PASS; check `door.png`**
- [ ] **Step 5: Commit** — `feat: door 1L opens as the camera arrives`

---

### Task 8: Swap the placeholder cabin for the GLB shell

**Files:** Create `src/scene/cabin/CabinLights.tsx`; delete `src/scene/cabin/CabinShell.tsx`, `src/experience/visibility.ts`, `tests/unit/visibility.test.ts`; modify `src/scene/Experience.tsx`, `src/scene/cabin/Seats.tsx`, `tests/e2e/scroll.spec.ts`

**Interfaces:**
- Produces: `<CabinLights />` — the ambient, hemisphere and four ceiling point lights from the old shell, always on (the shell now hides them from outside); `Seats` no longer gates visibility (the shell encloses them); light-count e2e test unchanged.

- [ ] **Step 1: Write the failing e2e test** — first give the old placeholder's root group `name="PlaceholderCabin"` (a one-word change, so the test has something to fail on); then in `tests/e2e/scroll.spec.ts`: after scrolling to the aisle, `window.__aslan.scene.getObjectByName('CabinShell')` is visible and `getObjectByName('PlaceholderCabin')` is undefined. Note: between Tasks 6 and 8 the placeholder and the GLB shell overlap inside the cabin; that is expected and ends here.
- [ ] **Step 2: Run — expect FAIL**
- [ ] **Step 3: Implement**
- [ ] **Step 4: Run `npm test` and `npm run e2e` — expect PASS; take screenshots from seats 1A, 14F and 30A (seated pose via `window.__aslan.store`) and check: wing/sky visible through the windows, no see-through gaps, seats inside the shell**
- [ ] **Step 5: Run `npm run build` — expect success**
- [ ] **Step 6: Commit** — `feat: the cabin shell from the GLB replaces the placeholder walls`

---

## Spec coverage

| Spec item | Task |
|-----------|------|
| §5 door 1L as a separate opening object | 3, 7 |
| §4.1 ch. 2 "the door opens towards the camera" | 7 |
| §5 windows as transparent openings | 4, 8 |
| §5 AslanAir lettering | 5 |
| §5 GLB compression (target 1.5 MB) | 6 |
| Plan 1 known defect: fin root inside the cabin | 2 |
| Plan 1 review: cabin box through the hull | 4, 8 |
| Plan 1 review: seats vs narrowing tail | 2 |
