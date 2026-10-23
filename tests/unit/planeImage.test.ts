import { readFileSync, statSync } from 'node:fs';
import sharp from 'sharp';
import { describe, expect, test } from 'vitest';
import { INTRO } from '@/experience/introState';

const PICTURE = 'public/images/plane-hero.png';

describe('hero plane picture', () => {
  test('the plane picture is a transparent 1600×900 PNG under 500 KB', () => {
    const png = readFileSync(PICTURE);
    expect(png.readUInt32BE(16)).toBe(1600);
    expect(png.readUInt32BE(20)).toBe(900);
    expect(png[25]).toBe(6); // colour type RGBA
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
});
