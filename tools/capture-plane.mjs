// npm run capture:plane — photographs the aircraft for the hero, from the live scene at the intro's swap pose.
// Needs the dev server on :3100 (npm run dev -- -p 3100). Writes public/images/plane-hero.png (1600×900, RGBA).
import { mkdirSync, statSync } from 'node:fs';
import { chromium } from '@playwright/test';

const OUT = 'public/images/plane-hero.png';
const browser = await chromium.launch({ channel: 'chromium', args: ['--enable-gpu', '--use-angle=d3d11', '--ignore-gpu-blocklist'] });
try {
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
  await page.goto('http://localhost:3100/?capture=plane');
  await page.waitForFunction(() => window.__aslanCaptureReady === true, null, { timeout: 90_000 });
  // page chrome over the canvas: the dev server's indicator, and the loader (it waits for a scene this mode never
  // reports ready)
  await page.addStyleTag({ content: 'nextjs-portal, #loader { display: none !important; }' });
  mkdirSync('public/images', { recursive: true });
  await page.locator('canvas').screenshot({ path: OUT, omitBackground: true });
  console.log(`${OUT}: ${(statSync(OUT).size / 1e3).toFixed(0)} KB`);
} finally {
  await browser.close();
}
