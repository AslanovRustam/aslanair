import { describe, expect, test } from 'vitest';
import { beacon, strobe } from '@/experience/blink';

describe('anti-collision lights', () => {
  test('beacon flashes once a second', () => {
    expect(beacon(0.05)).toBeGreaterThan(0.8);
    expect(beacon(0.5)).toBe(0);
    expect(beacon(1.05)).toBeGreaterThan(0.8);
  });

  test('strobes double-flash every 1.2 s', () => {
    expect(strobe(0.02)).toBe(1);
    expect(strobe(0.1)).toBe(0);
    expect(strobe(0.17)).toBe(1);
    expect(strobe(0.6)).toBe(0);
    expect(strobe(1.22)).toBe(1);
  });
});
