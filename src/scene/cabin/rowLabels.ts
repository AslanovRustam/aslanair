// Row labels hanging under the bins' aisle edge, facing the camera that walks aft. Pure geometry + atlas UVs.
import { BIN } from '@/experience/cabinLayout';
import { ROWS, rowX } from '@/experience/geometry';

/** A label plate (metres): centred `inset` outboard of the bin's aisle edge, its top `drop` below the bin. */
export const LABEL = { width: 0.24, height: 0.06, inset: 0.1, drop: 0.005 } as const;
/** 8 × 8 cells of 256 × 64 px — the plate's 4:1 aspect. */
export const ATLAS = { width: 2048, height: 512, cols: 8, rows: 8 } as const;

export const labelCell = (row: number, side: -1 | 1) => (row - 1) * 2 + (side > 0 ? 1 : 0);

export function rowLabelQuads(): { position: Float32Array; uv: Float32Array; index: Uint16Array } {
  const n = ROWS * 2;
  const position = new Float32Array(n * 12);
  const uv = new Float32Array(n * 8);
  const index = new Uint16Array(n * 6);
  let q = 0;
  for (let row = 1; row <= ROWS; row++) {
    for (const side of [-1, 1] as const) {
      // at the forward end of the row's bin, facing +X; seen from +X, screen right is -Z
      const x = rowX(row) + BIN.length / 2 - 0.01;
      const zc = side * (BIN.aisleZ + LABEL.inset);
      const y1 = BIN.bottomY - LABEL.drop;
      const y0 = y1 - LABEL.height;
      const zl = zc + LABEL.width / 2;
      const zr = zc - LABEL.width / 2;
      position.set([x, y0, zl, x, y0, zr, x, y1, zr, x, y1, zl], q * 12);
      const cell = labelCell(row, side);
      const u0 = (cell % ATLAS.cols) / ATLAS.cols;
      const u1 = u0 + 1 / ATLAS.cols;
      const v1 = 1 - Math.floor(cell / ATLAS.cols) / ATLAS.rows;
      const v0 = v1 - 1 / ATLAS.rows;
      uv.set([u0, v0, u1, v0, u1, v1, u0, v1], q * 8);
      index.set([q * 4, q * 4 + 1, q * 4 + 2, q * 4, q * 4 + 2, q * 4 + 3], q * 6);
      q++;
    }
  }
  return { position, uv, index };
}
