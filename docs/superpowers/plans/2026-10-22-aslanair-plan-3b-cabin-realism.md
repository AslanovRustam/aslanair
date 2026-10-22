# AslanAir — Plan 3b: Cabin Realism Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the cabin read as real: seats modelled after the author's reference photos (contoured backs, fabric headrest covers, rounded armrests, seat belts, under-seat frame, printed fabric), a seat card that floats above the hovered seat, a cockpit door and jump seat in the nose that the entry flight turns to look at, an aft galley with lavatories and a cart in the tail, and a patterned carpet with seat tracks — all still at 45+ fps on Intel UHD.

**Architecture:** Same pipeline as Plan 3: Blender kit (`tools/blender/aslanair/kit.py`) for geometry, pure TypeScript for layout, patterns and decisions, thin components for rendering. New pure modules: `fabricPrint.ts`, `carpet.ts` (texture texels), `seatCard.ts` (card content and tap logic). The seat card uses drei `<Html>` anchored to the seat. The floor gets UVs and a plinth from `cabin.py`; seat tracks are TypeScript geometry.

**Tech Stack:** as in Plan 3 (Blender 5.2.2 Python + unittest, gltf-transform 4.5.1, Next 16.4.2, R3F 9.8.2, drei 10.7.9 `Html`, three 0.186.1, Vitest 5.0.5, Playwright 1.64.1).

**Spec:** `docs/superpowers/specs/2026-10-22-aslanair-design-r2-night.md` §7 (7.1 seats, 7.2 seat card, 7.3 tail, 7.4 nose, 7.5 floor) and §9; base spec `docs/superpowers/specs/2026-10-22-aslanair-design.md` §4.3, §5.

**Starts from:** branch `feat/plan-3-cabin` (Plan 3, not yet merged). Lighting stays as Plan 3 left it — the night look is Plan 4.

## Global Constraints

- Free assets only; all geometry procedural (Blender Python) and all textures procedural (TypeScript-generated texels).
- `SEAT_KIT` dimensions and `SEAT_FOOTPRINT` are unchanged (the layout, fit and pick tests depend on them).
- One seat (fabric + shell + cover + one arm + legs + belt + buckle) ≤ 3 000 triangles; `cabin-kit.glb` ≤ 600 KB; airliner GLB budget unchanged.
- Seat picking stays ≤ 2 % mismatch (`the seat under the pointer is the seat you see`).
- The walking camera keeps ≥ 0.3 m from every furnishing box; camera poses stay continuous at every chapter boundary.
- Frame-rate gate unchanged: the `perf` project (integrated GPU) — door, aisle, seat, pass — median and mean ≤ 22.2 ms.
- Furnishing materials use `withCabinLight(m, { sun: false })`; no point lights.
- Availability colours stay on the headrest covers (spec §4.3); occupied seats: upholstery ×0.75.
- All user-facing strings in `src/content/copy.ts` (card labels, sign text).

## Review Focus

- The seat card stays attached to its seat while the camera walks, never covers the seat it describes, and never lingers after the pointer leaves (e2e card position + leave test, Task 3).
- On a touch screen the first tap shows the card and only the second tap sits (e2e with `hasTouch`, Task 3).
- The entry flight looks at the cockpit door and still hands over smoothly to the aisle (pose continuity + in-view test, Task 5).
- The detailed seats keep picking accurate and the cabin at 45+ fps (pick test, perf project, Tasks 1 and 7).
- The aft galley and the cart fit inside the tail taper and clear row 30 (fit + clearance tests, Task 6).

---

## File Structure

