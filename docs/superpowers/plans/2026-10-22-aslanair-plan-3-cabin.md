# AslanAir — Plan 3: Cabin Furnishing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the empty GLB cabin shell into a realistic daytime A320 cabin — real seats whose headrest covers carry availability, a soft hover glow and a selected outline, overhead bins with row numbers, ceiling light strips, a galley and curtain at door 1L, exit signs, and cabin light that stays inside — while the cabin keeps 45+ fps on the integrated GPU.

**Architecture:** A second Blender build (`tools/blender/build_kit.py` → `aslanair/kit.py`) makes `public/models/cabin-kit.glb`: geometry only, in local frames (seat, bin section, exit sign) or cabin coordinates (galley, curtain), plus `cabin-kit.meta.json`. On the web a pure module `src/experience/cabinLayout.ts` places every part (instance matrices, boxes for clearance tests); components instance the kit geometry with materials defined in TypeScript (fabric gets a procedural weave normal map). The aircraft meta gains the liner grid and the over-wing exit stations, so tests can check that seats and bins fit the hull and that extra-legroom rows sit at the exits.

**Tech Stack:** as in Plans 1–2 (Blender 5.2.2 headless Python + `unittest`, gltf-transform 4.5.1 meshopt, Next 16.4.2, R3F 9.8.2, drei 10.7.9 `useGLTF`, three 0.186.1 `InstancedMesh`, Vitest 5.0.5, Playwright 1.64.1).

**Spec:** `docs/superpowers/specs/2026-10-22-aslanair-design.md` — §5 "Салон" (seats via instancing, bins, ceiling panels with light, entry zone with galley wall and curtain, signs; no cockpit or lavatories), §4.2 (realistic daytime cabin, fabric, matte plastic, soft light), §4.3 (availability on headrest covers, hover glow, selected navy with accent outline, extra legroom at the exit rows), §2 (45+ fps on integrated graphics).

**Carried over from the Plan 2 review** (deferred minors that belong to the cabin): extra-legroom rows no longer at the over-wing exits; bulkheads smooth-shaded with the walls; cabin point lights reaching the wing root; ≤1 mm shell–floor seams after quantization; sun hatching on the upper wall; stale Python row-fit test; livery window/exit literals; Door1L closed position read from the cached scene; door clearance box not conservative.

## Global Constraints

