import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 90_000,
  use: {
    baseURL: 'http://localhost:3100',
    viewport: { width: 1440, height: 800 },
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 800 } } }],
  webServer: {
    command: 'npm run dev -- -p 3100',
    port: 3100,
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
