import { describe, expect, test } from 'vitest';
import { DEFAULT_TRANSFER, DESTINATIONS, HOME, pickupTime, SUGGESTED, transferHeadline, transferTimeline, TRANSFERS } from '@/experience/destinations';

const minutes = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

describe('destinations', () => {
  test('home is Odesa, ODS', () => {
    expect(HOME).toMatchObject({ code: 'ODS', city: 'Odesa', country: 'Ukraine' });
  });

  test('fourteen destinations on five continents, home not among them', () => {
    expect(DESTINATIONS).toHaveLength(14);
    expect(new Set(DESTINATIONS.map((d) => d.code)).size).toBe(14);
    expect(DESTINATIONS.map((d) => d.code)).not.toContain('ODS');
    expect(new Set(DESTINATIONS.map((d) => d.region))).toEqual(
      new Set(['Europe', 'Middle East', 'Asia', 'North America', 'South America', 'Africa']),
    );
    expect(DESTINATIONS.find((d) => d.code === SUGGESTED)).toMatchObject({ city: 'Lisbon', flight: 'AS 270' });
  });

  test('flight numbers are AslanAir’s and unique; fares are whole dollars', () => {
    expect(DESTINATIONS.every((d) => /^AS \d{3}$/.test(d.flight))).toBe(true);
    expect(new Set(DESTINATIONS.map((d) => d.flight)).size).toBe(14);
    expect(DESTINATIONS.every((d) => Number.isInteger(d.fareUsd) && d.fareUsd > 0)).toBe(true);
  });

  test('every flight leaves at night', () => {
    for (const d of DESTINATIONS) {
      const m = minutes(d.departs);
      expect(m >= 21 * 60 || m <= 2 * 60, `${d.code} ${d.departs}`).toBe(true);
    }
  });

  test('positions are on the map', () => {
    for (const d of [HOME, ...DESTINATIONS]) {
      expect(Math.abs(d.lat)).toBeLessThanOrEqual(90);
      expect(Math.abs(d.lon)).toBeLessThanOrEqual(180);
    }
  });
});

describe('transfers', () => {
  test('four ways to the airport, on your own by default', () => {
    expect(TRANSFERS.map((t) => t.id)).toEqual(['home', 'hotel', 'express', 'own']);
    expect(DEFAULT_TRANSFER).toBe('own');
    expect(TRANSFERS.find((t) => t.id === 'own')!.minutesBefore).toBeNull();
  });

  test('pick-up counts back from departure, past midnight too', () => {
    expect(pickupTime('22:40', 180)).toBe('19:40');
    expect(pickupTime('00:30', 180)).toBe('21:30');
    expect(pickupTime('01:05', 65)).toBe('00:00');
  });
});

describe('transfer prices and the evening', () => {
  test('a car from home is $24, from the hotel $18, the express $9, and on your own is free', () => {
    expect(Object.fromEntries(TRANSFERS.map((t) => [t.id, t.priceUsd]))).toEqual({ home: 24, hotel: 18, express: 9, own: 0 });
  });

  test('with a ride the evening runs pick-up, the airport, departure', () => {
    expect(transferTimeline('22:40', 'home')).toEqual([
      { kind: 'pickup', time: '19:40' },
      { kind: 'airport', time: '20:40' },
      { kind: 'departs', time: '22:40' },
    ]);
    expect(transferTimeline('00:20', 'express').map((s) => s.time)).toEqual(['22:20', '23:00', '00:20']);
  });

  test('on your own there is no pick-up: you make your way, check-in closes 40 minutes before', () => {
    expect(transferTimeline('22:40', 'own')).toEqual([
      { kind: 'own', time: null },
      { kind: 'checkin', time: '22:00' },
      { kind: 'departs', time: '22:40' },
    ]);
  });

  test('the headline time is the pick-up, or check-in closing on your own', () => {
    expect(transferHeadline('22:40', 'hotel')).toBe('20:10');
    expect(transferHeadline('22:40', 'own')).toBe('22:00');
  });
});
