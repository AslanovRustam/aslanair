import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 90_000,
  use: {
    baseURL: 'http://localhost:3100',
    viewport: { width: 1440, height: 800 },
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 800 },
        // Full Chromium on the real GPU: the default headless shell falls back to SwiftShader,
        // which makes the raymarched clouds take minutes per scroll test.
        channel: 'chromium',
        launchOptions: { args: ['--enable-gpu', '--use-angle=d3d11', '--ignore-gpu-blocklist'] },
      },
    },
  ],
  webServer: {
    command: 'npm run dev -- -p 3100',
    port: 3100,
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
