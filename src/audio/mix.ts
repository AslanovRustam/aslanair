import { MathUtils } from 'three';
import type { ChapterId } from '@/experience/chapters';
import type { Phase } from '@/experience/store';

/**
 * The three beds (the author, 2026-10-25): a terminal's crowd with its announcements until Ready to choose your seat
 * shows, then the cabin of a plane in flight; out through the window, the night air (synthesised); levels 0 … 1.
 */
export interface Ambience {
  airport: number;
  cabin: number;
  outside: number;
}

/** What the one-shots follow in the store. */
export interface SoundSnapshot {
  phase: Phase;
  chapter: ChapterId;
  /** How many times the pass has been turned over (the store counts). */
  passFlips: number;
}

export type OneShot = 'ding' | 'rustle' | 'gust';

// the beds sit under the music (the author could not hear it at 0.22 under a 0.7 crowd and a 0.8 cabin)
const LEVEL = { airport: 0.5, cabin: 0.55, outside: 0.55, outro: 0.12 };
const SILENT: Ambience = { airport: 0, cabin: 0, outside: 0 };
const { smoothstep, lerp } = MathUtils;

/**
 * The beds for where the visitor is: the airport through the journey before boarding; as Ready shows (its first
 * quarter) it gives way to the cabin in flight, which stays at the door, in the aisle, in the seat and on the pass;
 * out through the window the night air takes over (exit t 0–0.4); the outro lets it fall quiet.
 */
export function ambience(phase: Phase, chapter: ChapterId, t: number): Ambience {
  if (phase === 'seated') return { ...SILENT, cabin: LEVEL.cabin };
  switch (chapter) {
    case 'sky':
    case 'destinations':
    case 'transfer':
      return { ...SILENT, airport: LEVEL.airport };
    case 'ready': {
      const k = smoothstep(t, 0, 0.25);
      return { ...SILENT, airport: LEVEL.airport * (1 - k), cabin: LEVEL.cabin * k };
    }
    case 'exit': {
      const k = smoothstep(t, 0, 0.4);
      return { airport: 0, cabin: LEVEL.cabin * (1 - k), outside: LEVEL.outside * k };
    }
    case 'outro':
      return { ...SILENT, outside: lerp(LEVEL.outside, LEVEL.outro, smoothstep(t, 0, 0.5)) };
    default:
      return { ...SILENT, cabin: LEVEL.cabin };
  }
}

/** A boarding call `first` s after the visitor reaches the airport, then every `every` s while they stay. */
const ANNOUNCE = { first: 6, every: 45 };

/** Whether a boarding call is due at `now` (s): `airportSince` is when the airport bed came up (null: not there). */
export function announcementDue(now: number, s: { airportSince: number | null; lastAt: number | null }): boolean {
  if (s.airportSince === null || now - s.airportSince < ANNOUNCE.first) return false;
  return s.lastAt === null || now - s.lastAt >= ANNOUNCE.every;
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
