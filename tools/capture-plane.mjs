// npm run capture:plane — photographs the aircraft for the hero, from the live scene at the intro's swap pose.
// Needs the dev server on :3200 (npm run dev -- -p 3200). Writes public/images/plane-hero.webp: the 1600×900 frame at
// twice its size (3200×1800, with alpha), so the loader's picture stays sharp on 2× screens.
import { mkdirSync, rmSync, statSync } from 'node:fs';
import { chromium } from '@playwright/test';
import sharp from 'sharp';

const OUT = 'public/images/plane-hero.webp';
const browser = await chromium.launch({ channel: 'chromium', args: ['--enable-gpu', '--use-angle=d3d11', '--ignore-gpu-blocklist'] });
try {
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 2 });
  await page.goto('http://localhost:3200/?capture=plane');
  await page.waitForFunction(() => window.__aslanCaptureReady === true, null, { timeout: 90_000 });
  // page chrome over the canvas: the dev server's indicator, and the loader (it waits for a scene this mode never
  // reports ready)
  await page.addStyleTag({ content: 'nextjs-portal, #loader { display: none !important; }' });
  mkdirSync('public/images', { recursive: true });
  const png = await page.locator('canvas').screenshot({ omitBackground: true });
  await sharp(png).webp({ quality: 88, alphaQuality: 90, effort: 6 }).toFile(OUT);
  rmSync('public/images/plane-hero.png', { force: true });
  console.log(`${OUT}: ${(statSync(OUT).size / 1e3).toFixed(0)} KB`);
} finally {
  await browser.close();
}
