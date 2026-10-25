import { describe, expect, test } from 'vitest';
import { ambience, oneShots, type SoundSnapshot } from '@/audio/mix';

const snap = (s: Partial<SoundSnapshot>): SoundSnapshot => ({ phase: 'browse', chapter: 'sky', passFlips: 0, ...s });

describe('the mix', () => {
  test('outside in the sky, muffled cabin in the aisle', () => {
    expect(ambience('browse', 'sky', 0.5)).toMatchObject({ outside: 0.55, cabin: 0 });
    expect(ambience('browse', 'aisle', 0.5)).toMatchObject({ outside: 0.05, cabin: 0.35, cabinCutoffHz: 650 });
    expect(ambience('seated', 'aisle', 0.5)).toMatchObject({ outside: 0.05, cabin: 0.35 });
    expect(ambience('confirmed', 'pass', 0.5)).toMatchObject({ outside: 0.05, cabin: 0.35 });
  });

  test('the door crossfades continuously', () => {
    const a = ambience('browse', 'door', 0.49);
    const b = ambience('browse', 'door', 0.51);
    expect(Math.abs(a.cabin - b.cabin)).toBeLessThan(0.03);
    expect(ambience('browse', 'door', 0.2)).toMatchObject({ outside: 0.55, cabin: 0 });
    expect(ambience('browse', 'door', 0.8)).toMatchObject({ outside: 0.05, cabin: 0.35 });
  });

  test('out through the window the outside comes back, and the outro is quiet', () => {
    expect(ambience('confirmed', 'exit', 0)).toMatchObject({ outside: 0.05, cabin: 0.35 });
    expect(ambience('confirmed', 'exit', 0.5)).toMatchObject({ outside: 0.55, cabin: 0 });
    expect(ambience('confirmed', 'outro', 1).outside).toBeCloseTo(0.12);
    expect(ambience('thanks', 'outro', 1).outside).toBeCloseTo(0.12);
  });

  test('events become one-shots', () => {
    expect(oneShots(snap({ phase: 'browse' }), snap({ phase: 'seated' }))).toEqual(['ding']);
    expect(oneShots(snap({ phase: 'seated' }), snap({ phase: 'confirmed', chapter: 'pass' }))).toEqual(['ding']);
    expect(oneShots(snap({ phase: 'confirmed', chapter: 'pass' }), snap({ phase: 'confirmed', chapter: 'exit' }))).toEqual(['gust']);
    expect(oneShots(snap({ passFlips: 2 }), snap({ passFlips: 3 }))).toEqual(['rustle']);
    expect(oneShots(snap({}), snap({}))).toEqual([]);
    // standing up or going back is no event
    expect(oneShots(snap({ phase: 'seated' }), snap({ phase: 'browse' }))).toEqual([]);
    expect(oneShots(snap({ phase: 'confirmed', chapter: 'exit' }), snap({ phase: 'confirmed', chapter: 'pass' }))).toEqual([]);
  });
});
