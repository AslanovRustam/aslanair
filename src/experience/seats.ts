import { ROWS, SEAT_LETTERS, type SeatLetter } from './geometry';

export type SeatPosition = 'window' | 'middle' | 'aisle';

export interface Seat {
  id: string;
  row: number;
  letter: SeatLetter;
  position: SeatPosition;
  extraLegroom: boolean;
  status: 'free' | 'occupied';
  priceUsd: number;
}

export const EXTRA_LEGROOM_ROWS = [1, 12, 13];
export const PRICE_USD = { window: 29, aisle: 25, middle: 15, extraLegroom: 40 };

const POSITION_OF: Record<SeatLetter, SeatPosition> = {
  A: 'window', B: 'middle', C: 'aisle', D: 'aisle', E: 'middle', F: 'window',
};
const OCCUPANCY = 0.42;
const WING_ROWS = { from: 9, to: 18, ideal: 14 };

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const isWingWindow = (s: Seat) => s.position === 'window' && s.row >= WING_ROWS.from && s.row <= WING_ROWS.to;

export function generateSeatMap(seed = 270): Seat[] {
  const rnd = mulberry32(seed);
  const seats: Seat[] = [];
  for (let row = 1; row <= ROWS; row++) {
    for (const letter of SEAT_LETTERS) {
      const position = POSITION_OF[letter];
      const extraLegroom = EXTRA_LEGROOM_ROWS.includes(row);
      seats.push({
        id: `${row}${letter}`,
        row,
        letter,
        position,
        extraLegroom,
        status: rnd() < OCCUPANCY ? 'occupied' : 'free',
        priceUsd: PRICE_USD[position] + (extraLegroom ? PRICE_USD.extraLegroom : 0),
      });
    }
  }
  if (!seats.some((s) => isWingWindow(s) && s.status === 'free')) {
    seats.find((s) => s.id === '14A')!.status = 'free';
  }
  return seats;
}

const capitalize = (w: string) => w[0].toUpperCase() + w.slice(1);

export function seatLabel(seat: Seat): string {
  const parts = [seat.id, capitalize(seat.position)];
  if (seat.extraLegroom) parts.push('Extra legroom');
  parts.push(`$${seat.priceUsd}`);
  return parts.join(' · ');
}

export function pickRecommendedSeat(seats: Seat[]): Seat {
  const candidates = seats
    .filter((s) => s.status === 'free' && isWingWindow(s))
    .sort(
      (a, b) =>
        Math.abs(a.row - WING_ROWS.ideal) - Math.abs(b.row - WING_ROWS.ideal) ||
        a.row - b.row ||
        a.letter.localeCompare(b.letter),
    );
  const pick = candidates[0] ?? seats.find((s) => s.status === 'free');
  if (!pick) throw new Error('No free seats');
  return pick;
}

export type SeatVisual = 'free' | 'extra' | 'occupied' | 'hovered' | 'selected';

export const SEAT_COLORS: Record<SeatVisual, string> = {
  free: '#3aa6a0',
  extra: '#d4683a',
  occupied: '#b9bec6',
  hovered: '#6fd3cc',
  selected: '#1b2541',
};

export function seatVisual(seat: Seat, hoveredId: string | null, selectedId: string | null): SeatVisual {
  if (seat.id === selectedId) return 'selected';
  if (seat.status === 'occupied') return 'occupied';
  if (seat.id === hoveredId) return 'hovered';
  return seat.extraLegroom ? 'extra' : 'free';
}
