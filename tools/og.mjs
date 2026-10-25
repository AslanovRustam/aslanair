// node tools/og.mjs [base URL, default http://localhost:3200]
// The share picture (public/og.png, 1200 × 630): the hero as the visitor first sees it — the title, the live plane —
// photographed from the running dev server, without the frame's links.
import { chromium } from '@playwright/test';

const base = process.argv[2] ?? 'http://localhost:3200';
const browser = await chromium.launch({ channel: 'chromium', args: ['--enable-gpu', '--use-angle=d3d11', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
await page.goto(base);
await page.waitForFunction(() => getComputedStyle(document.getElementById('loader')).visibility === 'hidden', null, { timeout: 90_000 });
// the hero alone: no dev badge, no header links, rail, footer or scroll hint
await page.addStyleTag({
  content: 'nextjs-portal, nav, footer, [data-slot], header > div { display: none !important; } [data-testid="hero"] .chapter-ui { visibility: hidden !important; }',
});
await page.waitForTimeout(2500); // the hero's entrance played out
await page.screenshot({ path: 'public/og.png' });
await browser.close();
console.log('public/og.png');
