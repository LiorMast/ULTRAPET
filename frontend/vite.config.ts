/**
 * vite.config.ts — Dev server, build and unit-test configuration for the UltraPet frontend.
 *
 * Plugins:
 *  - TanStack Router: generates src/routeTree.gen.ts from the files in src/routes.
 *  - React: JSX + fast refresh.
 *  - Tailwind CSS v4: compiles the utility classes used in src/.
 *  - vite-imagetools: resizes images imported with a query (e.g. the hero photos in src/assets/hero)
 *    into WebP files at several widths, with a ready-made `srcset`.
 * `define` gives the app the public origin (SITE_URL in src/seo.ts) used for canonical URLs.
 * `server.allowedHosts` lets the dev server be reached through a Cloudflare quick tunnel.
 * `server.proxy` forwards /api to the Flask backend (compose.yaml, port 5000) in dev, and /sitemap.xml to the
 * backend's /api/sitemap.xml, which lists the public pages and every published article from the database
 * (the production web server must forward it the same way). public/robots.txt points to it.
 * `optimizeDeps` pre-bundles the lazily loaded map libraries at server start, so the first visit to
 * /where-to-buy does not trigger a dependency re-optimisation and page reload.
 * The `test` block configures Vitest (jsdom + Testing Library, see src/test/setup.ts; 15s per test, since most
 * tests render the whole app).
 * Playwright end-to-end tests live in e2e/ and have their own playwright.config.ts.
 */
/// <reference types="vitest/config" />
import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import react from '@vitejs/plugin-react'
import { imagetools } from 'vite-imagetools'
import { defineConfig } from 'vite'

/** The public origin of the site. */
const SITE_URL = 'https://www.ultrapet.co.il'

export default defineConfig({
  plugins: [tanstackRouter({ target: 'react', autoCodeSplitting: true }), react(), tailwindcss(), imagetools()],
  define: { __SITE_URL__: JSON.stringify(SITE_URL) },
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, 'src') },
  },
  optimizeDeps: { include: ['leaflet', 'react-leaflet'] },
  // Dev server: also answer requests through Cloudflare quick tunnels (random *.trycloudflare.com names),
  // used to preview the local site on another device. The leading dot allows every subdomain.
  // /api goes to the Flask backend (`docker compose up`), so the app calls the API on its own origin (and the
  // sign-in cookies stay first-party); the sitemap is built by the backend from the database.
  server: {
    allowedHosts: ['.trycloudflare.com'],
    proxy: {
      '/api': 'http://localhost:5000',
      '/sitemap.xml': { target: 'http://localhost:5000', rewrite: () => '/api/sitemap.xml' },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    // Most tests render the whole app (renderPage); with every file in parallel they can pass 5s on a busy machine.
    testTimeout: 15_000,
  },
})
