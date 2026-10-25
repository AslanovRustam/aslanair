import { describe, expect, test } from 'vitest';
import { ding, gust, hum, rustle } from '@/audio/synth';

const SR = 22050;
const make = (name: 'hum' | 'ding' | 'rustle' | 'gust', seed: number) =>
  name === 'hum' ? hum(2, SR, seed) : name === 'ding' ? ding(SR) : name === 'rustle' ? rustle(SR, seed) : gust(SR, seed);
const rms = (a: Float32Array) => Math.sqrt(a.reduce((s, v) => s + v * v, 0) / a.length);
const peak = (a: Float32Array) => a.reduce((m, v) => Math.max(m, Math.abs(v)), 0);

describe('the synthesised sounds', () => {
  test.each(['hum', 'ding', 'rustle', 'gust'] as const)('%s is audible, bounded and deterministic', (name) => {
    const a = make(name, 1);
    const b = make(name, 1);
    expect(a).toEqual(b);
    expect(peak(a)).toBeLessThanOrEqual(0.9);
    expect(rms(a)).toBeGreaterThan(0.01);
  });

  test('their lengths', () => {
    expect(hum(4, SR, 1).length).toBe(4 * SR);
    expect(ding(SR).length).toBe(Math.round(1.4 * SR));
    expect(rustle(SR, 1).length).toBe(Math.round(0.35 * SR));
    expect(gust(SR, 1).length).toBe(Math.round(2.2 * SR));
  });

  test('the hum loops without a click', () => {
    const h = hum(4, SR, 1);
    expect(Math.abs(h[0] - h[h.length - 1])).toBeLessThan(0.02);
  });

  test('the ding rings out: loud at the strike, all but gone at the end', () => {
    const d = ding(SR);
    const head = d.subarray(0, SR / 10);
    const tail = d.subarray(d.length - SR / 10);
    expect(rms(tail)).toBeLessThan(rms(head) / 20);
  });

  test('the gust swells and dies away', () => {
    const g = gust(SR, 1);
    const third = Math.floor(g.length / 3);
    const [a, b, c] = [g.subarray(0, third), g.subarray(third, 2 * third), g.subarray(2 * third)].map(rms);
    expect(b).toBeGreaterThan(a);
    expect(b).toBeGreaterThan(c);
  });
});
