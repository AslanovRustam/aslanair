import { statSync } from 'node:fs';
import sharp from 'sharp';
import { describe, expect, test } from 'vitest';
import { INTRO } from '@/experience/introState';

const PICTURE = `public${INTRO.picture.src}`;

describe('hero plane picture', () => {
  test('the plane picture is a transparent WebP at twice the hero frame, under 500 KB', async () => {
    const meta = await sharp(PICTURE).metadata();
    expect(meta.format).toBe('webp');
    expect(meta.width).toBe(2 * INTRO.picture.width);
    expect(meta.height).toBe(2 * INTRO.picture.height);
    expect(meta.hasAlpha).toBe(true);
    expect(statSync(PICTURE).size).toBeLessThanOrEqual(500_000);
  });

  test('it holds the plane alone: clear around it, solid inside its box', async () => {
    const { data, info } = await sharp(PICTURE).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const alpha = (fx: number, fy: number) => data[(Math.round(fy * (info.height - 1)) * info.width + Math.round(fx * (info.width - 1))) * 4 + 3];
    // corners and the band under the plane (where page chrome such as the loader would show) are see-through
    for (const [fx, fy] of [[0, 0], [1, 0], [0, 1], [1, 1], [0.5, 0.75], [0.5, 0.95]]) expect(alpha(fx, fy), `${fx},${fy}`).toBe(0);
    const { plane } = INTRO.picture;
    let solid = 0;
    for (let i = 0; i <= 20; i++) if (alpha(plane.left + ((plane.right - plane.left) * i) / 20, (plane.top + plane.bottom) / 2) === 255) solid++;
    expect(solid).toBeGreaterThanOrEqual(8);
  });

  test("the plane's box in introState is the picture's measured opaque box", async () => {
    const { data, info } = await sharp(PICTURE).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    let [x0, y0, x1, y1] = [Infinity, Infinity, -Infinity, -Infinity];
    for (let y = 0; y < info.height; y++)
      for (let x = 0; x < info.width; x++)
        if (data[(y * info.width + x) * 4 + 3] > 0) [x0, y0, x1, y1] = [Math.min(x0, x), Math.min(y0, y), Math.max(x1, x), Math.max(y1, y)];
    const { plane } = INTRO.picture;
    expect(x0 / info.width).toBeCloseTo(plane.left, 2);
    expect((x1 + 1) / info.width).toBeCloseTo(plane.right, 2);
    expect(y0 / info.height).toBeCloseTo(plane.top, 2);
    expect((y1 + 1) / info.height).toBeCloseTo(plane.bottom, 2);
  });
});
