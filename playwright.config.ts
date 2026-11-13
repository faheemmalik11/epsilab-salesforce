import { defineConfig, devices } from '@playwright/test';

/** Set BASE_URL and API_URL to test a running deployment (the Docker container) instead of a local server. */
const externalBaseUrl = process.env.BASE_URL;
const GUI_PORT = 3100;
const API_PORT = 8180;

export const API_URL = process.env.API_URL ?? (externalBaseUrl ? 'http://localhost:8080' : `http://localhost:${API_PORT}`);

export default defineConfig({
  testDir: 'tests/e2e',
  workers: 1,
  fullyParallel: false,
  timeout: 60_000,
  reporter: [['list']],
  use: {
    baseURL: externalBaseUrl ?? `http://localhost:${GUI_PORT}`,
    viewport: { width: 1440, height: 900 },
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } }],
  webServer: externalBaseUrl
    ? undefined
    : {
        // A fresh database for every run, so tests always start from the 21,628-lead baseline.
        command: 'node dist/server/scripts/build-db.js && node dist/server/src/server/main.js',
        url: `http://localhost:${GUI_PORT}`,
        reuseExistingServer: false,
        timeout: 60_000,
        env: { DATA_DIR: '.e2e-data', GUI_PORT: String(GUI_PORT), API_PORT: String(API_PORT), CLOCK_MODE: 'fixed' },
      },
});
