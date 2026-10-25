/**
 * playwright.config.ts — End-to-end tests (e2e/) in real Chromium against the Vite dev server.
 * Two projects: a desktop window (1440×900) and a phone (Pixel 7). Run with `npm run test:e2e`;
 * after an intended visual change, refresh the screenshots with `npm run test:e2e -- --update-snapshots`.
 */
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'retain-on-failure',
  },
  expect: {
    toHaveScreenshot: { maxDiffPixelRatio: 0.01 },
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: 'npm run dev -- --port 5173 --strictPort',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
  },
})
