import { copy } from '@/content/copy';
import { SEAT_KIT } from './cabinLayout';
import { seatWorldPosition, type SeatLetter } from './geometry';
import type { Seat } from './seats';

export type PointerKind = 'mouse' | 'touch';

export interface SeatCardContent {
  number: string;
  kind: string;
  price: string;
  extra: boolean;
  hint: string;
}

/** The card's tip sits this far above the seat top, so the card never covers the seat it describes. */
const CARD_LIFT = 0.28;

export function seatCardContent(seat: Seat, pointer: PointerKind): SeatCardContent {
  return {
    number: seat.id,
    kind: copy.seatCard.kinds[seat.position],
    price: `$${seat.priceUsd}`,
    extra: seat.extraLegroom,
    hint: pointer === 'touch' ? copy.seatCard.tap : copy.seatCard.click,
  };
}

/** A click always sits; on touch the first tap focuses a seat (shows its card) and a second tap on it sits. */
export function tapAction(pointer: PointerKind, focusedId: string | null, id: string): 'focus' | 'sit' {
  return pointer === 'mouse' || focusedId === id ? 'sit' : 'focus';
}

/** World point the card's tip points at: above the seat's headrest. */
export function seatCardAnchor(id: string): [number, number, number] {
  const [x, y, z] = seatWorldPosition(Number(id.slice(0, -1)), id.at(-1) as SeatLetter);
  return [x, y + SEAT_KIT.height + CARD_LIFT, z];
}