```
tools/blender/aslanair/geometry.py     + SEAT_PROFILE (pure section helpers), COCKPIT_DOOR, JUMP_SEAT, AFT_GALLEY, LAVATORY, GALLEY_CART, PLINTH
tools/blender/aslanair/kit.py          seat v2; cockpit door, jump seat, aft galley, lavatories, cart
tools/blender/aslanair/cabin.py        floor UVs (metres); CabinPlinth; the old CockpitDoor plane removed
tools/blender/aslanair/export.py       kit meta: cockpitDoor, jumpSeat, aftGalley, lavatory, galleyCart
src/experience/cabinLayout.ts          mirrors; furnishingBoxes += nose and tail parts; SEAT_TRACK_Z
src/experience/seatCard.ts             NEW (pure): seatCardContent(), tapAction()
src/experience/cameraPoses.ts          door chapter: the cockpit-door look
src/scene/cabin/fabricPrint.ts         NEW (pure): printed upholstery texels
src/scene/cabin/carpet.ts              NEW (pure): carpet and aisle-runner texels
src/scene/cabin/materials.ts           print map, belt/buckle, carpet materials
src/scene/cabin/Seats.tsx              + SeatBelt, SeatBuckle; touch tap logic
src/scene/cabin/SeatCard.tsx           NEW: drei Html card over the hovered seat
src/scene/cabin/FloorDetails.tsx       NEW: seat tracks; carpet maps on CabinFloor
src/scene/cabin/EntryZone.tsx          + cockpit door, jump seat; arrow exit sign
src/scene/cabin/TailZone.tsx           NEW: aft galley, lavatories, cart
src/ui/Overlay.tsx                     the cursor tooltip removed
src/content/copy.ts                    seat card copy, arrow exit sign
tests/unit/seatCard.test.ts, fabricPrint.test.ts, carpet.test.ts (NEW); cabinLayout/kitAsset/cameraPoses tests extended
tests/e2e/seatCard.spec.ts (NEW); cabin.spec.ts, perf.spec.ts extended
```

---

### Task 1: Seat model v2

**Files:**
- Modify: `tools/blender/aslanair/geometry.py`, `tools/blender/aslanair/kit.py`, `tools/blender/tests/test_geometry.py`, `tests/unit/kitAsset.test.ts`
- Rebuild: `public/models/cabin-kit.glb`, `cabin-kit.meta.json`

**Interfaces:**
- Produces (pure Python, `geometry.py`): `backrest_section(t: float) -> list[tuple[float, float]]` — the backrest's front surface across its width at height fraction `t` ∈ [0, 1], as (lateral, depth) points from −width/2 to +width/2: side bolsters stand ≥ 0.025 m proud of the centre, the centre bulges forward by `lumbar(t)` (peak ≥ 0.02 m near t = 0.3); `cushion_section(u)` — the seat pan's profile along its depth with a rolled front lip.
- Produces (kit nodes, same names plus two): `SeatFabric` (lofted backrest with bolsters and lumbar, rounded top; pan cushion with front lip), `SeatShell` (rear shell with tray table, latch and literature pocket; pan frame), `SeatCover` (fabric cover draped over the top of the backrest), `SeatArm` (rounded arm with an end cap and a hinge block), `SeatLegs` (leg frames, spreaders, floor feet), `SeatBelt` (two straps lying on the cushion), `SeatBuckle` (metal buckle plate). Origin and facing as before.

- [ ] **Step 1: Write the failing tests**

`tools/blender/tests/test_geometry.py`:
```python
class SeatProfileTest(unittest.TestCase):
    def test_bolsters_stand_proud_of_the_centre(self):
        for t in (0.2, 0.5, 0.8):
            sec = backrest_section(t)
            centre = min(sec, key=lambda p: abs(p[0]))[1]
            self.assertGreater(max(sec[0][1], sec[-1][1]) - centre, 0.025)

    def test_lumbar_bulges_low_on_the_back(self):
        self.assertGreater(lumbar(0.3), 0.02)
        self.assertGreater(lumbar(0.3), lumbar(0.8))

    def test_cushion_has_a_rolled_front_lip(self):
        front = cushion_section(1.0)
        self.assertLess(front[-1][1], front[-2][1])   # the top falls away at the lip
```
`tests/unit/kitAsset.test.ts`:
```ts
const SEAT_PARTS = ['SeatFabric', 'SeatShell', 'SeatCover', 'SeatArm', 'SeatLegs', 'SeatBelt', 'SeatBuckle'];
// 'kit keeps the seat nodes and fits its budget': every SEAT_PARTS node present, sum ≤ 3000, kit ≤ 600_000 bytes
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npm run test:blender`, `npx vitest run tests/unit/kitAsset.test.ts`
Expected: ImportError for `backrest_section`; Vitest fails on missing `SeatBelt`.

