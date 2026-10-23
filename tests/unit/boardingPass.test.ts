import { describe, expect, test } from 'vitest';
import { boardingPassFor } from '@/experience/boardingPass';
import { DESTINATIONS, pickupTime } from '@/experience/destinations';
import { generateSeatMap } from '@/experience/seats';

const base = generateSeatMap()[0];
const lisbon = DESTINATIONS.find((d) => d.code === 'LIS')!;
const tokyo = DESTINATIONS.find((d) => d.code === 'HND')!;

describe('boarding pass', () => {
  test('zone follows the row and the barcode has 48 bars', () => {
    const p14c = boardingPassFor({ ...base, id: '14C', row: 14, letter: 'C' }, lisbon, 'own');
    expect(p14c.zone).toBe(2);
    expect(p14c.seat).toBe('14C');
    expect(p14c.barcode).toHaveLength(48);
    expect(p14c.barcode.every((w) => w >= 1 && w <= 4)).toBe(true);
  });

  test('the barcode is stable per seat and differs between seats', () => {
    const a = boardingPassFor({ ...base, id: '14C', row: 14, letter: 'C' }, lisbon, 'own');
    expect(boardingPassFor({ ...base, id: '14C', row: 14, letter: 'C' }, lisbon, 'own').barcode).toEqual(a.barcode);
    expect(boardingPassFor({ ...base, id: '3F', row: 3, letter: 'F' }, lisbon, 'own').barcode).not.toEqual(a.barcode);
  });

  test('the pass carries the route from Chișinău, the flight and the transfer', () => {
    const pass = boardingPassFor({ ...base, id: '14C', row: 14, letter: 'C' }, tokyo, 'home');
    expect(pass.from).toEqual({ code: 'RMO', city: 'Chișinău' });
    expect(pass.to).toEqual({ code: 'HND', city: 'Tokyo' });
    expect(pass.flight).toBe(tokyo.flight);
    expect(pass.boarding).toBe(pickupTime(tokyo.departs, 40));
    expect(pass.transfer).toEqual({ label: 'From home', pickup: pickupTime(tokyo.departs, 180) });
    expect(boardingPassFor({ ...base, id: '14C', row: 14, letter: 'C' }, tokyo, 'own').transfer).toEqual({ label: 'On my own', pickup: null });
  });
});
