import { describe, expect, test } from 'vitest';
import { EXTRA_LEGROOM_ROWS, generateSeatMap, pickRecommendedSeat, seatLabel, seatVisual, type Seat } from '@/experience/seats';

const seats = generateSeatMap();
const byId = (id: string) => seats.find((s) => s.id === id)!;

describe('seat map', () => {
  test('has 180 uniquely numbered seats, row-major 1A…30F', () => {
    expect(seats).toHaveLength(180);
    expect(seats[0].id).toBe('1A');
    expect(seats[179].id).toBe('30F');
    expect(new Set(seats.map((s) => s.id)).size).toBe(180);
  });

  test('is deterministic and roughly 30–55% occupied', () => {
    expect(generateSeatMap()).toEqual(seats);
    const occ = seats.filter((s) => s.status === 'occupied').length / 180;
    expect(occ).toBeGreaterThan(0.3);
    expect(occ).toBeLessThan(0.55);
  });

  test('prices depend on position and extra legroom', () => {
    expect(byId('13A').priceUsd).toBe(69);
    expect(byId('15B').priceUsd).toBe(15);
    expect(byId('15C').priceUsd).toBe(25);
  });

  test('labels read "id · position · [extra] · price"', () => {
    expect(seatLabel(byId('15C'))).toBe('15C · Aisle · $25');
    expect(seatLabel(byId('13A'))).toBe('13A · Window · Extra legroom · $69');
  });

  test('extra legroom sits at the over-wing exits', () => {
    expect(EXTRA_LEGROOM_ROWS).toEqual([1, 13, 14]);
    expect(seatLabel(byId('13A'))).toBe('13A · Window · Extra legroom · $69');
    expect(seatLabel(byId('12A'))).toBe('12A · Window · $29');
  });
});

describe('recommended seat', () => {
  test('is a free window seat over the wing', () => {
    const pick = pickRecommendedSeat(seats);
    expect(pick.status).toBe('free');
    expect(pick.position).toBe('window');
    expect(pick.row).toBeGreaterThanOrEqual(9);
    expect(pick.row).toBeLessThanOrEqual(18);
  });

  test('falls back to the only free wing window seat', () => {
    const onlyNine = seats.map((s) => ({
      ...s,
      status: s.id === '9A' ? 'free' : s.row >= 9 && s.row <= 18 && s.position === 'window' ? 'occupied' : s.status,
    })) as Seat[];
    expect(pickRecommendedSeat(onlyNine).id).toBe('9A');
  });
});

describe('seat visual state', () => {
  test('extra-legroom free seats are "extra", selection beats hover', () => {
    expect(seatVisual(byId('13A'), null, null)).toBe(byId('13A').status === 'occupied' ? 'occupied' : 'extra');
    const pick = pickRecommendedSeat(seats);
    expect(seatVisual(pick, pick.id, pick.id)).toBe('selected');
  });
});
