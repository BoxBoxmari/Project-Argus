import { defineConfig, devices } from '@playwright/test';
const grep = process.env.E2E_GREP ? new RegExp(process.env.E2E_GREP) : /\[stable\]/i;
const retries = Number(process.env.E2E_RETRIES ?? 2);
const workers = Number(process.env.E2E_WORKERS ?? 2);
export default defineConfig({
  timeout: 120000,
  expect: { timeout: 15000 },
  forbidOnly: true,
  retries,
  workers,
  grep,
  use: {
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    locale: process.env.PW_LOCALE || 'en-US'
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'], channel: process.env.ARGUS_BROWSER_CHANNEL || 'chrome' } }
  ],
  reporter: [['list'], ['json', { outputFile: 'reports/results.json' }]]
});
