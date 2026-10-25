/**
 * The seat lock and the boarding pass's entrance (spec §4.1 ch. 5: the seat is fixed by a short animation, the pass
 * slides in), by milliseconds since the seat was confirmed. Pure: the camera rig and the pass apply them.
 */

/** The lock: the visitor settles into the seat — the eye dips this far (m) and comes back over `ms` ms, deepest at
 * `peak` ms (their own seat is out of the seated view, so the settling is the lock you feel). */
const LOCK = { dip: 0.03, ms: 600, peak: 180 };
/** The pass: it waits for the lock, then rises from `offsetY` (m, camera space) and turns up from `tilt` (rad) over
 * `ms` ms, easing out (power3); reduced motion fades it in place over `fade` ms instead. */
const ENTRANCE = { after: LOCK.ms, ms: 700, offsetY: -0.35, tilt: 0.25, fade: 400 };

const smooth = (u: number) => u * u * (3 - 2 * u);
const power3Out = (u: number) => 1 - (1 - u) ** 3;
const clamp01 = (u: number) => Math.min(1, Math.max(0, u));

/** Turning the pass by hand (spec §4.4, §4.8): a press that moves less than `tapPx` is a tap; a release faster than
 * `flick` rad/s turns it on to the next face in that direction. */
const DRAG = { tapPx: 6, flick: 6 };

/** The pass's turn while dragged: from `start`, half a turn per card width the pointer moves. */
export function dragAngle(start: number, dxPx: number, widthPx: number): number {
  return start + (Math.PI * dxPx) / widthPx;
}

/** Where the pass settles when let go at `current`: the nearest face — or, flicked, the next face from `start` in
 * the flick's direction. */
export function flipAfterDrag(start: number, current: number, velocityRadPerS: number): number {
  if (Math.abs(velocityRadPerS) > DRAG.flick) return start + Math.sign(velocityRadPerS) * Math.PI;
  return Math.round(current / Math.PI) * Math.PI;
}

/** Whether a press that moved `px` pixels is a tap (it turns the pass over, as a click does). */
export function isTap(px: number): boolean {
  return px < DRAG.tapPx;
}

/** How far the eye dips `ms` after the lock: smooth in to the peak and out again; none with reduced motion. */
export function lockPulse(ms: number, reduced: boolean): { dip: number } {
  if (reduced || ms <= 0 || ms >= LOCK.ms) return { dip: 0 };
  const k = ms < LOCK.peak ? smooth(ms / LOCK.peak) : smooth(1 - (ms - LOCK.peak) / (LOCK.ms - LOCK.peak));
  return { dip: LOCK.dip * k };
}

/** Where the pass is `ms` after the lock: below and tilted until the lock is done, then rising into place. */
export function passEntrance(ms: number, reduced: boolean): { offsetY: number; tilt: number; opacity: number } {
  const u = (ms - ENTRANCE.after) / (reduced ? ENTRANCE.fade : ENTRANCE.ms);
  if (reduced) return { offsetY: 0, tilt: 0, opacity: clamp01(u) };
  const k = power3Out(clamp01(u));
  return { offsetY: ENTRANCE.offsetY * (1 - k) || 0, tilt: ENTRANCE.tilt * (1 - k) || 0, opacity: 1 };
}
