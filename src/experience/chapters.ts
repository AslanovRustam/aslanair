export type Track = 'pre' | 'post';
export type ChapterId = 'sky' | 'door' | 'aisle' | 'pass' | 'exit' | 'outro';

export interface ChapterRange {
  id: ChapterId;
  start: number;
  end: number;
  heightVh: number;
}

/** Scroll tracks: 'pre' before a seat is confirmed, 'post' after. Ranges are fractions of the track. */
export const TRACKS: Record<Track, ChapterRange[]> = {
  pre: [
    { id: 'sky', start: 0, end: 0.2, heightVh: 100 },
    { id: 'door', start: 0.2, end: 0.45, heightVh: 125 },
    { id: 'aisle', start: 0.45, end: 1, heightVh: 275 },
  ],
  post: [
    { id: 'pass', start: 0, end: 0.15, heightVh: 60 },
    { id: 'exit', start: 0.15, end: 0.7, heightVh: 220 },
    { id: 'outro', start: 0.7, end: 1, heightVh: 120 },
  ],
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
