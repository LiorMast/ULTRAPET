/**
 * vite.config.ts — Dev server, build and unit-test configuration for the UltraPet frontend.
 *
 * Plugins:
 *  - TanStack Router: generates src/routeTree.gen.ts from the files in src/routes.
 *  - React: JSX + fast refresh.
 *  - Tailwind CSS v4: compiles the utility classes used in src/.
 *  - vite-imagetools: resizes images imported with a query (e.g. the hero photos in src/assets/hero)
 *    into WebP files at several widths, with a ready-made `srcset`.
 * `optimizeDeps` pre-bundles the lazily loaded map libraries at server start, so the first visit to
 * /where-to-buy does not trigger a dependency re-optimisation and page reload.
 * The `test` block configures Vitest (jsdom + Testing Library, see src/test/setup.ts).
 * Playwright end-to-end tests live in e2e/ and have their own playwright.config.ts.
 */
/// <reference types="vitest/config" />
import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import react from '@vitejs/plugin-react'
import { imagetools } from 'vite-imagetools'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [tanstackRouter({ target: 'react', autoCodeSplitting: true }), react(), tailwindcss(), imagetools()],
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, 'src') },
  },
  optimizeDeps: { include: ['leaflet', 'react-leaflet'] },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
  },
})
