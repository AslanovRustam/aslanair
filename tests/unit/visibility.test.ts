import { describe, expect, test } from 'vitest';
import { trackProgress } from '@/experience/chapters';
import { cabinVisible } from '@/experience/visibility';

describe('cabin visibility (the placeholder box pokes through the hull, so show it only from inside)', () => {
  test('hidden in the sky shot and on the door approach', () => {
    expect(cabinVisible('browse', trackProgress('pre', 'sky', 0.5))).toBe(false);
    expect(cabinVisible('browse', trackProgress('pre', 'door', 0.5))).toBe(false);
  });

  test('shown once the camera is through the door, in the aisle and while seated', () => {
    expect(cabinVisible('browse', trackProgress('pre', 'door', 0.7))).toBe(true);
    expect(cabinVisible('browse', trackProgress('pre', 'aisle', 0.5))).toBe(true);
    expect(cabinVisible('seated', 0.9)).toBe(true);
  });

  test('shown with the pass and until the camera leaves through the window', () => {
    expect(cabinVisible('confirmed', trackProgress('post', 'pass', 0.5))).toBe(true);
    expect(cabinVisible('confirmed', trackProgress('post', 'exit', 0.3))).toBe(true);
    expect(cabinVisible('confirmed', trackProgress('post', 'exit', 0.5))).toBe(false);
    expect(cabinVisible('thanks', trackProgress('post', 'outro', 0.5))).toBe(false);
  });
});
