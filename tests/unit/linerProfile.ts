// Test util: the cabin liner's half-width from the airliner meta's grid (stations × heights), bilinear.

interface LinerMeta {
  cabin: { liner: { stations: number[]; heights: number[]; halfWidth: number[][] } };
}

function bracket(values: number[], v: number): [number, number] {
  if (v < values[0] - 1e-9 || v > values[values.length - 1] + 1e-9) throw new Error(`${v} is outside the liner grid`);
  const i = Math.min(Math.max(values.findIndex((x) => x >= v), 1), values.length - 1);
  return [i - 1, (v - values[i - 1]) / (values[i] - values[i - 1])];
}

export function linerHalfWidthAt(meta: LinerMeta, station: number, y: number): number {
  const { stations, heights, halfWidth } = meta.cabin.liner;
  const [i, u] = bracket(stations, station);
  const [j, w] = bracket(heights, y);
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
  return lerp(lerp(halfWidth[i][j], halfWidth[i][j + 1], w), lerp(halfWidth[i + 1][j], halfWidth[i + 1][j + 1], w), u);
}
