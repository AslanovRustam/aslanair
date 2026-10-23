import { describe, expect, test } from 'vitest';
import { trackProgress } from '@/experience/chapters';
import { cameraInsideCabin, pointInsideCabin, worldMode } from '@/experience/worldState';

describe('world mode', () => {
  test('showcase until the camera is inside, night from then on', () => {
    expect(worldMode('browse', trackProgress('pre', 'sky', 0.5))).toBe('showcase');
    expect(worldMode('browse', trackProgress('pre', 'door', 0.3))).toBe('showcase');
    expect(worldMode('browse', trackProgress('pre', 'door', 0.9))).toBe('night');
    expect(worldMode('browse', trackProgress('pre', 'aisle', 0.5))).toBe('night');
    expect(worldMode('confirmed', trackProgress('post', 'exit', 0.5))).toBe('night');
  });

  test('every phase past browsing counts as aboard', () => {
    for (const phase of ['seated', 'confirmed', 'thanks'] as const) expect(cameraInsideCabin(phase, 0)).toBe(true);
    expect(cameraInsideCabin('browse', 0)).toBe(false);
  });
});

describe('inside the cabin shell', () => {
  test('the aisle is inside; the hero camera and a wing tip are not', () => {
    expect(pointInsideCabin(5, 1.2, 0)).toBe(true);
    expect(pointInsideCabin(42, 6.5, -36)).toBe(false);
    expect(pointInsideCabin(-2.2, 0.1, -16.9)).toBe(false);
    expect(pointInsideCabin(5, 1.2, 1.9)).toBe(false);
  });
});
