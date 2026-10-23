import { copy } from '@/content/copy';
import { HOME, pickupTime, TRANSFERS, type Destination, type TransferId } from './destinations';
import { hashString, mulberry32 } from './random';
import type { Seat } from './seats';

/** Boarding closes this long before departure. */
const BOARDING_BEFORE = 40;

export interface BoardingPassData {
  airline: 'AslanAir';
  flight: string;
  from: { code: string; city: string };
  to: { code: string; city: string };
  date: '22 OCT';
  boarding: string;
  /** The way to the airport the visitor chose; a pick-up time unless they get there on their own. */
  transfer: { label: string; pickup: string | null };
  gate: 'B12';
  seat: string;
  zone: 1 | 2 | 3;
  passenger: 'Guest';
  /** 48 bar widths, each 1..4 units. */
  barcode: number[];
}

export function boardingPassFor(seat: Seat, to: Destination, transfer: TransferId): BoardingPassData {
  const rnd = mulberry32(hashString(seat.id));
  const before = TRANSFERS.find((t) => t.id === transfer)!.minutesBefore;
  return {
    airline: 'AslanAir',
    flight: to.flight,
    from: { code: HOME.code, city: HOME.city },
    to: { code: to.code, city: to.city },
    date: '22 OCT',
    boarding: pickupTime(to.departs, BOARDING_BEFORE),
    transfer: { label: copy.transfer.options[transfer], pickup: before === null ? null : pickupTime(to.departs, before) },
    gate: 'B12',
    seat: seat.id,
    zone: seat.row <= 10 ? 1 : seat.row <= 20 ? 2 : 3,
    passenger: 'Guest',
    barcode: Array.from({ length: 48 }, () => 1 + Math.floor(rnd() * 4)),
  };
}
