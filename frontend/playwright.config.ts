/**
 * playwright.config.ts — End-to-end tests (e2e/) in real Chromium against the Vite dev server and the real
 * backend: the site's data comes from the Flask API (proxied by Vite), so the database must be seeded
 * (`docker compose exec backend flask seed`). The backend is reused when it already runs, else started with
 * `docker compose up`. The repo's .env is loaded so the sign-in tests can use the demo customer that the seed
 * creates (SEED_CUSTOMER_EMAIL / SEED_CUSTOMER_PASSWORD, see .env.example), and the backend's host port
 * (BACKEND_PORT, default 5000).
 * Two projects: a desktop window (1440×900) and a phone (Pixel 7). Run with `npm run test:e2e`;
 * after an intended visual change, refresh the screenshots with `npm run test:e2e -- --update-snapshots`.
 */
import { existsSync } from 'node:fs'
import { defineConfig, devices } from '@playwright/test'

/** The repository's local secrets file (git-ignored), read by compose too. */
const ENV_FILE = new URL('../.env', import.meta.url)
if (existsSync(ENV_FILE)) process.loadEnvFile(ENV_FILE)

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
  webServer: [
    {
      command: 'docker compose up postgres backend',
      cwd: '..',
      url: `http://localhost:${process.env.BACKEND_PORT || 5000}/api/health`,
      reuseExistingServer: true,
      timeout: 180_000,
    },
    {
      command: 'npm run dev -- --port 5173 --strictPort',
      url: 'http://localhost:5173',
      reuseExistingServer: !process.env.CI,
    },
  ],
})
