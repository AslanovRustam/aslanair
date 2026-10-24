import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { trackProgress } from '@/experience/chapters';
import { exitControlPoints } from '@/experience/cameraPoses';
import { CABIN_WALL_Z } from '@/experience/geometry';
import { cameraInsideCabin, LINER_INSET, nightSkyDrawn, pointInsideCabin, pointInsideFuselage, worldMode } from '@/experience/worldState';

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

describe('inside the fuselage', () => {
  test('counts the wall: at the window on the way out the eye is in the fuselage, not the cabin', () => {
    const at = exitControlPoints({ row: 14, letter: 'A' })[1];
    expect(pointInsideCabin(at.x, at.y, at.z)).toBe(false);
    expect(pointInsideFuselage(at.x, at.y, at.z)).toBe(true);
  });

  test('ends just past the skin', () => {
    expect(pointInsideFuselage(5, 0.6, CABIN_WALL_Z + LINER_INSET + 0.2)).toBe(false);
    expect(LINER_INSET).toBe(JSON.parse(readFileSync('public/models/airliner.meta.json', 'utf8')).linerInset);
  });
});

describe('the night sky is drawn', () => {
  test('aboard, and unseen under the loader so its programs are ready before the door flight', () => {
    expect(nightSkyDrawn('browse', trackProgress('pre', 'sky', 0.5), true)).toBe(false);
    expect(nightSkyDrawn('browse', trackProgress('pre', 'sky', 0.5), false)).toBe(true);
    expect(nightSkyDrawn('browse', trackProgress('pre', 'door', 0.9), true)).toBe(true);
    expect(nightSkyDrawn('confirmed', trackProgress('post', 'outro', 0.5), true)).toBe(true);
  });
});
