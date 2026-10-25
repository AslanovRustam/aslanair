import { describe, expect, test } from 'vitest';
import { ambience, announcementDue, oneShots, type SoundSnapshot } from '@/audio/mix';

const snap = (s: Partial<SoundSnapshot>): SoundSnapshot => ({ phase: 'browse', chapter: 'sky', passFlips: 0, ...s });

describe('the mix (the author, 2026-10-25: an airport until Ready, then a plane in flight)', () => {
  test('the airport through the journey before boarding, nothing else', () => {
    for (const chapter of ['sky', 'destinations', 'transfer'] as const) expect(ambience('browse', chapter, 0.5)).toMatchObject({ airport: 0.7, cabin: 0, outside: 0 });
  });

  test('as Ready shows, the airport gives way to the cabin in flight', () => {
    expect(ambience('browse', 'ready', 0)).toMatchObject({ airport: 0.7, cabin: 0 });
    expect(ambience('browse', 'ready', 0.3)).toMatchObject({ airport: 0, cabin: 0.8 });
    const [a, b] = [ambience('browse', 'ready', 0.12), ambience('browse', 'ready', 0.13)];
    expect(Math.abs(a.cabin - b.cabin)).toBeLessThan(0.05);
  });

  test('aboard — at the door, in the aisle, in the seat, on the pass — the cabin in flight', () => {
    expect(ambience('browse', 'door', 0.5)).toMatchObject({ airport: 0, cabin: 0.8, outside: 0 });
    expect(ambience('browse', 'aisle', 0.5)).toMatchObject({ cabin: 0.8 });
    expect(ambience('seated', 'aisle', 0.5)).toMatchObject({ cabin: 0.8 });
    expect(ambience('confirmed', 'pass', 0.5)).toMatchObject({ cabin: 0.8 });
  });

  test('out through the window the night air takes over, and the outro is quiet', () => {
    expect(ambience('confirmed', 'exit', 0)).toMatchObject({ cabin: 0.8, outside: 0 });
    expect(ambience('confirmed', 'exit', 0.5)).toMatchObject({ cabin: 0, outside: 0.55 });
    expect(ambience('confirmed', 'outro', 1).outside).toBeCloseTo(0.12);
    expect(ambience('thanks', 'outro', 1).outside).toBeCloseTo(0.12);
  });

  test('a flight is announced a few seconds into the airport, then now and then', () => {
    expect(announcementDue(3, { airportSince: 0, lastAt: null })).toBe(false);
    expect(announcementDue(7, { airportSince: 0, lastAt: null })).toBe(true);
    expect(announcementDue(30, { airportSince: 0, lastAt: 7 })).toBe(false);
    expect(announcementDue(55, { airportSince: 0, lastAt: 7 })).toBe(true);
    // not while away from the airport
    expect(announcementDue(100, { airportSince: null, lastAt: null })).toBe(false);
  });

  test('events become one-shots', () => {
    expect(oneShots(snap({ phase: 'browse' }), snap({ phase: 'seated' }))).toEqual(['ding']);
    expect(oneShots(snap({ phase: 'seated' }), snap({ phase: 'confirmed', chapter: 'pass' }))).toEqual(['ding']);
    expect(oneShots(snap({ phase: 'confirmed', chapter: 'pass' }), snap({ phase: 'confirmed', chapter: 'exit' }))).toEqual(['gust']);
    expect(oneShots(snap({ passFlips: 2 }), snap({ passFlips: 3 }))).toEqual(['rustle']);
    expect(oneShots(snap({}), snap({}))).toEqual([]);
    expect(oneShots(snap({ phase: 'seated' }), snap({ phase: 'browse' }))).toEqual([]);
    expect(oneShots(snap({ phase: 'confirmed', chapter: 'exit' }), snap({ phase: 'confirmed', chapter: 'pass' }))).toEqual([]);
  });
});