- [ ] **Step 3: Implement**

Loft the backrest from `backrest_section` at ~10 heights (recline as now, rounded top), the cushion from `cushion_section`; shell, arm, legs, belt and buckle as bevelled solids. Keep the cover the drape it is now, following the new backrest top. `npm run build:kit -- --renders seat`.

- [ ] **Step 4: Run tests and view the renders**

Run: `npm test && npm run test:blender && npx playwright test tests/e2e/cabin.spec.ts`
Expected: PASS, including `the seat under the pointer is the seat you see` (picking uses the new shape). View `tools/blender/out/renders/seat-front.png` / `seat-rear.png` beside the reference photos (contoured back, cover over the top, rounded arms, belts, frame). Iterate the model until it reads as an airliner seat, not a box.

- [ ] **Step 5: Commit**

```bash
git add tools/blender public/models tests
git commit -m "feat: seat model v2 — contoured back, cover, rounded arms, belts, frame"
```

---

### Task 2: Seat look

**Files:**
- Create: `src/scene/cabin/fabricPrint.ts`, `tests/unit/fabricPrint.test.ts`
- Modify: `src/scene/cabin/materials.ts`, `src/scene/cabin/Seats.tsx`, `tests/e2e/cabin.spec.ts`

**Interfaces:**
- Produces: `fabricPrint(size: number, seed: number): Uint8Array` — RGBA sRGB texels of a navy upholstery print (base `#25356b`-ish, small light flecks and short thin strokes as in the second reference photo), tiles seamlessly, deterministic per seed; materials: fabric `map` = print (repeat in metres like the weave) with the weave normal map kept, colour white so instance colours still dim occupied seats; `belt` (`#9a2f35`, matte), `buckle` (metal, rough 0.25); arms light grey plastic `#d9d8d3`. `Seats.tsx` instances `SeatBelt` and `SeatBuckle` (180 each).

- [ ] **Step 1: Write the failing tests**

```ts
test('the print is deterministic and stays navy', () => {
  const t = fabricPrint(128, 7);
  expect(fabricPrint(128, 7)).toEqual(t);
  let r = 0, g = 0, b = 0;
  for (let i = 0; i < t.length; i += 4) { r += t[i]; g += t[i + 1]; b += t[i + 2]; }
  expect(b).toBeGreaterThan(r * 1.3);                 // blue dominates
  expect(b / (t.length / 4)).toBeLessThan(170);       // and stays dark
});
test('the print wraps without a seam', () => {
  const t = fabricPrint(128, 7);
  const col = (x: number) => Array.from({ length: 128 }, (_, y) => t[(y * 128 + x) * 4 + 2]);
  const diff = (a: number[], b: number[]) => a.reduce((s, v, i) => s + Math.abs(v - b[i]), 0) / a.length;
  expect(diff(col(127), col(0))).toBeLessThanOrEqual(diff(col(63), col(64)) + 4);
});
```
e2e (`cabin.spec.ts`): `SeatBelt` and `SeatBuckle` instanced counts are 180; the `SeatFabric` material has a `map`.

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run tests/unit/fabricPrint.test.ts`, `npx playwright test tests/e2e/cabin.spec.ts -g "kit model"`
Expected: FAIL — module and nodes missing.

- [ ] **Step 3: Implement**

- [ ] **Step 4: Run tests to verify they pass; view an aisle and a close seat screenshot beside the reference photos**

Run: `npm test && npm run e2e`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src tests
git commit -m "feat: printed upholstery, seat belts and buckles"
```

---

### Task 3: Seat card over the hovered seat

**Files:**
- Create: `src/experience/seatCard.ts`, `src/scene/cabin/SeatCard.tsx`, `tests/unit/seatCard.test.ts`, `tests/e2e/seatCard.spec.ts`
- Modify: `src/ui/Overlay.tsx` (tooltip removed), `src/ui/ui.module.css`, `src/scene/cabin/Seats.tsx` (touch tap), `src/scene/Experience.tsx`, `src/content/copy.ts`