- Free assets only. All furnishing geometry is procedural (Blender Python); fabric and plastic detail is procedural (no downloaded textures). No cockpit, no lavatory interiors.
- Coordinates as in Plan 2: three.js x = 18.8 − station (nose +X), y up, port = −Z. Kit parts are authored in Blender and exported Y-up, so in three.js: a seat faces +X with its origin on the floor under the seat centre; a bin section's origin is at its centre station, y = 0, z = 0.
- Upholstery is the same on every seat: `#3d4658`. Availability is on the headrest cover only: free `#3aa6a0`, extra legroom `#d4683a`, occupied cover `#b9bec6` and upholstery ×0.75, hovered cover `#6fd3cc` plus a soft glow, selected cover `#1b2541` plus a terracotta `#d4683a` outline. Curtain navy `#1b2541`; plastics warm off-white `#e9e6df`.
- Extra legroom = row 1 and the rows nearest the over-wing exits (stations 16.05 and 16.80 → rows 13 and 14).
- `public/models/cabin-kit.glb` ≤ 400 KB; one seat ≤ 1 500 triangles; bin section ≤ 600; the airliner GLB budget (≤ 120 000 triangles, ≤ 1.5 MB) is unchanged.
- The walking camera (whole pre track) stays ≥ 0.3 m from every furnishing box; the seated eye stays ≥ 0.05 m clear of its own seat.
- Bins may pass behind the liner in the tail taper but never through the hull (liner + 0.10 m).
- Only exterior parts cast sun shadows (fuselage, wings, tail, engines, Door1L); cabin parts receive only. The visible light count never changes at runtime.
- Aisle view ≥ 45 fps median in the Playwright browser (the spec's integrated-GPU target).
- Node names the site relies on — airliner: as in Plan 2; kit: `SeatFabric`, `SeatShell`, `SeatCover`, `SeatArm`, `SeatLegs`, `BinPort`, `BinStarboard`, `GalleyPanels`, `GalleySteel`, `GalleyWorktop`, `Curtain`, `ExitSign`.
- Values shared between Blender and the web live in `tools/blender/aslanair/geometry.py` and are mirrored in `src/experience/geometry.ts` / `cabinLayout.ts`; the meta files are the bridge and tests keep them equal.
- All user-facing strings (row labels' format, sign text) live in `src/content/copy.ts`.

## Review Focus

- Hovering and clicking the new seat model picks the seat under the pointer, never its neighbour (hit proxies match the visible seats; scan test + highlight-position test in Tasks 3–4).
- The door flight and the aisle walk never clip into bins, galley, curtain, signs or row-1 seats (clearance test over the whole pre track, Task 6).
- Bins in the tail taper never show through the hull from outside (fit test against the liner grid, Task 5).
- The seated view out of the window is not blocked by bins, the seat in front or the visitor's own headrest (sight-line test, Task 6; screenshots, Task 8).
- The furnished cabin holds 45+ fps on the integrated GPU (frame-time probe, Task 8).

---

## File Structure

```
tools/blender/aslanair/geometry.py      + OVERWING_EXITS, SEAT_KIT, BIN, GALLEY, CURTAIN, EXIT_SIGN, FLOOR_TUCK, liner_grid()
tools/blender/aslanair/kit.py           NEW: seat parts, bin sections, galley, curtain, exit sign (bpy)
tools/blender/build_kit.py              NEW: Blender entry for the kit (+ verify_kit budgets)
tools/blender/aslanair/export.py        meta: overwingExits, liner grid, linerInset, wingRoot; export_kit_glb()
tools/blender/aslanair/livery.py        reads WINDOW and OVERWING_EXITS instead of literals
tools/blender/aslanair/cabin.py         bulkhead normals, floor tucked under the wall
tools/gltf.mjs                          NEW: shared Blender-run + gltf-transform optimize
tools/build-aircraft.mjs, tools/build-kit.mjs (NEW)
public/models/cabin-kit.glb, public/models/cabin-kit.meta.json (NEW)
src/experience/geometry.ts              + OVERWING_EXIT_STATIONS
src/experience/seats.ts                 EXTRA_LEGROOM_ROWS from the exits
src/experience/cabinLayout.ts           NEW (pure): kit dims, placements, furnishing boxes, cabin lights
src/content/copy.ts                     + rowLabel(), exit sign text
src/scene/cabin/materials.ts            NEW: cabin materials (fabric weave normal map, plastics)
src/scene/cabin/fabric.ts               NEW (pure): weave normal map texels
src/scene/cabin/Seats.tsx               kit-based instanced seats + hit proxies
src/scene/cabin/SeatHighlight.tsx       NEW: hover glow / selected outline
src/scene/cabin/Bins.tsx                NEW: bins, ceiling light strips, row labels
src/scene/cabin/rowLabels.ts            NEW (pure): label quads + atlas UVs
src/scene/cabin/EntryZone.tsx           NEW: galley, curtain, exit signs
src/scene/cabin/CabinLights.tsx         lights from cabinLayout (short reach)
src/scene/aircraft/Aircraft.tsx         shadow/env policy, door closed position from DOOR_1L.hinge
tests/unit/linerProfile.ts              NEW test util: bilinear liner half-width from the meta grid
tests/unit/cabinLayout.test.ts, tests/unit/fabric.test.ts, tests/unit/rowLabels.test.ts, tests/unit/kitAsset.test.ts (NEW)
tests/e2e/cabin.spec.ts (NEW), tests/e2e/perf.spec.ts (NEW)
```

---

### Task 1: Exit rows and the liner bridge

**Files:**
- Modify: `tools/blender/aslanair/geometry.py`, `tools/blender/aslanair/export.py`, `tools/blender/aslanair/livery.py`, `tools/blender/tests/test_geometry.py`
- Modify: `src/experience/geometry.ts`, `src/experience/seats.ts`
- Create: `tests/unit/linerProfile.ts`
- Modify: `tests/unit/aircraftAsset.test.ts`, `tests/unit/seats.test.ts`
- Rebuild: `public/models/airliner.glb`, `airliner.meta.json`

**Interfaces:**
- Produces (Python): `OVERWING_EXITS = [16.05, 16.80]`; `liner_grid() -> dict` with `stations` (the shell grid stations), `heights` (three.js y from −0.45 to 1.75 in 0.1 m steps) and `halfWidth[i][j]` = `liner_half_width_at(stations[i], heights[j])`, all rounded to 4 decimals.
- Produces (meta): `overwingExits: number[]`, `linerInset: 0.1`, `cabin.liner: {stations, heights, halfWidth}`; `cabin.floorHalfWidth` is removed (the grid replaces it).
- Produces (TS): `OVERWING_EXIT_STATIONS: readonly number[]` in `geometry.ts`; `EXTRA_LEGROOM_ROWS` in `seats.ts` = `[1, ...nearest row to each exit]` → `[1, 13, 14]`; test util `linerHalfWidthAt(meta, station, y): number` (bilinear, throws outside the grid).

- [ ] **Step 1: Write the failing tests**

`tests/unit/seats.test.ts` — the extra-legroom label moves to the exit rows:
```ts
test('extra legroom sits at the over-wing exits', () => {
  expect(EXTRA_LEGROOM_ROWS).toEqual([1, 13, 14]);
  expect(seatLabel(byId('13A'))).toBe('13A · Window · Extra legroom · $69');
  expect(seatLabel(byId('12A'))).toBe('12A · Window · $29');
});
```
`tests/unit/aircraftAsset.test.ts` — replace the `floorHalfWidth` test:
```ts
test('over-wing exits match geometry.ts', () => {
  expect(meta.overwingExits).toEqual([...OVERWING_EXIT_STATIONS]);
});

test('outboard seats stand inside the cabin wall, tail taper included', () => {
  const outboard = SEAT_Z.F + SEAT_FOOTPRINT.width / 2;
  for (let row = 1; row <= ROWS; row++) {
    for (const s of [rowStation(row) - SEAT_FOOTPRINT.depth / 2, rowStation(row) + SEAT_FOOTPRINT.depth / 2]) {
      expect(linerHalfWidthAt(meta, s, FLOOR_Y) - outboard, `row ${row}`).toBeGreaterThanOrEqual(0.02);
    }
  }
});

test('the liner grid covers the cabin floor to ceiling', () => {
  expect(meta.cabin.liner.heights[0]).toBeCloseTo(FLOOR_Y);
  expect(meta.cabin.liner.heights.at(-1)).toBeCloseTo(CEILING_Y);
  expect(linerHalfWidthAt(meta, 15, 0.62)).toBeCloseTo(CABIN_WALL_Z, 3);
  expect(() => linerHalfWidthAt(meta, 40, 0)).toThrow();
});
```
`tools/blender/tests/test_geometry.py` — replace `test_last_rows_fit_inside_the_liner_at_seat_height` (old stations, seat height) with:
```python
def test_overwing_exits_are_beside_rows_13_and_14(self):
    rows = [round((s - 7.0) / 0.76) + 1 for s in OVERWING_EXITS]
    self.assertEqual(rows, [13, 14])

def test_liner_grid_matches_the_liner(self):
    g = liner_grid()
    self.assertAlmostEqual(g['heights'][0], FLOOR_Z)
    i, j = g['stations'].index(15.0), 11
    self.assertAlmostEqual(g['halfWidth'][i][j], round(liner_half_width_at(15.0, g['heights'][j]), 4))
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npm run test:blender` and `npx vitest run tests/unit/seats.test.ts tests/unit/aircraftAsset.test.ts`
Expected: ImportError for `OVERWING_EXITS`/`liner_grid`; Vitest fails on `[1, 12, 13]` and on missing `meta.overwingExits` / `linerProfile` module.

- [ ] **Step 3: Implement**

`OVERWING_EXITS` and `liner_grid()` in `geometry.py`; `export.py` writes the new meta keys (sorted, deterministic) and drops `floorHalfWidth`; `livery.py` paints the over-wing exit outlines from `OVERWING_EXITS` and the window frame rings from `WINDOW` (no literals); `OVERWING_EXIT_STATIONS` in `geometry.ts`; `EXTRA_LEGROOM_ROWS` computed from it (nearest `rowStation`); `tests/unit/linerProfile.ts`. Run `npm run build:aircraft`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test && npm run test:blender`
Expected: PASS. The livery render is unchanged (a `--renders side` build shows the same exits and window rings).

- [ ] **Step 5: Commit**

```bash
git add tools/blender src/experience tests/unit public/models
git commit -m "feat: extra legroom at the over-wing exits; liner grid in the meta"
```

---

### Task 2: Cabin kit pipeline and the seat model

**Files:**
- Modify: `tools/blender/aslanair/geometry.py` (`SEAT_KIT`)
- Create: `tools/blender/aslanair/kit.py`, `tools/blender/build_kit.py`, `tools/gltf.mjs`, `tools/build-kit.mjs`
- Modify: `tools/build-aircraft.mjs` (uses `tools/gltf.mjs`), `tools/blender/aslanair/export.py` (`export_kit_glb`), `package.json` (`"build:kit": "node tools/build-kit.mjs"`)
- Create: `src/experience/cabinLayout.ts`, `tests/unit/kitAsset.test.ts`, `tests/unit/cabinLayout.test.ts`
- Output: `public/models/cabin-kit.glb`, `public/models/cabin-kit.meta.json`

**Interfaces:**
- Produces (Python): `SEAT_KIT = {'depth': 0.5, 'width': 0.44, 'pan_top': 0.45, 'arm_top': 0.65, 'height': 1.08, 'back_front_top_x': -0.30, 'cover_drop': 0.24, 'arm_width': 0.05}` (metres above the floor / along the seat's local +X); `build_seat_parts() -> list[bpy.types.Object]` making `SeatFabric` (pan cushion + backrest front, bevelled and lightly subdivided), `SeatShell` (backrest rear shell with a tray-table outline, pan frame), `SeatCover` (headrest cover draped over the top `cover_drop` metres), `SeatArm` (one armrest centred on local z = −width/2), `SeatLegs` (two leg frames + spreader).
- Produces (meta `cabin-kit.meta.json`): `{ seat: {depth, width, panTop, armTop, height, backFrontTopX}, triangles: {<node>: n} }` (later tasks add `bin`, `galley`, `curtain`, `exitSign`).
- Produces (TS `cabinLayout.ts`): `SEAT_KIT` (camelCase mirror of the meta seat block); `seatMatrices(seats: Seat[]): Matrix4[]` (translation to `seatWorldPosition`); `armMatrices(): Matrix4[]` (240: each seat's −z armrest plus one at the +z end of every triple).
- Node script: `runBlender(script, args)`, `optimize(inGlb, outGlb)` in `tools/gltf.mjs` with the Plan 2 flags (`--compress meshopt --texture-compress webp --texture-size 2048 --simplify false --join-named false --flatten false --instance false --palette false`).

- [ ] **Step 1: Write the failing tests**

`tests/unit/kitAsset.test.ts`:
```ts
const KIT = 'public/models/cabin-kit.glb';
const kit = JSON.parse(readFileSync('public/models/cabin-kit.meta.json', 'utf8'));

test('kit seat matches the site footprint', () => {
  expect(kit.seat).toMatchObject({ depth: SEAT_FOOTPRINT.depth, width: SEAT_FOOTPRINT.width });
  expect(kit.seat).toMatchObject(SEAT_KIT);
});
test('kit keeps the seat nodes and fits its budget', () => {
  for (const n of ['SeatFabric', 'SeatShell', 'SeatCover', 'SeatArm', 'SeatLegs']) expect(glbNodeNames(KIT)).toContain(n);
  const seatTris = ['SeatFabric', 'SeatShell', 'SeatCover', 'SeatArm', 'SeatLegs'].reduce((t, n) => t + kit.triangles[n], 0);
  expect(seatTris).toBeLessThanOrEqual(1500);
  expect(statSync(KIT).size).toBeLessThanOrEqual(400_000);
});
```
`tests/unit/cabinLayout.test.ts`:
```ts
test('the seated eye clears its own seat', () => {
  expect(EYE_SEATED - FLOOR_Y - SEAT_KIT.height).toBeGreaterThanOrEqual(0.05);
  expect(-SEATED_EYE_AFT - SEAT_KIT.backFrontTopX).toBeGreaterThanOrEqual(0.1);
});
test('one armrest per seat plus one at the end of every triple', () => {
  const arms = armMatrices().map((m) => new Vector3().setFromMatrixPosition(m));
  expect(arms).toHaveLength(240);
  expect(arms.filter((p) => Math.abs(p.x - rowX(1)) < 1e-6).map((p) => +p.z.toFixed(2)).sort((a, b) => a - b))
    .toEqual([-1.64, -1.18, -0.7, -0.22, 0.24, 0.72, 1.2, 1.64]);
});
```
(The starboard triple's armrests are D −z 0.24, E 0.72, F 1.20 and the end one at 1.64.)

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run tests/unit/kitAsset.test.ts tests/unit/cabinLayout.test.ts`
Expected: FAIL — no `cabin-kit.meta.json`, no `cabinLayout` module.

- [ ] **Step 3: Implement**

`kit.py` builds the seat from bevelled boxes and a profiled backrest (recline 12°), applies modifiers, and keeps every part ≤ the seat budget. `build_kit.py` mirrors `build.py` (args `--out`, `--renders seat`), runs `verify_kit()` (exits non-zero over budget) and `export_kit_glb()` (GLB + `cabin-kit.meta.json`, sorted keys, triangle counts per node). Factor Blender-run + optimize out of `build-aircraft.mjs` into `tools/gltf.mjs`; `build-kit.mjs` uses it. `cabinLayout.ts` mirrors `SEAT_KIT` and builds the matrices. Run `npm run build:kit` and `npm run build:aircraft` (still byte-identical meta).

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS. A Cycles render `--renders seat` (front ¾ and rear ¾) is viewed: cushions read as upholstered, the cover drapes over the top, the tray-table outline is on the rear shell.

- [ ] **Step 5: Commit**

```bash
git add tools package.json public/models src/experience/cabinLayout.ts tests/unit
git commit -m "feat: cabin kit pipeline with a real seat model"
```

---

### Task 3: Seats on the web from the kit

**Files:**
- Create: `src/scene/cabin/fabric.ts`, `src/scene/cabin/materials.ts`, `tests/unit/fabric.test.ts`, `tests/e2e/cabin.spec.ts`
- Modify: `src/scene/cabin/Seats.tsx` (`SEAT_FOOTPRINT` stays in `geometry.ts`; the kit test keeps it equal to the kit seat)

**Interfaces:**
- Consumes: `seatMatrices`, `armMatrices`, `SEAT_KIT` (Task 2); `SEAT_COLORS`, `seatVisual` (Plan 1).
- Produces: `weaveNormals(size: number, period: number): Uint8Array` (RGBA, tangent-space normals of a twill weave, tiles every `period` texels); `cabinMaterials()` returning `{ fabric, shell, cover, arm, legs }` (fabric: `#3d4658`, roughness 0.95, `normalMap` from `weaveNormals(256, 16)` repeated ×6; shell/arm: `#e9e6df`/`#5b6070` plastics; legs: metal 0.8). Seats render one `InstancedMesh` per kit part (names = node names, `SeatArm` count 240, others 180) and an invisible `SeatHit` instanced box (depth × height × width of `SEAT_KIT`) that owns hover/click.

- [ ] **Step 1: Write the failing tests**

`tests/unit/fabric.test.ts`:
```ts
test('weave texels are unit normals tilted around +Z', () => {
  const t = weaveNormals(64, 16);
  for (let i = 0; i < 64 * 64; i++) {
    const [x, y, z] = [0, 1, 2].map((k) => t[i * 4 + k] / 127.5 - 1);
    expect(Math.hypot(x, y, z)).toBeCloseTo(1, 1);
    expect(z).toBeGreaterThan(0.7);
  }
});
test('the weave tiles every period texels', () => {
  const t = weaveNormals(64, 16);
  for (let y = 0; y < 64; y++) for (let x = 0; x < 48; x++)
    expect(t.subarray((y * 64 + x) * 4, (y * 64 + x) * 4 + 3)).toEqual(t.subarray((y * 64 + x + 16) * 4, (y * 64 + x + 16) * 4 + 3));
});
```
`tests/e2e/cabin.spec.ts`:
```ts
test('seats are the kit model, one instance per seat', async ({ page }) => {
  await page.goto('/'); await waitForStore(page); await waitForAircraft(page);
  await page.waitForFunction(() => !!window.__aslan?.scene?.getObjectByName('SeatFabric'));
  const counts = await page.evaluate(() => Object.fromEntries(
    ['SeatFabric', 'SeatShell', 'SeatCover', 'SeatArm', 'SeatLegs', 'SeatHit'].map((n) => [n, (window.__aslan.scene.getObjectByName(n) as InstancedMesh).count])));
  expect(counts).toEqual({ SeatFabric: 180, SeatShell: 180, SeatCover: 180, SeatArm: 240, SeatLegs: 180, SeatHit: 180 });
});
```
(Declare the `__aslan` window type in the spec file the way `aircraft.spec.ts` does.)

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run tests/unit/fabric.test.ts` and `npx playwright test tests/e2e/cabin.spec.ts`
Expected: FAIL — no `fabric` module; no `SeatFabric` object.

- [ ] **Step 3: Implement**

`Seats.tsx` loads the kit with `useGLTF('/models/cabin-kit.glb')` (preloaded), takes each part's geometry by node name, and keeps the existing pointer logic on `SeatHit` (`interactive()`, re-raycast while walking, clear outside the aisle). Covers get `SEAT_COLORS[seatVisual(...)]`; occupied seats multiply the fabric instance colour by 0.75. Everything stays inside `<Aircraft>` so it rides the bob and fly-away.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test && npm run e2e`
Expected: PASS, including Plan 1's `seats.spec.ts` scan test and `journey.spec.ts`. Aisle screenshot viewed: rows of upholstered seats, covers coloured.

- [ ] **Step 5: Commit**

```bash
git add src/scene/cabin src/experience tests
git commit -m "feat: real instanced seats with fabric and availability covers"
```

---

### Task 4: Hover glow and selected outline

**Files:**
- Create: `src/scene/cabin/SeatHighlight.tsx`
- Modify: `src/scene/Experience.tsx` (mount inside `<Aircraft>`), `tests/e2e/cabin.spec.ts`, `tests/e2e/helpers.ts`, `tests/e2e/seats.spec.ts` (uses the moved scan helper)

**Interfaces:**
- Consumes: kit `SeatFabric` + `SeatCover` geometries, store `hoveredSeatId`/`selectedSeatId`/`phase`, `seatWorldPosition`.
- Produces (test helpers): `scanForHoveredSeat(page): Promise<{ id: string; x: number; y: number }>` (the pointer grid scan from `seats.spec.ts`, moved; returns the seat and the pointer position); `highlightState(page): Promise<{ visible: boolean; x: number; z: number; color: string }>` (reads the `SeatHighlight` object's world position and material colour as `#rrggbb`).
- Produces: object `SeatHighlight` — the seat's fabric+cover geometry drawn back-face only, scaled ×1.04 about the seat's centre, additive, no depth write; teal `#6fd3cc` at opacity 0.55 pulsing ±0.15 at 1.2 Hz when hovered; terracotta `#d4683a` steady at 0.8 when selected (seated / confirmed); hidden otherwise and outside the cabin.

- [ ] **Step 1: Write the failing test**

```ts
import { seatWorldPosition, type SeatLetter } from '@/experience/geometry';

test('the highlight sits on the hovered seat, then marks the chosen one', async ({ page }) => {
  await page.goto('/'); await waitForStore(page);
  for (let i = 0; i < 4; i++) await page.mouse.wheel(0, 600);
  await settledProgress(page);
  const hit = await scanForHoveredSeat(page);
  const [x, , z] = seatWorldPosition(Number(hit.id.slice(0, -1)), hit.id.at(-1) as SeatLetter);
  const hl = await highlightState(page);
  expect(hl).toMatchObject({ visible: true, color: '#6fd3cc' });
  expect(hl.x).toBeCloseTo(x, 2);
  expect(hl.z).toBeCloseTo(z, 2);
  await page.mouse.click(hit.x, hit.y);
  await expect.poll(() => highlightState(page)).toMatchObject({ visible: true, color: '#d4683a' });
});
```
(The highlight lives inside the `Aircraft` group, which is at rest in the aisle, so its world position equals the seat's cabin position.)

- [ ] **Step 2: Run it to verify it fails**

Run: `npx playwright test tests/e2e/cabin.spec.ts -g highlight`
Expected: FAIL — no `SeatHighlight` object.

- [ ] **Step 3: Implement `SeatHighlight.tsx`**

One merged geometry (fabric + cover) built once; position/colour/opacity set in `useFrame` from the store. `renderOrder` after the seats; `raycast` disabled.

- [ ] **Step 4: Run it to verify it passes, then the whole suite**

Run: `npx playwright test tests/e2e/cabin.spec.ts && npm test && npm run e2e`
Expected: PASS. Screenshot of a hovered seat and a seated view viewed: soft rim, not a solid blob.

- [ ] **Step 5: Commit**

```bash
git add src/scene tests/e2e
git commit -m "feat: hover glow and selected outline on seats"
```

---

### Task 5: Overhead bins, ceiling light strips and row labels

**Files:**
- Modify: `tools/blender/aslanair/geometry.py` (`BIN`), `tools/blender/aslanair/kit.py` (`build_bins()`), `tools/blender/aslanair/export.py` (kit meta `bin`)
- Modify: `src/experience/cabinLayout.ts`, `src/content/copy.ts`
- Create: `src/scene/cabin/Bins.tsx`, `src/scene/cabin/rowLabels.ts`, `tests/unit/rowLabels.test.ts`
- Modify: `tests/unit/kitAsset.test.ts`, `tests/unit/cabinLayout.test.ts`, `src/scene/Experience.tsx`

**Interfaces:**
- Produces (Python): `BIN = {'length': 0.76, 'bottom_y': 1.10, 'aisle_z': 0.98, 'wall_gap': 0.02, 'door_bulge': 0.03}`; `build_bins()` makes `BinPort` and `BinStarboard` (one row long, origin at the section centre; the outer face follows `liner_half_width_at(15.0, y) − wall_gap`; underside has a PSU strip with three reading-light discs per seat group and a vent; door seam at both ends). Meta `bin: {length, bottomY, aisleZ, profile: [[z, y], ...]}` (port side, |z|).
- Produces (TS): `BIN` mirror; `binMatrices(side: -1 | 1): Matrix4[]` (30 per side, centred on `rowX(row)`); `CEILING_STRIPS` (two emissive strips at |z| 0.86–0.94, y = CEILING_Y − 0.005, from row 1 to row 30); `rowLabelQuads(): { position: Float32Array; uv: Float32Array; index: Uint16Array }` — 60 quads (rows 1–30 × both sides), 0.24 × 0.06 m, on the bin underside 0.06 m outboard of `aisleZ`, tilted 35° towards the aisle; UVs into a 1024 × 512 atlas of 8 × 8 cells (128 × 64 px), cell index = (row − 1) × 2 + (side > 0 ? 1 : 0); each cell draws the row label plus lit fasten-seatbelt and no-smoking pictograms (the spec's «табло», whose chime Plan 4 plays on seat choice); `binBoxes(): Box3[]` (60 bin sections, profile bounding boxes); `distanceToBoxes(p: Vector3, boxes: Box3[]): number`; `copy.cabin.rowLabel(row, side)` → `'14 ABC'` / `'14 DEF'`.

- [ ] **Step 1: Write the failing tests**

`tests/unit/kitAsset.test.ts`:
```ts
test('bins stay inside the hull along the whole cabin, tail taper included', () => {
  const inset = aircraftMeta.linerInset;
  for (let row = 1; row <= ROWS; row++)
    for (const s of [rowStation(row) - kit.bin.length / 2, rowStation(row), rowStation(row) + kit.bin.length / 2])
      for (const [z, y] of kit.bin.profile)
        expect(z, `row ${row} y ${y}`).toBeLessThanOrEqual(linerHalfWidthAt(aircraftMeta, s, y) + inset - 0.01);
});
test('bin section matches cabinLayout and its budget', () => {
  expect(kit.bin).toMatchObject({ length: BIN.length, bottomY: BIN.bottomY, aisleZ: BIN.aisleZ });
  expect(kit.triangles.BinPort).toBeLessThanOrEqual(600);
});
```
`tests/unit/rowLabels.test.ts`:
```ts
test('one label per row and side, each with its own atlas cell', () => {
  const q = rowLabelQuads();
  expect(q.position.length / 12).toBe(60);
  const cells = new Set<string>();
  for (let i = 0; i < 60; i++) cells.add(Array.from(q.uv.subarray(i * 8, i * 8 + 8)).map((v) => v.toFixed(4)).join());
  expect(cells.size).toBe(60);
  expect(Math.min(...q.uv)).toBeGreaterThanOrEqual(0); expect(Math.max(...q.uv)).toBeLessThanOrEqual(1);
});
test('labels read 14 ABC on the port side and 14 DEF on the starboard side', () => {
  expect(copy.cabin.rowLabel(14, -1)).toBe('14 ABC');
  expect(copy.cabin.rowLabel(14, 1)).toBe('14 DEF');
});
```
`tests/unit/cabinLayout.test.ts`:
```ts
test('the walking camera keeps clear of the bins', () => {
  for (let i = 0; i <= 2000; i++) {
    const cam = poseOnPreTrack(i / 2000).position;
    expect(distanceToBoxes(cam, binBoxes()), `p=${i / 2000}`).toBeGreaterThanOrEqual(0.3);
  }
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run tests/unit/kitAsset.test.ts tests/unit/rowLabels.test.ts tests/unit/cabinLayout.test.ts`
Expected: FAIL — no `kit.bin`, no `rowLabels` module, no `binBoxes`.

- [ ] **Step 3: Implement**

Kit bins in Blender; `npm run build:kit`. `Bins.tsx` instances `BinPort`/`BinStarboard`, draws the two emissive ceiling strips (warm `#fff1dc`, `toneMapped` on) and the row labels as one mesh with a `CanvasTexture` atlas drawn from `copy.cabin.rowLabel`. `cabinLayout.ts` adds `binBoxes()` and `distanceToBoxes()`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test && npm run e2e`
Expected: PASS. Aisle screenshot viewed: bins frame the view, row numbers and seatbelt/no-smoking signs readable above each row, light strips glow along the ceiling.

- [ ] **Step 5: Commit**

```bash
git add tools/blender src public/models tests
git commit -m "feat: overhead bins with row labels and ceiling light strips"
```

---

### Task 6: Entry zone and exit signs

**Files:**
- Modify: `tools/blender/aslanair/geometry.py` (`GALLEY`, `CURTAIN`, `EXIT_SIGN`), `tools/blender/aslanair/kit.py` (`build_galley()`, `build_curtain()`, `build_exit_sign()`), `tools/blender/aslanair/export.py`
- Modify: `src/experience/cabinLayout.ts`, `src/content/copy.ts`
- Create: `src/scene/cabin/EntryZone.tsx`
- Modify: `tests/unit/cabinLayout.test.ts`, `tests/unit/kitAsset.test.ts`, `src/scene/Experience.tsx`

**Interfaces:**
- Produces (Python, three.js y/z where noted): `GALLEY = {'s0': 4.05, 's1': 5.75, 'inner_z': 0.32, 'top_y': 1.40, 'worktop_y': 0.10}` on the starboard side (outer side follows the liner; cart doors, latches, upper units); `CURTAIN = {'station': 6.45, 'inner_z': 0.62, 'bottom_y': -0.25}` — two drawn-open drapes with pleats, ceiling to `bottom_y`, from |z| = `inner_z` to the wall; `EXIT_SIGN = {'w': 0.30, 'h': 0.11, 'd': 0.05, 'y': 1.58, 'placements': [[5.85, 'aft'], [16.45, 'aft'], [16.45, 'fore'], [30.25, 'fore']]}` (station, facing). Galley and curtain are exported in cabin coordinates; the sign in its own frame.
- Produces (TS): mirrors `GALLEY`, `CURTAIN`, `EXIT_SIGN`; `furnishingBoxes(): Box3[]` (bins, galley, curtains, signs, row-1 seats); `segmentHitsBoxes(a: Vector3, b: Vector3, boxes: Box3[]): boolean`; `copy.cabin.exitSign = 'EXIT'`.

- [ ] **Step 1: Write the failing tests**

`tests/unit/cabinLayout.test.ts`:
```ts
test('the door flight and the aisle walk keep 0.3 m clear of every furnishing', () => {
  const boxes = furnishingBoxes();
  for (let i = 0; i <= 2000; i++) {
    const cam = poseOnPreTrack(i / 2000).position;
    expect(distanceToBoxes(cam, boxes), `p=${i / 2000}`).toBeGreaterThanOrEqual(0.3);
  }
});
test('the seated sight line to the window crosses no furnishing', () => {
  for (const seat of [{ row: 1, letter: 'A' }, { row: 14, letter: 'F' }, { row: 30, letter: 'A' }] as const) {
    const { position: eye } = seatedPose(seat);
    const window = new Vector3(stationToX(seatWindowStation(seat.row)), WINDOW.y, Math.sign(eye.z) * CABIN_WALL_Z);
    expect(segmentHitsBoxes(eye, window, furnishingBoxes()), `${seat.row}${seat.letter}`).toBe(false);
  }
});
test('exit signs hang at door 1L, the over-wing exits and the aft door', () => {
  expect(EXIT_SIGN.placements.map(([s]) => s)).toEqual([5.85, 16.45, 16.45, 30.25]);
});
```
`tests/unit/kitAsset.test.ts`: kit meta `galley`, `curtain`, `exitSign` equal the TS mirrors; nodes `GalleyPanels`, `GalleySteel`, `GalleyWorktop`, `Curtain`, `ExitSign` present; kit ≤ 400 KB still.

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run tests/unit/cabinLayout.test.ts tests/unit/kitAsset.test.ts`
Expected: FAIL — no `furnishingBoxes`, no galley in the kit meta.

- [ ] **Step 3: Implement**

Kit parts in Blender; `npm run build:kit`. `EntryZone.tsx` places galley and curtain as-is and instances `ExitSign` with an emissive canvas face (`copy.cabin.exitSign`, green `#2fbf71` on white). If the clearance test fails, move furnishing, not the camera path (the path is Plan 1's, already reviewed), and ledger the move.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test && npm run e2e`
Expected: PASS. Door-chapter screenshot viewed: through the open door the galley faces the camera; the curtain frames the aisle.

- [ ] **Step 5: Commit**

```bash
git add tools/blender src public/models tests
git commit -m "feat: galley, curtain and exit signs at the entry"
```

---

### Task 7: Cabin light and look

**Files:**
- Modify: `src/experience/cabinLayout.ts` (`CABIN_LIGHTS`), `src/scene/cabin/CabinLights.tsx`, `src/scene/aircraft/Aircraft.tsx`, `src/scene/sky/SkyAndClouds.tsx` (sun shadow settings only if the diagnosis points there)
- Modify: `tools/blender/aslanair/cabin.py` (bulkhead normals, `FLOOR_TUCK`), `tools/blender/build.py` (`verify_cabin_shading` covers bulkheads), `tools/blender/aslanair/export.py` (meta `wingRoot`: three points on the root's upper surface, three.js coords)
- Modify: `tests/unit/cabinLayout.test.ts`, `tests/e2e/cabin.spec.ts`, `tools/blender/tests/test_geometry.py`

**Interfaces:**
- Produces: `CABIN_LIGHTS: { position: [number, number, number]; distance: number; intensity: number }[]` — 8 point lights on the centreline at y = CEILING_Y − 0.1 from station 5.8 to 28.8, `distance` 2.6, decay 2; interior materials (`CabinShell`, `CabinFloor`, `CockpitDoor`, kit parts) `envMapIntensity` 0.35; castShadow only on exterior meshes; `FLOOR_TUCK = 0.005` (floor half-width = liner + tuck).

- [ ] **Step 1: Write the failing tests**

`tests/unit/cabinLayout.test.ts`:
```ts
test('cabin lights reach the aisle floor but never the wing root', () => {
  for (const l of CABIN_LIGHTS) for (const p of aircraftMeta.wingRoot)
    expect(new Vector3(...l.position).distanceTo(new Vector3(...p))).toBeGreaterThan(l.distance);
  for (let s = 6; s <= 29; s += 0.25) {
    const floor = new Vector3(stationToX(s), FLOOR_Y, 0);
    expect(Math.min(...CABIN_LIGHTS.map((l) => new Vector3(...l.position).distanceTo(floor) / l.distance))).toBeLessThan(0.95);
  }
});
```
`tests/e2e/cabin.spec.ts`:
```ts
const CABIN = /^(Cabin|CockpitDoor|Seat|Bin|RowLabels|CeilingStrip|Galley|Curtain|ExitSign|WindowGlass)/;

test('only the exterior casts sun shadows', async ({ page }) => {
  // after waitForAircraft + the kit: collect { name, castShadow } for every mesh
  // expect: Fuselage casts; every mesh whose name matches CABIN does not
});

test('no sun streaks on the upper wall', async ({ page }) => {
  // progress 0.6, 1440×800, settle 2.5 s; crop { x: 200, y: 180, width: 520, height: 280 }
  // energy(png) = mean over pixels of |L(x+1, y) − L(x, y)|, L = 0.2126 R + 0.7152 G + 0.0722 B
  // shot A as is; then set receiveShadow = false on every mesh (+ material.needsUpdate), settle 0.8 s, shot B
  expect(energy(A)).toBeLessThanOrEqual(1.25 * energy(B));
});
```
Decode the PNG crops in the test with `page.evaluate` on a canvas (no new dependency).
`tools/blender/build.py` `verify_cabin_shading()`: bulkhead corners must carry a ±X normal (1° tolerance) — run the build: Expected FAIL ("… bulkhead corners off").

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run tests/unit/cabinLayout.test.ts`, `npx playwright test tests/e2e/cabin.spec.ts`, `npm run build:aircraft`
Expected: FAIL on missing `CABIN_LIGHTS`/`wingRoot`, on cabin meshes casting, on the streak ratio (current value recorded in the ledger), and on bulkhead corners.

- [ ] **Step 3: Implement**

Lights from `CABIN_LIGHTS` (count fixed at 8, so the shader key stays constant). Shadow and env policy in `Aircraft.tsx` (by node name prefix) and in the kit components. Diagnose the streaks with superpowers:systematic-debugging before changing shadow parameters (candidates: normal bias, shadow camera fit to the aircraft, shell receiving through the 10 cm gap); record the cause in the ledger. Bulkhead normals and the floor tuck in `cabin.py`; rebuild the aircraft.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test && npm run test:blender && npm run e2e`
Expected: PASS; `scroll.spec.ts` "the visible light count never changes" still passes. Screenshots viewed: warm, even cabin; wing root seen from 14F has no warm glow.

- [ ] **Step 5: Commit**

```bash
git add src tools public/models tests
git commit -m "feat: cabin light that stays inside, interior shading fixes"
```

---

### Task 8: Frame rate and the review screenshot set

**Files:**
- Create: `tests/e2e/perf.spec.ts`
- Modify: whatever the probe shows is too slow (allowed levers, in order: kit triangle counts, `SeatLegs`/`SeatArm` shadow and env settings, shadow-map size, cloud resolution — no change to the spec's look)

**Interfaces:**
- Produces: `perf.spec.ts` with a frame-time probe (`requestAnimationFrame` deltas over 180 frames after a 1 s warm-up) and a screenshot set in `test-results/cabin/` (`sky`, `door`, `entry`, `aisle`, `aisle-end`, `seat-1A`, `seat-14F`, `seat-30A`, `pass`, `exit`).

- [ ] **Step 1: Write the failing test**

```ts
test('the furnished aisle holds 45 fps', async ({ page }) => {
  // go to progress 0.6, wait for the kit, warm up 1 s, sample 180 rAF deltas
  expect(median(deltas)).toBeLessThanOrEqual(1000 / 45);
});
test('review screenshot set', async ({ page }) => { /* writes the ten shots; asserts each file exists and is non-blank (luminance variance > 0) */ });
```

- [ ] **Step 2: Run it**

Run: `npx playwright test tests/e2e/perf.spec.ts`
Expected: the screenshot test passes; the fps test either passes (record the median in the ledger) or fails with the measured median — then Step 3.

- [ ] **Step 3: Optimise until it passes (only if Step 2 failed)**

One lever at a time, re-measuring after each; ledger each lever with before/after medians.

- [ ] **Step 4: View every screenshot**

Check: seats, bins and labels read as a real cabin; no z-fighting, no see-through, no clipping in any shot; the window views from 1A, 14F, 30A show sky/wing. Fix anything that fails before committing.

- [ ] **Step 5: Commit**

```bash
git add tests/e2e/perf.spec.ts src tools public/models
git commit -m "test: frame-rate probe and review screenshots for the furnished cabin"
```

---

### Task 9: Plan 2 carry-overs

**Files:**
- Modify: `src/scene/aircraft/Aircraft.tsx`, `tests/unit/aircraftAnimation.test.ts`, `tools/blender/aslanair/export.py` (meta `door1L.panelMaxHalfWidth`), `tools/blender/aslanair/hull.py`, `tools/blender/aslanair/lettering.py`, `tools/blender/aslanair/cabin.py`

**Interfaces:**
- Produces: door closed position from `DOOR_1L.hinge` (not from the cached scene); meta `door1L.panelMaxHalfWidth` (max hull half-width over the door rectangle); the door clearance test's box uses it; no UV layer on `CabinShell` and the lettering; the dead `for k in ('lip', 'navy'): pass` loop removed.

- [ ] **Step 1: Write the failing tests**

```ts
test('the moving panel never comes within 0.3 m of the camera at the same moment', () => {
  // as before, but z0 = -meta.door1L.panelMaxHalfWidth (≈ -1.96) instead of hinge - 0.01
});
```
(Expected to still pass on the current path — if it fails, the old box hid a real clearance problem: stop and debug.) The door's closed position switching to `DOOR_1L.hinge` is a refactor with no behaviour change: it is covered by `aircraft.spec.ts` ("door 1L opens as the camera arrives") plus one added assertion that at progress 0 the `Door1L` position equals `DOOR_1L.hinge` to 1e-4 — green before and after.

- [ ] **Step 2: Run them**

Run: `npx vitest run tests/unit/aircraftAnimation.test.ts`; `npx playwright test tests/e2e/aircraft.spec.ts`
Expected: PASS (these guard the refactor).

- [ ] **Step 3: Implement the carry-overs and rebuild the aircraft**

- [ ] **Step 4: Run the whole suite**

Run: `npm test && npm run test:blender && npm run e2e && npm run build`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src tools public/models tests
git commit -m "chore: Plan 2 carry-overs — door closed position, conservative door box, cleanups"
```

---

## Spec coverage (this plan)

| Spec | Where |
|------|-------|
| §5 seats via instancing, each clickable | Tasks 2–3 |
| §4.3 covers carry availability, hover glow, selected navy + accent outline | Tasks 3–4 |
| §4.3 / §6 extra legroom at the exit rows | Task 1 |
| §5 bins, ceiling panels with light | Task 5 |
| §5 entry zone (galley wall, curtain), signs and exit indicators | Task 6 |
| §4.2 realistic daytime cabin: fabric, matte plastic, soft light | Tasks 3, 5, 7 |
| §2 45+ fps on integrated graphics | Task 8 |
| §5 no cockpit / lavatory interiors | not built (by design) |
