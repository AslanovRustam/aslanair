import { stationToX, WINDOW, windowStations } from './geometry';
import { linerHalfWidthAt, type LinerMeta } from './linerProfile';

/**
 * The window bezels (spec r4 §9.4): a panel the colour of the wall round every window, a few millimetres proud of the
 * liner, its opening a smooth rounded rectangle just inside the liner's cut (whose corners are straight segments),
 * and a second one at the far end of the window's reveal, just inside the hull's cut, so the glass's own outline reads
 * round too when the window is seen at an angle — without a single new triangle in the airliner. Metres: `margin` of
 * panel round the window (`farMargin` for the far one, which only has to cover the cut's rim), the opening `inset`
 * inside the cut and its corners `cornerInset` tighter, `standoff` off the liner, its outer edge feathered over
 * `feather`; `grid` quads across × up each panel, to follow the liner's curve. Narrow rings: a panel drawn over the
 * wall costs its whole area on a weak GPU.
 */
export const BEZEL = { margin: 0.04, farMargin: 0.02, inset: 0.012, cornerInset: 0.006, standoff: 0.004, feather: 0.02, grid: [6, 8] } as const;

export interface WindowCentre {
  station: number;
  y: number;
  side: -1 | 1;
}

/** Every window, port (−1) then starboard (+1). */
export function windowCentres(): WindowCentre[] {
  return ([-1, 1] as const).flatMap((side) => windowStations().map((station) => ({ station, y: WINDOW.y, side })));
}

/** The opening: half its width and height, and its corners' radius (m). */
export function bezelOpening(): { halfW: number; halfH: number; radius: number } {
  return { halfW: WINDOW.w / 2 - BEZEL.inset, halfH: WINDOW.h / 2 - BEZEL.inset, radius: WINDOW.r - BEZEL.cornerInset };
}

/**
 * One mesh for every bezel, in the aircraft's frame: each panel a grid laid on the liner (its half-width from the
 * airliner meta) — the near ones `standoff` proud of it, then the far ones `linerInset` further out, at the hull's
 * cut — all facing the cabin; texture coordinates in metres from the window's centre (u towards the nose, v up), and
 * each vertex's panel's outer half-size (`outer`), for its feathered edge.
 */
export function bezelGeometryData(
  meta: LinerMeta & { linerInset: number },
  windows: WindowCentre[] = windowCentres(),
): { positions: Float32Array; uvs: Float32Array; outer: Float32Array; indices: Uint32Array } {
  const [cols, rows] = BEZEL.grid;
  const per = (cols + 1) * (rows + 1);
  const panels = [
    { offset: -BEZEL.standoff, margin: BEZEL.margin },
    { offset: meta.linerInset - BEZEL.standoff, margin: BEZEL.farMargin },
  ].flatMap((layer) => windows.map((w) => ({ ...w, ...layer })));
  const positions = new Float32Array(panels.length * per * 3);
  const uvs = new Float32Array(panels.length * per * 2);
  const outer = new Float32Array(panels.length * per * 2);
  const indices = new Uint32Array(panels.length * cols * rows * 6);
  let p = 0;
  let t = 0;
  let q = 0;
  panels.forEach((w, k) => {
    const halfU = WINDOW.w / 2 + w.margin;
    const halfV = WINDOW.h / 2 + w.margin;
    for (let j = 0; j <= rows; j++) {
      for (let i = 0; i <= cols; i++) {
        const u = -halfU + (2 * halfU * i) / cols;
        const v = -halfV + (2 * halfV * j) / rows;
        const y = w.y + v;
        // +u is towards the nose: +x, a lower station
        positions.set([stationToX(w.station) + u, y, w.side * (linerHalfWidthAt(meta, w.station - u, y) + w.offset)], p);
        uvs.set([u, v], t);
        outer.set([halfU, halfV], t);
        p += 3;
        t += 2;
      }
    }
    const base = k * per;
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        const a = base + j * (cols + 1) + i;
        const [b, c, d] = [a + 1, a + cols + 2, a + cols + 1];
        // facing the cabin: +z on the port side, −z on the starboard
        indices.set(w.side < 0 ? [a, b, c, a, c, d] : [a, c, b, a, d, c], q);
        q += 6;
      }
    }
  });
  return { positions, uvs, outer, indices };
}
