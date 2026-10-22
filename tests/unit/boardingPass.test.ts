import { describe, expect, test } from 'vitest';
import { boardingPassFor } from '@/experience/boardingPass';
import { generateSeatMap } from '@/experience/seats';

const base = generateSeatMap()[0];

describe('boarding pass', () => {
  test('zone follows the row and the barcode has 48 bars', () => {
    const p14c = boardingPassFor({ ...base, id: '14C', row: 14, letter: 'C' });
    expect(p14c.zone).toBe(2);
    expect(p14c.seat).toBe('14C');
    expect(p14c.barcode).toHaveLength(48);
    expect(p14c.barcode.every((w) => w >= 1 && w <= 4)).toBe(true);
  });

  test('the barcode is stable per seat and differs between seats', () => {
    const a = boardingPassFor({ ...base, id: '14C', row: 14, letter: 'C' });
    expect(boardingPassFor({ ...base, id: '14C', row: 14, letter: 'C' }).barcode).toEqual(a.barcode);
    expect(boardingPassFor({ ...base, id: '3F', row: 3, letter: 'F' }).barcode).not.toEqual(a.barcode);
  });
});
