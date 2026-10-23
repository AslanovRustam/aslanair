import { readFileSync, statSync } from 'node:fs';
import { describe, expect, test } from 'vitest';

const PICTURE = 'public/images/plane-hero.png';

describe('hero plane picture', () => {
  test('the plane picture is a transparent 1600×900 PNG under 500 KB', () => {
    const png = readFileSync(PICTURE);
    expect(png.readUInt32BE(16)).toBe(1600);
    expect(png.readUInt32BE(20)).toBe(900);
    expect(png[25]).toBe(6); // colour type RGBA
    expect(statSync(PICTURE).size).toBeLessThanOrEqual(500_000);
  });
});
