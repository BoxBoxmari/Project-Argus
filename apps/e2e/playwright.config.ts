import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  timeout: 120000,
  expect: { timeout: 15000 },
  use: {
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    locale: process.env.PW_LOCALE || 'en-US',
    launchOptions: { slowMo: 0 }
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'], channel: process.env.ARGUS_BROWSER_CHANNEL || 'chrome' } },
    { name: 'msedge', use: { ...devices['Desktop Chrome'], channel: process.env.ARGUS_BROWSER_CHANNEL || 'msedge' } }
  ],
  reporter: [['list']]
});
