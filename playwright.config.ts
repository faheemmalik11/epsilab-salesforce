import { defineConfig, devices } from '@playwright/test';

const externalBaseUrl = process.env.BASE_URL;

export default defineConfig({
  testDir: 'tests/e2e',
  use: {
    baseURL: externalBaseUrl ?? 'http://localhost:3000',
    viewport: { width: 1440, height: 900 },
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } }],
  webServer: externalBaseUrl
    ? undefined
    : { command: 'node dist/server/src/server/main.js', url: 'http://localhost:3000', reuseExistingServer: true },
});
