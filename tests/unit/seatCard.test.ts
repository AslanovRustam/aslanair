import { describe, expect, test } from 'vitest';
import { seatCardContent, tapAction } from '@/experience/seatCard';
import { generateSeatMap } from '@/experience/seats';

const seats = generateSeatMap();
const byId = (id: string) => seats.find((s) => s.id === id)!;

describe('seat card', () => {
  test('card content reads like a boarding desk', () => {
    expect(seatCardContent(byId('15C'), 'mouse')).toEqual({ number: '15C', kind: 'Aisle seat', price: '$25', extra: false, hint: 'Click to sit' });
    expect(seatCardContent(byId('13A'), 'touch')).toMatchObject({ kind: 'Window seat', price: '$69', extra: true, hint: 'Tap again to sit' });
    expect(seatCardContent(byId('20B'), 'mouse')).toMatchObject({ kind: 'Middle seat', price: '$15' });
  });

  test('a first tap focuses, a second tap sits; a click always sits', () => {
    expect(tapAction('touch', null, '14C')).toBe('focus');
    expect(tapAction('touch', '14C', '14C')).toBe('sit');
    expect(tapAction('touch', '14B', '14C')).toBe('focus');
    expect(tapAction('mouse', null, '14C')).toBe('sit');
  });
});
