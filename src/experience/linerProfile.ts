// Half-widths from the airliner meta's grids (stations × heights), bilinear: the cabin liner's, and the hull's round
// door 1L.

/** A half-width grid of the meta: `halfWidth[i][j]` at `stations[i]` and `heights[j]` (three.js y). */
export interface SkinGrid {
  stations: number[];
  heights: number[];
  halfWidth: number[][];
}

export interface LinerMeta {
  cabin: { liner: SkinGrid };
}

function bracket(values: number[], v: number): [number, number] {
  if (v < values[0] - 1e-9 || v > values[values.length - 1] + 1e-9) throw new Error(`${v} is outside the grid`);
  const i = Math.min(Math.max(values.findIndex((x) => x >= v), 1), values.length - 1);
  return [i - 1, (v - values[i - 1]) / (values[i] - values[i - 1])];
}

export function gridHalfWidthAt(grid: SkinGrid, station: number, y: number): number {
  const { stations, heights, halfWidth } = grid;
  const [i, u] = bracket(stations, station);
  const [j, w] = bracket(heights, y);
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
  return lerp(lerp(halfWidth[i][j], halfWidth[i][j + 1], w), lerp(halfWidth[i + 1][j], halfWidth[i + 1][j + 1], w), u);
}

/** The cabin liner's half-width at a station and height. */
export function linerHalfWidthAt(meta: LinerMeta, station: number, y: number): number {
  return gridHalfWidthAt(meta.cabin.liner, station, y);
}