**Interfaces:**
- Produces (pure): `seatCardContent(seat: Seat, pointer: 'mouse' | 'touch'): { number: string; kind: string; price: string; extra: boolean; hint: string }` — e.g. `{ number: '14C', kind: 'Aisle seat', price: '$25', extra: false, hint: 'Click to sit' }`, touch hint `'Tap again to sit'`; `tapAction(pointer: 'mouse' | 'touch', hoveredId: string | null, id: string): 'focus' | 'sit'` — mouse always sits; touch sits only when `id` is already the hovered (focused) seat.
- Produces: `SeatCard` — drei `<Html>` at `seatWorldPosition + (0, SEAT_KIT.height + 0.28, 0)`, centred, pointer-events none; a dark translucent card (backdrop blur, terracotta accent line, thin pointer line down to the seat), big seat number, kind, price, "Extra legroom" badge, hint; fades/rises in over 180 ms; `data-testid="seat-card"`. Shown only while a seat is hovered in the aisle chapter.

- [ ] **Step 1: Write the failing tests**

```ts
test('card content reads like a boarding desk', () => {
  expect(seatCardContent(byId('14C'), 'mouse')).toEqual({ number: '14C', kind: 'Aisle seat', price: '$25', extra: false, hint: 'Click to sit' });
  expect(seatCardContent(byId('13A'), 'touch')).toMatchObject({ kind: 'Window seat', price: '$69', extra: true, hint: 'Tap again to sit' });
});
test('a first tap focuses, a second tap sits; a click always sits', () => {
  expect(tapAction('touch', null, '14C')).toBe('focus');
  expect(tapAction('touch', '14C', '14C')).toBe('sit');
  expect(tapAction('touch', '14B', '14C')).toBe('focus');
  expect(tapAction('mouse', null, '14C')).toBe('sit');
});
```
`tests/e2e/seatCard.spec.ts`:
```ts
test('the card floats above the hovered seat and follows it', async ({ page }) => {
  // walk into the aisle, scanForHoveredSeat; card visible, contains the seat id and its price;
  // project the anchor (R3F camera via SeatHit.__r3f.root.getState()) → card's bottom centre within 40 px of it, above it
  // move the pointer away → card hidden within 400 ms
});
test('touch: first tap shows the card, second tap sits', async ({ browser }) => {
  // context with hasTouch; tap-scan until a card shows (phase still browse); tap the same point → phase 'seated'
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run tests/unit/seatCard.test.ts`, `npx playwright test tests/e2e/seatCard.spec.ts`
Expected: FAIL.

- [ ] **Step 3: Implement** (remove the cursor tooltip from `Overlay.tsx`; `Seats.onClick` asks `tapAction` with `e.nativeEvent.pointerType`)

- [ ] **Step 4: Run tests to verify they pass; view a hovered-seat screenshot**

Run: `npm test && npm run e2e`
Expected: PASS (Plan 1 and 3 seat tests unchanged).

- [ ] **Step 5: Commit**

```bash
git add src tests
git commit -m "feat: seat card floating above the hovered seat; tap twice to sit on touch"
```

---

### Task 4: Floor, seat tracks and plinth

**Files:**
- Create: `src/scene/cabin/carpet.ts`, `src/scene/cabin/FloorDetails.tsx`, `tests/unit/carpet.test.ts`
- Modify: `tools/blender/aslanair/cabin.py` (floor UVs in metres; `CabinPlinth`), `tools/blender/aslanair/geometry.py` (`PLINTH = {'height': 0.09, 'inset': 0.004}`), `src/experience/cabinLayout.ts` (`SEAT_TRACK_Z`), `src/scene/aircraft/Aircraft.tsx` (carpet maps by material name), `tests/unit/aircraftAsset.test.ts`, `tests/e2e/cabin.spec.ts`

**Interfaces:**
- Produces: `carpetTexels(size, seed)` — dark blue-grey carpet with a small repeating geometric motif; `aisleRunnerTexels(size, seed)` — a different tone with thin border lines near both edges; both tile; `SEAT_TRACK_Z = [±(SEAT_Z.A + 0.15), ±(SEAT_Z.C − 0.15)]` — two aluminium tracks per side from row 1's front to row 30's back (2 cm wide, 6 mm proud); `CabinPlinth` — a 9 cm dark band along both walls at floor level (a strip 4 mm inside the liner). Carpet maps go on the GLB materials named `Carpet` and `AisleCarpet`.

