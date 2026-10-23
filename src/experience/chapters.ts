export type Track = 'pre' | 'post';
export type ChapterId = 'sky' | 'destinations' | 'transfer' | 'ready' | 'door' | 'aisle' | 'pass' | 'exit' | 'outro';

export interface ChapterRange {
  id: ChapterId;
  start: number;
  end: number;
  heightVh: number;
}

/** A track's chapters in order, their ranges the share of the scroll height each takes: they always add up to 1. */
function track(chapters: { id: ChapterId; heightVh: number }[]): ChapterRange[] {
  const total = chapters.reduce((sum, c) => sum + c.heightVh, 0);
  let at = 0;
  return chapters.map((c) => {
    const start = at / total;
    at += c.heightVh;
    return { ...c, start, end: at / total };
  });
}

/**
 * Scroll tracks: 'pre' before a seat is confirmed, 'post' after. The pre track is the journey (first screen,
 * destinations, transfer, ready), then the door and the aisle (spec r3 §3).
 */
export const TRACKS: Record<Track, ChapterRange[]> = {
  pre: track([
    { id: 'sky', heightVh: 110 },
    { id: 'destinations', heightVh: 170 },
    { id: 'transfer', heightVh: 150 },
    { id: 'ready', heightVh: 130 },
    { id: 'door', heightVh: 125 },
    { id: 'aisle', heightVh: 275 },
  ]),
  post: track([
    { id: 'pass', heightVh: 60 },
    { id: 'exit', heightVh: 220 },
    { id: 'outro', heightVh: 120 },
  ]),
};

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

export function chapterAt(track: Track, progress: number): { id: ChapterId; t: number } {
  const p = clamp01(progress);
  const ranges = TRACKS[track];
  const range = ranges.find((r) => p >= r.start && p < r.end) ?? ranges[ranges.length - 1];
  return { id: range.id, t: clamp01((p - range.start) / (range.end - range.start)) };
}

export function trackProgress(track: Track, id: ChapterId, t: number): number {
  const range = TRACKS[track].find((r) => r.id === id);
  if (!range) throw new Error(`Chapter ${id} is not on the ${track} track`);
  return range.start + clamp01(t) * (range.end - range.start);
}
