import { defineConfig, devices } from '@playwright/test';

// Full Chromium on the real GPU: the default headless shell falls back to SwiftShader,
// which makes the raymarched clouds take minutes per scroll test.
const desktop = {
  ...devices['Desktop Chrome'],
  viewport: { width: 1440, height: 800 },
  channel: 'chromium',
  launchOptions: { args: ['--enable-gpu', '--use-angle=d3d11', '--ignore-gpu-blocklist'] },
};

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 90_000,
  // Every worker renders the full WebGL scene on the same GPU (often the integrated one); more than two
  // starve each other and time out ordinary 5 s expectations.
  workers: 2,
  use: {
    baseURL: 'http://localhost:3100',
    viewport: { width: 1440, height: 800 },
  },
  projects: [
    {
      name: 'chromium',
      testIgnore: /perf\.spec\.ts/,
      use: desktop,
    },
    {
      // frame-rate probe and review shots: after the main suite, alone on the GPU — and on the integrated GPU,
      // the spec's reference "weak device", even when the laptop would hand Chromium the discrete one
      name: 'perf',
      testMatch: /perf\.spec\.ts/,
      dependencies: ['chromium'],
      use: { ...desktop, launchOptions: { args: [...desktop.launchOptions.args, '--force_low_power_gpu'] } },
    },
  ],
  webServer: {
    command: 'npm run dev -- -p 3100',
    port: 3100,
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
