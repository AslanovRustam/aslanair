import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { WINDOW, windowStations } from '@/experience/geometry';
import { linerHalfWidthAt } from '@/experience/linerProfile';
import { BEZEL, bezelGeometryData, bezelOpening, windowCentres } from '@/experience/windowBezel';

const meta = JSON.parse(readFileSync('public/models/airliner.meta.json', 'utf8'));
const [cols, rows] = BEZEL.grid;
const PER_PANEL = (cols + 1) * (rows + 1);

describe('window bezels', () => {
  test('two bezels per window, both sides of the cabin: one on the liner, one at the far end of its reveal', () => {
    const centres = windowCentres();
    expect(centres).toHaveLength(2 * windowStations().length);
    expect(centres.filter((c) => c.side === -1)).toHaveLength(windowStations().length);
    const data = bezelGeometryData(meta, centres);
    expect(data.positions.length / 3).toBe(2 * centres.length * PER_PANEL);
    expect(data.uvs.length / 2).toBe(2 * centres.length * PER_PANEL);
    expect(data.indices.length).toBe(2 * centres.length * cols * rows * 6);
  });

  test('the near bezel lies a few millimetres proud of the liner, the far one just inside the hull at the cut', () => {
    const centres = windowCentres();
    const data = bezelGeometryData(meta, centres);
    const near = centres.length * PER_PANEL;
    for (let k = 0; k < data.positions.length / 3; k++) {
      const [x, y, z] = [data.positions[3 * k], data.positions[3 * k + 1], data.positions[3 * k + 2]];
      const liner = linerHalfWidthAt(meta, 18.8 - x, y); // stationToX inverted
      const want = k < near ? liner - BEZEL.standoff : liner + meta.linerInset - BEZEL.standoff;
      expect(Math.abs(z), `vertex ${k}`).toBeCloseTo(want, 3);
    }
  });

  test('its opening sits just inside the liner cut, so the cut’s straight segments never show', () => {
    const { halfW, halfH, radius } = bezelOpening();
    expect(halfW).toBeLessThanOrEqual(WINDOW.w / 2 - 0.01);
    expect(halfW).toBeGreaterThanOrEqual(WINDOW.w / 2 - 0.02);
    expect(halfH).toBeLessThanOrEqual(WINDOW.h / 2 - 0.01);
    expect(halfH).toBeGreaterThanOrEqual(WINDOW.h / 2 - 0.02);
    expect(radius).toBeCloseTo(WINDOW.r - 0.006, 9);
  });

  // (float32 on the GPU: six places)
  test('a bezel’s texture coordinates are metres from its window’s centre', () => {
    const data = bezelGeometryData(meta, [windowCentres()[0]]);
    const us = Array.from({ length: PER_PANEL }, (_, k) => data.uvs[2 * k]);
    const vs = Array.from({ length: PER_PANEL }, (_, k) => data.uvs[2 * k + 1]);
    expect(Math.min(...us)).toBeCloseTo(-(WINDOW.w / 2 + BEZEL.margin), 6);
    expect(Math.max(...us)).toBeCloseTo(WINDOW.w / 2 + BEZEL.margin, 6);
    expect(Math.min(...vs)).toBeCloseTo(-(WINDOW.h / 2 + BEZEL.margin), 6);
    expect(Math.max(...vs)).toBeCloseTo(WINDOW.h / 2 + BEZEL.margin, 6);
  });
});