- [ ] **Step 1: Write the failing tests**

Unit: both texel generators are deterministic and tile (wrap-edge difference ≤ interior); the aisle runner's mean differs from the carpet's by ≥ 8 levels. Asset: `airliner.glb` nodes include `CabinPlinth`; e2e: `SeatTracks` exists with 4 tracks, `Carpet` and `AisleCarpet` materials have maps.

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run tests/unit/carpet.test.ts tests/unit/aircraftAsset.test.ts`, `npx playwright test tests/e2e/cabin.spec.ts -g floor`
Expected: FAIL.

- [ ] **Step 3: Implement; `npm run build:aircraft`**

- [ ] **Step 4: Run tests; view an aisle screenshot (floor reads as carpet with a runner and tracks)**

Run: `npm test && npm run test:blender && npm run e2e`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add tools/blender src public/models tests
git commit -m "feat: patterned carpet, aisle runner, seat tracks and plinth"
```

---

### Task 5: The nose — cockpit door, jump seat, and a look at them on entry

**Files:**
- Modify: `tools/blender/aslanair/geometry.py` (`COCKPIT_DOOR`, `JUMP_SEAT`), `tools/blender/aslanair/kit.py` (`build_cockpit_door()`, `build_jump_seat()`), `tools/blender/aslanair/cabin.py` (remove the flat `CockpitDoor` plane), `tools/blender/aslanair/export.py`
- Modify: `src/experience/cabinLayout.ts`, `src/experience/cameraPoses.ts`, `src/scene/cabin/EntryZone.tsx`, `src/content/copy.ts` (`exitSignArrows: '← EXIT →'`)
- Modify: `tests/unit/cameraPoses.test.ts`, `tests/unit/cabinLayout.test.ts`, `tests/unit/kitAsset.test.ts`, `tests/unit/aircraftAsset.test.ts` (node list: `CockpitDoor` now comes from the kit)

**Interfaces:**
- Produces (Python, cabin coordinates): `COCKPIT_DOOR = {'station': 4.0, 'width': 0.80, 'height': 1.90}` — a reinforced door on the front bulkhead with frame, keypad, peephole, handle and a small placard; `JUMP_SEAT = {'station': 4.02, 'z': -0.75, 'width': 0.45, 'height': 1.05}` — a folded attendant seat on the bulkhead, port of the door, facing aft. Kit nodes `CockpitDoor`, `JumpSeat`.
- Produces (TS): mirrors; `furnishingBoxes()` includes both; the 5.85 m exit sign reads `copy.cabin.exitSignArrows`; `cameraPoses`: `COCKPIT_LOOK` = the door's centre; `doorPose` target eases to `COCKPIT_LOOK` over door t 0.62–0.76, holds to 0.80, then turns to `CABIN_LOOK` over 0.80–1.0.

- [ ] **Step 1: Write the failing tests**

```ts
test('entering, the camera looks at the cockpit door before turning to the aisle', () => {
  for (const t of [0.76, 0.78, 0.8]) {
    const p = poseOnPreTrack(trackProgress('pre', 'door', t));
    const view = p.target.clone().sub(p.position).normalize();
    const toDoor = COCKPIT_LOOK.clone().sub(p.position).normalize();
    expect(view.angleTo(toDoor), `t=${t}`).toBeLessThan((12 * Math.PI) / 180);
  }
});
```
(The existing continuity and `door flight ends at the aisle start` tests must stay green.) Kit/asset: `CockpitDoor` and `JumpSeat` nodes in the kit; `airliner.glb` no longer has `CockpitDoor`; clearance test still ≥ 0.3 m with the new boxes.

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run tests/unit/cameraPoses.test.ts tests/unit/kitAsset.test.ts tests/unit/aircraftAsset.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement; rebuild aircraft and kit**

- [ ] **Step 4: Run tests; view door-chapter screenshots at door t 0.7, 0.78, 0.9**

