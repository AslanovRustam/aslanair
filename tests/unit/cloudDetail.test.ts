import { describe, expect, test } from 'vitest';
import { trackProgress } from '@/experience/chapters';
import { cloudScale } from '@/experience/cloudDetail';

describe('cloud resolution', () => {
  test('halves while walking the aisle, where clouds only show through small windows', () => {
    expect(cloudScale('browse', trackProgress('pre', 'aisle', 0.5))).toBe(0.25);
  });

  test('stays full outside, at the seat, on the pass and through the exit', () => {
    expect(cloudScale('browse', trackProgress('pre', 'sky', 0.5))).toBe(0.5);
    expect(cloudScale('browse', trackProgress('pre', 'door', 0.5))).toBe(0.5);
    expect(cloudScale('seated', 0.6)).toBe(0.5);
    expect(cloudScale('confirmed', trackProgress('post', 'pass', 0.5))).toBe(0.5);
    expect(cloudScale('confirmed', trackProgress('post', 'exit', 0.5))).toBe(0.5);
  });

  test('scales with a tier base', () => {
    expect(cloudScale('browse', trackProgress('pre', 'aisle', 0.5), 0.35)).toBeCloseTo(0.175);
  });
});
