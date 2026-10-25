import { MathUtils } from 'three';
import type { ChapterId } from '@/experience/chapters';
import type { Phase } from '@/experience/store';

/** The two beds: the cruise heard from outside, and the same hum muffled by the cabin (low-passed at the cutoff). */
export interface Ambience {
  outside: number;
  cabin: number;
  cabinCutoffHz: number;
}

/** What the one-shots follow in the store. */
export interface SoundSnapshot {
  phase: Phase;
  chapter: ChapterId;
  /** How many times the pass has been turned over (the store counts). */
  passFlips: number;
}

export type OneShot = 'ding' | 'rustle' | 'gust';

const OUTSIDE = { outside: 0.55, cabin: 0 };
const ABOARD = { outside: 0.05, cabin: 0.35 };
const CUTOFF = 650;
const { smoothstep, lerp } = MathUtils;

const between = (k: number, from: { outside: number; cabin: number }, to: { outside: number; cabin: number }): Ambience => ({
  outside: lerp(from.outside, to.outside, k),
  cabin: lerp(from.cabin, to.cabin, k),
  cabinCutoffHz: CUTOFF,
});

/**
 * The beds for where the visitor is (spec §4.7): out in the night sky and over the journey's screens the cruise is
 * heard from outside; through the door it crossfades into the muffled cabin (t 0.3–0.7) and stays there in the aisle,
 * in the seat and on the pass; out through the window it crossfades back (t 0–0.4); the outro lets it fall quiet.
 */
export function ambience(phase: Phase, chapter: ChapterId, t: number): Ambience {
  if (phase === 'seated') return between(1, OUTSIDE, ABOARD);
  switch (chapter) {
    case 'door':
      return between(smoothstep(t, 0.3, 0.7), OUTSIDE, ABOARD);
    case 'aisle':
    case 'pass':
      return between(1, OUTSIDE, ABOARD);
    case 'exit':
      return between(1 - smoothstep(t, 0, 0.4), OUTSIDE, ABOARD);
    case 'outro':
      return { outside: lerp(OUTSIDE.outside, 0.12, smoothstep(t, 0, 0.5)), cabin: 0, cabinCutoffHz: CUTOFF };
    default:
      return between(0, OUTSIDE, ABOARD);
  }
}

/** The one-shots between two moments: the chime as the visitor sits or confirms, paper as the pass turns over, the
 * wind as the way out through the window begins. Going back plays nothing. */
export function oneShots(prev: SoundSnapshot, next: SoundSnapshot): OneShot[] {
  const out: OneShot[] = [];
  if (next.phase !== prev.phase && (next.phase === 'seated' || next.phase === 'confirmed')) out.push('ding');
  if (next.passFlips > prev.passFlips) out.push('rustle');
  if (next.chapter === 'exit' && prev.chapter === 'pass') out.push('gust');
  return out;
}