Run: `npm test && npm run test:blender && npm run e2e`
Expected: PASS; the cockpit door, keypad, jump seat and "← EXIT →" are visible in the 0.78 shot.

- [ ] **Step 5: Commit**

```bash
git add tools/blender src public/models tests
git commit -m "feat: cockpit door and jump seat in the nose, and a look at them on entry"
```

---

### Task 6: The tail — aft galley, lavatories and a cart

**Files:**
- Modify: `tools/blender/aslanair/geometry.py` (`AFT_GALLEY`, `LAVATORY`, `GALLEY_CART`), `tools/blender/aslanair/kit.py` (`build_aft_galley()`, `build_lavatories()`, `build_cart()`), `tools/blender/aslanair/export.py`
- Create: `src/scene/cabin/TailZone.tsx`
- Modify: `src/experience/cabinLayout.ts`, `tests/unit/cabinLayout.test.ts`, `tests/unit/kitAsset.test.ts`, `src/scene/Experience.tsx`

**Interfaces:**
- Produces (Python, cabin coordinates): `AFT_GALLEY = {'s0': 29.85, 's1': 30.45, 'half_width': 0.95, 'top_y': 1.40}` — full-height galley across the aisle end: stainless cart bays, ovens, drawers, worktop, latches; `LAVATORY = {'s0': 29.85, 's1': 30.45, 'inner_z': 0.95}` on both sides — lavatory blocks out to the liner with a bi-fold door facing forward and an occupancy sign; `GALLEY_CART = {'station': 29.55, 'width': 0.30, 'depth': 0.40, 'height': 1.03}` — a cart pulled into the aisle. Kit nodes `AftGalley`, `Lavatories`, `GalleyCart`. The aft exit sign stays (its bottom 1.525 clears the galley top 1.40).
- Produces (TS): mirrors; `furnishingBoxes()` includes them.

- [ ] **Step 1: Write the failing tests**

```ts
test('the tail zone clears row 30 and stays inside the hull', () => {
  const row30Back = stationToX(rowStation(30) + SEAT_KIT.depth / 2 + 0.15);   // reclined back overhang
  expect(row30Back - stationToX(GALLEY_CART.station + GALLEY_CART.depth / 2)).toBeGreaterThanOrEqual(0.3);
});
```
Kit: nodes present; the galley and lavatory outer sides stay inside `liner + linerInset − 0.01` over their stations (as the bin fit test does).

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run tests/unit/cabinLayout.test.ts tests/unit/kitAsset.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement; `npm run build:kit`**

- [ ] **Step 4: Run tests; view the aisle-end screenshot beside reference photo 3**

Run: `npm test && npm run e2e`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add tools/blender src public/models tests
git commit -m "feat: aft galley, lavatories and a cart in the tail"
```

---

### Task 7: Frame rate and review screenshots

**Files:**
- Modify: `tests/e2e/perf.spec.ts` (add `entry` at door t 0.78 and `aisle-end` to both the probe and the screenshot set); whatever the probe shows is too slow (levers in order: seat triangle counts, a far-seat LOD swap, cloud resolution — no change to the look)

- [ ] **Step 1: Extend the probe and the shot list**

- [ ] **Step 2: Run it**

Run: `npx playwright test --project=perf --no-deps`
Expected: every pose median and mean ≤ 22.2 ms on the integrated GPU, or the failing medians to work from.

- [ ] **Step 3: Optimise one lever at a time until it passes; ledger before/after**

- [ ] **Step 4: View every screenshot beside the reference photos; fix what does not read as real**

- [ ] **Step 5: Commit**

```bash
git add tests/e2e/perf.spec.ts src tools public/models
git commit -m "test: frame-rate probe and review shots for the realistic cabin"
```

---

## Spec coverage (r2 §7)

| Spec | Where |
|------|-------|
| 7.1 seats like the photos | Tasks 1–2 |
| 7.2 seat card, touch tap | Task 3 |
| 7.3 tail: galley, lavatories, cart, EXIT | Task 6 |
| 7.4 nose: cockpit door, jump seat, ← EXIT → | Task 5 |
| 7.5 carpet, runner, tracks, plinth | Task 4 |
| 45+ fps on integrated graphics | Task 7 |
