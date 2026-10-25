import { describe, expect, test } from 'vitest';
import { validateBooking } from '@/experience/bookingForm';

describe('the booking form', () => {
  test('a name and a well-formed e-mail pass', () => {
    expect(validateBooking({ name: 'Rustam', email: 'rustam@example.com' })).toEqual({});
    expect(validateBooking({ name: '  Li ', email: ' a.b+c@mail.co.uk ' })).toEqual({});
  });

  test('both are asked for when empty or only spaces', () => {
    expect(validateBooking({ name: '', email: '' })).toEqual({ name: 'required', email: 'required' });
    expect(validateBooking({ name: '   ', email: ' ' })).toEqual({ name: 'required', email: 'required' });
  });

  test('a name needs at least two letters', () => {
    expect(validateBooking({ name: 'A', email: 'a@example.com' })).toEqual({ name: 'short' });
  });

  test('an e-mail needs a name, an @, a domain and its ending', () => {
    for (const email of ['rustam', 'rustam@', '@example.com', 'rustam@example', 'rustam@example.c', 'rus tam@example.com', 'a@b@example.com'])
      expect(validateBooking({ name: 'Rustam', email }), email).toEqual({ email: 'invalid' });
  });
});
