// AslanAir's network: every flight leaves Chișinău at night; the visitor picks only where to (spec r3 §4).

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
  /** Local departure time from Chișinău, 'HH:MM', always at night. */
  departs: string;
}

/** Chișinău Eugen Doga International — IATA RMO since 18 January 2024 (formerly KIV; ICAO LUKK). */
export const HOME: Place = { code: 'RMO', city: 'Chișinău', country: 'Moldova', lat: 46.927, lon: 28.931 };

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

/** Ways to the airport, free; the pick-up counts back from departure (none when the visitor gets there alone). */
export const TRANSFERS: { id: TransferId; minutesBefore: number | null }[] = [
  { id: 'home', minutesBefore: 180 },
  { id: 'hotel', minutesBefore: 150 },
  { id: 'express', minutesBefore: 120 },
  { id: 'own', minutesBefore: null },
];

export const DEFAULT_TRANSFER: TransferId = 'own';

export function destination(code: string): Destination | undefined {
  return DESTINATIONS.find((d) => d.code === code);
}

/** 'HH:MM' that many minutes before `departs`, wrapping past midnight. */
export function pickupTime(departs: string, minutesBefore: number): string {
  const [h, m] = departs.split(':').map(Number);
  const t = (((h * 60 + m - minutesBefore) % 1440) + 1440) % 1440;
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
}
