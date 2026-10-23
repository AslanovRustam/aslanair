import { hashString } from './random';
import type { Seat } from './seats';

/** A night flight: about a quarter of the travellers read under their reading light. A deterministic choice among
 * the occupied seats, so every visit and every test sees the same cabin. */
export function readingLightSeats(seats: Seat[]): string[] {
  const occupied = seats.filter((s) => s.status === 'occupied');
  return occupied
    .map((s) => ({ id: s.id, key: hashString(`reading:${s.id}`) }))
    .sort((a, b) => a.key - b.key)
    .slice(0, Math.round(occupied.length / 4))
    .map((s) => s.id);
}
