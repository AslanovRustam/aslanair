import { MathUtils } from 'three';
import { chapterAt } from './chapters';
import { DOOR_1L } from './geometry';
import { trackOf, type Phase } from './store';

/** How far door 1L stands open at the end of the ready chapter: the plug door out from the skin, a gap of light. */
export const DOOR_AJAR = 0.15;

/**
 * 0 = closed, 1 = fully open. Closed through the journey; it comes ajar as the ready chapter ends and opens on from
 * there during the door approach; closed again for the flight.
 */
export function doorOpenAmount(phase: Phase, progress: number): number {
  if (trackOf(phase) === 'post') return 0;
  if (phase === 'seated') return 1;
  const { id, t } = chapterAt('pre', progress);
  if (id === 'ready') return DOOR_AJAR * MathUtils.smoothstep(t, 0.35, 0.85);
  if (id === 'door') return DOOR_AJAR + (1 - DOOR_AJAR) * MathUtils.smoothstep(t, 0.3, 0.55);
  return id === 'aisle' ? 1 : 0;
}

/** 0 … 1: the warm light from the doorway, growing as the door comes ajar, gone before the camera reaches the door. */
export function doorGlow(phase: Phase, progress: number): number {
  if (phase !== 'browse') return 0;
  const { id, t } = chapterAt('pre', progress);
  if (id === 'ready') return MathUtils.smoothstep(t, 0.35, 0.85);
  return id === 'door' ? 1 - MathUtils.smoothstep(t, 0.2, 0.45) : 0;
}

/** Plug door: slides out from the skin over the first 40%, then forward along the hull. */
export function doorOffset(amount: number): [number, number, number] {
  const out = MathUtils.smoothstep(amount, 0, 0.4);
  const forward = MathUtils.smoothstep(amount, 0.4, 1);
  // `+ 0` keeps −0 (port side × closed) out of the result
  return [DOOR_1L.open.forward * forward, 0, DOOR_1L.side * DOOR_1L.open.outward * out + 0];
}
