// AslanAir's network: every flight leaves Odesa at night; the visitor picks only where to (spec r3 §4, home moved
// from Chișinău to Odesa at the user's word, 2026-10-23).

export type Region = 'Europe' | 'Middle East' | 'Asia' | 'North America' | 'South America' | 'Africa';

export interface Place {
  code: string;
  city: string;
  country: string;
  lat: number;
  lon: number;
}

export interface Destination extends Place {
  region: Region;
  /** Lowest fare, USD; the seat's own price is separate (no total anywhere). */
  fareUsd: number;
  flight: string;
  /** Local departure time from Odesa, 'HH:MM', always at night. */
  departs: string;
}

/** Odesa International Airport — IATA ODS, ICAO UKOO. */
export const HOME: Place = { code: 'ODS', city: 'Odesa', country: 'Ukraine', lat: 46.4268, lon: 30.6765 };

export const DESTINATIONS: Destination[] = [
  { code: 'LIS', city: 'Lisbon', country: 'Portugal', region: 'Europe', lat: 38.774, lon: -9.134, fareUsd: 129, flight: 'AS 270', departs: '22:40' },
  { code: 'LHR', city: 'London', country: 'United Kingdom', region: 'Europe', lat: 51.47, lon: -0.454, fareUsd: 119, flight: 'AS 214', departs: '21:55' },
  { code: 'CDG', city: 'Paris', country: 'France', region: 'Europe', lat: 49.01, lon: 2.548, fareUsd: 109, flight: 'AS 218', departs: '22:15' },
  { code: 'FCO', city: 'Rome', country: 'Italy', region: 'Europe', lat: 41.8, lon: 12.239, fareUsd: 99, flight: 'AS 226', departs: '23:05' },
  { code: 'BCN', city: 'Barcelona', country: 'Spain', region: 'Europe', lat: 41.297, lon: 2.078, fareUsd: 115, flight: 'AS 232', departs: '22:50' },
  { code: 'VIE', city: 'Vienna', country: 'Austria', region: 'Europe', lat: 48.11, lon: 16.57, fareUsd: 89, flight: 'AS 204', departs: '21:30' },
  { code: 'KEF', city: 'Reykjavik', country: 'Iceland', region: 'Europe', lat: 63.985, lon: -22.605, fareUsd: 189, flight: 'AS 252', departs: '23:40' },
  { code: 'IST', city: 'Istanbul', country: 'Türkiye', region: 'Europe', lat: 41.275, lon: 28.752, fareUsd: 79, flight: 'AS 202', departs: '00:20' },
  { code: 'DXB', city: 'Dubai', country: 'United Arab Emirates', region: 'Middle East', lat: 25.253, lon: 55.365, fareUsd: 199, flight: 'AS 302', departs: '01:15' },
  { code: 'HND', city: 'Tokyo', country: 'Japan', region: 'Asia', lat: 35.549, lon: 139.78, fareUsd: 649, flight: 'AS 702', departs: '21:20' },
  { code: 'BKK', city: 'Bangkok', country: 'Thailand', region: 'Asia', lat: 13.69, lon: 100.75, fareUsd: 549, flight: 'AS 712', departs: '22:05' },
  { code: 'JFK', city: 'New York', country: 'United States', region: 'North America', lat: 40.641, lon: -73.778, fareUsd: 449, flight: 'AS 602', departs: '23:55' },
  { code: 'GIG', city: 'Rio de Janeiro', country: 'Brazil', region: 'South America', lat: -22.809, lon: -43.244, fareUsd: 599, flight: 'AS 642', departs: '00:45' },
  { code: 'CPT', city: 'Cape Town', country: 'South Africa', region: 'Africa', lat: -33.965, lon: 18.602, fareUsd: 579, flight: 'AS 662', departs: '01:40' },
];

/** Tonight's pick, chosen before the visitor chooses: the scroll never waits on a choice. */
export const SUGGESTED = 'LIS';

export type TransferId = 'home' | 'hotel' | 'express' | 'own';

/**
 * Ways to the airport (spec r4 §6): the pick-up counts back from departure and the ride takes `rideMinutes` (none when
 * the visitor gets there alone); each has its price, shown on its card only — no total anywhere.
 */
export const TRANSFERS: { id: TransferId; minutesBefore: number | null; rideMinutes: number | null; priceUsd: number }[] = [
  { id: 'home', minutesBefore: 180, rideMinutes: 60, priceUsd: 24 },
  { id: 'hotel', minutesBefore: 150, rideMinutes: 45, priceUsd: 18 },
  { id: 'express', minutesBefore: 120, rideMinutes: 40, priceUsd: 9 },
  { id: 'own', minutesBefore: null, rideMinutes: null, priceUsd: 0 },
];

/** Check-in closes this many minutes before departure. */
export const CHECK_IN_CLOSES = 40;

export const DEFAULT_TRANSFER: TransferId = 'own';

export function destination(code: string): Destination | undefined {
  return DESTINATIONS.find((d) => d.code === code);
}

export type TimelineKind = 'pickup' | 'airport' | 'own' | 'checkin' | 'departs';

/**
 * The visitor's evening for a transfer: pick-up, at the airport, departure; on their own, no pick-up — they make
 * their way, check-in closes, departure.
 */
export function transferTimeline(departs: string, id: TransferId): { kind: TimelineKind; time: string | null }[] {
  const t = TRANSFERS.find((x) => x.id === id)!;
  if (t.minutesBefore === null || t.rideMinutes === null) {
    return [
      { kind: 'own', time: null },
      { kind: 'checkin', time: pickupTime(departs, CHECK_IN_CLOSES) },
      { kind: 'departs', time: departs },
    ];
  }
  return [
    { kind: 'pickup', time: pickupTime(departs, t.minutesBefore) },
    { kind: 'airport', time: pickupTime(departs, t.minutesBefore - t.rideMinutes) },
    { kind: 'departs', time: departs },
  ];
}

/** The card's big time: the pick-up, or check-in closing on your own. */
export function transferHeadline(departs: string, id: TransferId): string {
  return transferTimeline(departs, id).find((s) => s.time !== null)!.time!;
}

/** 'HH:MM' that many minutes before `departs`, wrapping past midnight. */
export function pickupTime(departs: string, minutesBefore: number): string {
  const [h, m] = departs.split(':').map(Number);
  const t = (((h * 60 + m - minutesBefore) % 1440) + 1440) % 1440;
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
}
