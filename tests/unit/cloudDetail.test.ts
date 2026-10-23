import { describe, expect, test } from 'vitest';
import { trackProgress } from '@/experience/chapters';
import { cloudScale } from '@/experience/cloudDetail';

describe('cloud resolution', () => {
  test('halves while walking the aisle, where clouds only show through small windows', () => {
    expect(cloudScale('browse', trackProgress('pre', 'aisle', 0.5))).toBe(0.25);
  });

  test('halves once the door flight is inside the cabin', () => {
    expect(cloudScale('browse', trackProgress('pre', 'door', 0.9))).toBe(0.25);
  });

  test('stays full outside, at the seat and on the pass', () => {
    expect(cloudScale('browse', trackProgress('pre', 'sky', 0.5))).toBe(0.5);
    expect(cloudScale('browse', trackProgress('pre', 'door', 0.3))).toBe(0.5);
    expect(cloudScale('seated', 0.6)).toBe(0.5);
    expect(cloudScale('confirmed', trackProgress('post', 'pass', 0.5))).toBe(0.5);
  });

  test('halves on the way out and behind the outro, where the sky fills the moving view', () => {
    expect(cloudScale('confirmed', trackProgress('post', 'exit', 0.1))).toBeCloseTo(0.25);
    expect(cloudScale('confirmed', trackProgress('post', 'exit', 0.9))).toBeCloseTo(0.25);
    expect(cloudScale('confirmed', trackProgress('post', 'outro', 0.5))).toBeCloseTo(0.25);
    expect(cloudScale('thanks', trackProgress('post', 'outro', 0.5))).toBeCloseTo(0.25);
  });

  test('scales with a tier base', () => {
    expect(cloudScale('browse', trackProgress('pre', 'aisle', 0.5), 0.35)).toBeCloseTo(0.175);
  });
});
