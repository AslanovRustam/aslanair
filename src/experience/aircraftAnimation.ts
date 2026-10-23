import { MathUtils } from 'three';
import { chapterAt } from './chapters';
import { DOOR_1L } from './geometry';
import { trackOf, type Phase } from './store';

/** 0 = closed, 1 = fully open. Closed through the journey, opens during the door approach; closed again for the flight. */
export function doorOpenAmount(phase: Phase, progress: number): number {
  if (trackOf(phase) === 'post') return 0;
  if (phase === 'seated') return 1;
  const { id, t } = chapterAt('pre', progress);
  if (id === 'door') return MathUtils.smoothstep(t, 0.3, 0.55);
  return id === 'aisle' ? 1 : 0;
}

/** Plug door: slides out from the skin over the first 40%, then forward along the hull. */
export function doorOffset(amount: number): [number, number, number] {
  const out = MathUtils.smoothstep(amount, 0, 0.4);
  const forward = MathUtils.smoothstep(amount, 0.4, 1);
  // `+ 0` keeps −0 (port side × closed) out of the result
  return [DOOR_1L.open.forward * forward, 0, DOOR_1L.side * DOOR_1L.open.outward * out + 0];
}
