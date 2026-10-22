import { hashString, mulberry32 } from './random';
import type { Seat } from './seats';

export interface BoardingPassData {
  airline: 'AslanAir';
  flight: 'ASLAN 270';
  from: { code: 'IST'; city: 'Istanbul' };
  to: { code: 'LIS'; city: 'Lisbon' };
  date: '22 OCT';
  boarding: '14:35';
  gate: 'B12';
  seat: string;
  zone: 1 | 2 | 3;
  passenger: 'Guest';
  /** 48 bar widths, each 1..4 units. */
  barcode: number[];
}

export function boardingPassFor(seat: Seat): BoardingPassData {
  const rnd = mulberry32(hashString(seat.id));
  return {
    airline: 'AslanAir',
    flight: 'ASLAN 270',
    from: { code: 'IST', city: 'Istanbul' },
    to: { code: 'LIS', city: 'Lisbon' },
    date: '22 OCT',
    boarding: '14:35',
    gate: 'B12',
    seat: seat.id,
    zone: seat.row <= 10 ? 1 : seat.row <= 20 ? 2 : 3,
    passenger: 'Guest',
    barcode: Array.from({ length: 48 }, () => 1 + Math.floor(rnd() * 4)),
  };
}
