import { describe, expect, test } from 'vitest';
import { chapterAt, trackProgress } from '@/experience/chapters';

describe('scroll chapters', () => {
  test('pre track: sky → door → aisle, boundaries belong to the later chapter', () => {
    expect(chapterAt('pre', 0)).toEqual({ id: 'sky', t: 0 });
    expect(chapterAt('pre', 0.2)).toEqual({ id: 'door', t: 0 });
    expect(chapterAt('pre', 1)).toEqual({ id: 'aisle', t: 1 });
  });

  test('post track maps progress to the exit chapter locally', () => {
    expect(chapterAt('post', 0.425).id).toBe('exit');
    expect(chapterAt('post', 0.425).t).toBeCloseTo(0.5);
  });

  test('progress is clamped and invertible', () => {
    expect(chapterAt('pre', -1)).toEqual({ id: 'sky', t: 0 });
    expect(trackProgress('post', 'exit', 0.5)).toBeCloseTo(0.425);
  });
});
