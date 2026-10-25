import { Euler, MathUtils, Vector3 } from 'three';
import { chapterAt } from './chapters';
import { DOOR_1L } from './geometry';
import { gridHalfWidthAt, type SkinGrid } from './linerProfile';
import { trackOf, type Phase } from './store';

/**
 * 0 = closed, 1 = fully open. Closed through the journey and the ready chapter — its outline glowing (doorGlow) — it
 * opens in one movement as the door flight begins (spec r5 §7); closed again for the flight.
 */
export function doorOpenAmount(phase: Phase, progress: number): number {
  if (trackOf(phase) === 'post') return 0;
  if (phase === 'seated') return 1;
  const { id, t } = chapterAt('pre', progress);
  if (id === 'door') return MathUtils.smoothstep(t, 0.15, 0.5);
  return id === 'aisle' ? 1 : 0;
}

/** 0 … 1: the warm light at the closed door's seams, growing over the ready chapter, gone before the camera reaches
 * the door. */
export function doorGlow(phase: Phase, progress: number): number {
  if (phase !== 'browse') return 0;
  const { id, t } = chapterAt('pre', progress);
  if (id === 'ready') return MathUtils.smoothstep(t, 0.35, 0.85);
  return id === 'door' ? 1 - MathUtils.smoothstep(t, 0.2, 0.45) : 0;
}

/** The door's rotation order: the lean about its own long axis first, then the turn about the vertical. */
export const DOOR_ROTATION_ORDER = 'YXZ';

/**
 * Door 1L `amount` open (spec r5 §7), like an A320's: out from the skin by `open.clear` over the first 30 %, and
 * forward along the hull by `open.forward` from 20 % on — standing off the skin under it by that clearance all the
 * way and turned to the skin there (the nose narrows in plan and in section), so it lies along the fuselage, never in
 * the air beside it. `offset` moves the door node (its hinge on the forward edge, at mid-height) from its closed place;
 * `rotation` turns it about there (x, y, z; order `DOOR_ROTATION_ORDER`).
 */
export function doorPose(amount: number, skin: SkinGrid): { offset: [number, number, number]; rotation: [number, number, number] } {
  const { station, width, side, y } = DOOR_1L;
  const out = DOOR_1L.open.clear * MathUtils.smoothstep(amount, 0, 0.3);
  const forward = DOOR_1L.open.forward * MathUtils.smoothstep(amount, 0.2, 1);
  const half = (s: number) => gridHalfWidthAt(skin, s, y);
  // the skin's heading in plan (its half-width's slope along the hull) and its lean in section (the slope up it), as
  // angles about y and x on this side
  const heading = (s: number) => Math.atan(side * ((half(s + 0.05) - half(s - 0.05)) / 0.1));
  const lean = (s: number) => Math.atan(side * ((gridHalfWidthAt(skin, s, y + 0.05) - gridHalfWidthAt(skin, s, y - 0.05)) / 0.1));
  const centre = station - forward;
  const turn = new Euler(lean(centre) - lean(station), heading(centre) - heading(station), 0, DOOR_ROTATION_ORDER);
  // the panel's middle from the hinge, closed; and where it goes: the clearance off the skin at its new station
  const hinge = station - width / 2;
  const middle = new Vector3(-width / 2, 0, side * (half(station) - half(hinge)));
  const offset = new Vector3(middle.x + forward, 0, side * (half(centre) + out - half(hinge))).sub(middle.clone().applyEuler(turn));
  // `+ 0` keeps −0 out of the result
  return { offset: [offset.x + 0, offset.y + 0, offset.z + 0], rotation: [turn.x + 0, turn.y + 0, 0] };
}
