import { describe, expect, test } from 'vitest';
import { chapterAt, trackProgress, TRACKS } from '@/experience/chapters';

describe('scroll chapters', () => {
  test('pre track: the journey, then the door and the aisle; boundaries belong to the later chapter', () => {
    expect(TRACKS.pre.map((r) => r.id)).toEqual(['sky', 'destinations', 'transfer', 'ready', 'door', 'aisle']);
    expect(chapterAt('pre', 0)).toEqual({ id: 'sky', t: 0 });
    expect(chapterAt('pre', TRACKS.pre[1].start)).toEqual({ id: 'destinations', t: 0 });
    expect(chapterAt('pre', 1)).toEqual({ id: 'aisle', t: 1 });
  });

  test('ranges run from 0 to 1 without gaps, each in proportion to its height', () => {
    for (const track of [TRACKS.pre, TRACKS.post]) {
      const total = track.reduce((s, r) => s + r.heightVh, 0);
      expect(track[0].start).toBe(0);
      expect(track[track.length - 1].end).toBeCloseTo(1, 12);
      for (const [i, r] of track.entries()) {
        if (i > 0) expect(r.start).toBe(track[i - 1].end);
        expect(r.end - r.start).toBeCloseTo(r.heightVh / total, 12);
      }
    }
  });

  test('post track unchanged: pass, exit, outro', () => {
    expect(TRACKS.post.map((r) => [r.id, r.start, r.end])).toEqual([
      ['pass', 0, 0.15],
      ['exit', 0.15, 0.7],
      ['outro', 0.7, 1],
    ]);
    expect(chapterAt('post', 0.425).id).toBe('exit');
    expect(chapterAt('post', 0.425).t).toBeCloseTo(0.5);
  });

  test('progress is clamped and invertible', () => {
    expect(chapterAt('pre', -1)).toEqual({ id: 'sky', t: 0 });
    expect(trackProgress('post', 'exit', 0.5)).toBeCloseTo(0.425);
    expect(chapterAt('pre', trackProgress('pre', 'transfer', 0.4)).t).toBeCloseTo(0.4, 12);
  });
});
