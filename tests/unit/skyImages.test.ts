import { readFileSync, statSync } from 'node:fs';
import sharp from 'sharp';
import { describe, expect, test } from 'vitest';
import { copy } from '@/content/copy';
import { SKY_IMAGES } from '@/experience/clouds';

const file = (url: string) => `public${url}`;

describe('the night sky images', () => {
  test('the star panorama is a 4096 × 2048 WebP under 1.6 MB', async () => {
    const meta = await sharp(file(SKY_IMAGES.stars)).metadata();
    expect(meta.format).toBe('webp');
    expect([meta.width, meta.height]).toEqual([4096, 2048]);
    expect(statSync(file(SKY_IMAGES.stars)).size).toBeLessThanOrEqual(1_600_000);
  });

  test('the cloud sea is a WebP at least 2048 on its short side, under 1.2 MB', async () => {
    const meta = await sharp(file(SKY_IMAGES.cloudSea)).metadata();
    expect(meta.format).toBe('webp');
    expect(Math.min(meta.width!, meta.height!)).toBeGreaterThanOrEqual(2048);
    expect(statSync(file(SKY_IMAGES.cloudSea)).size).toBeLessThanOrEqual(1_200_000);
  });

  test('CREDITS.md names both images, each with its licence', () => {
    const credits = readFileSync('public/images/sky/CREDITS.md', 'utf8');
    for (const url of [SKY_IMAGES.stars, SKY_IMAGES.cloudSea]) {
      const name = url.split('/').pop()!;
      const section = credits.slice(credits.indexOf(name));
      expect(credits, name).toContain(name);
      expect(section, `${name} licence`).toMatch(/Licen[cs]e: \S/);
    }
  });

  test("the footer credits the sky's sources (spec r5 §8)", () => {
    const { sky } = copy.footer;
    expect(sky.line).toContain('ESO/S. Brunier');
    // CC BY 4.0 asks a changed work to say so
    expect(sky.line).toMatch(/adapted/);
    expect(sky.licence).toBe('CC BY 4.0');
    expect(sky.clouds).toBe('Clouds: NASA');
  });
});
