/**
 * vite.config.ts — Dev server, build and unit-test configuration for the UltraPet frontend.
 *
 * Plugins:
 *  - TanStack Router: generates src/routeTree.gen.ts from the files in src/routes.
 *  - React: JSX + fast refresh.
 *  - Tailwind CSS v4: compiles the utility classes used in src/.
 *  - vite-imagetools: resizes images imported with a query (e.g. the hero photos in src/assets/hero)
 *    into WebP files at several widths, with a ready-made `srcset`.
 *  - sitemap: writes /sitemap.xml (build output, and served by the dev server) listing the public pages
 *    and every article in each language, with hreflang alternates. public/robots.txt points to it.
 * `define` gives the app the public origin (SITE_URL in src/seo.ts) used for canonical URLs.
 * `optimizeDeps` pre-bundles the lazily loaded map libraries at server start, so the first visit to
 * /where-to-buy does not trigger a dependency re-optimisation and page reload.
 * The `test` block configures Vitest (jsdom + Testing Library, see src/test/setup.ts).
 * Playwright end-to-end tests live in e2e/ and have their own playwright.config.ts.
 */
/// <reference types="vitest/config" />
import { readFileSync } from 'node:fs'
import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import react from '@vitejs/plugin-react'
import { imagetools } from 'vite-imagetools'
import { defineConfig, type Plugin } from 'vite'

/** The public origin of the site. */
const SITE_URL = 'https://www.ultrapet.co.il'

/** URL prefix of each served language (src/i18n: Hebrew is the default and has none). */
const SITEMAP_LOCALES = { he: '', en: '/en' }

/** Internal paths of the public pages that are always in the sitemap (articles are added from the stub). */
const SITEMAP_PAGES = ['/', '/where-to-buy', '/articles']

/**
 * Builds sitemap.xml: one <url> per page and language, each listing all its language versions.
 * Reads src/stubs/articles.json for the article pages (backend phase: from the API).
 * @returns The XML document.
 */
function buildSitemap() {
  const articles: { slug: string; updatedAt: string }[] = JSON.parse(readFileSync(path.resolve(import.meta.dirname, 'src/stubs/articles.json'), 'utf8'))
  const pages = [
    ...SITEMAP_PAGES.map((page) => ({ page, lastmod: undefined as string | undefined })),
    ...articles.map((a) => ({ page: `/articles/${a.slug}`, lastmod: a.updatedAt.slice(0, 10) })),
  ]
  /** The absolute URL of an internal path in one language (the home page has no trailing slash when prefixed). */
  const url = (page: string, prefix: string) => `${SITE_URL}${prefix}${page === '/' && prefix ? '' : page}`
  const entries = pages.flatMap(({ page, lastmod }) =>
    Object.values(SITEMAP_LOCALES).map((prefix) =>
      [
        '  <url>',
        `    <loc>${url(page, prefix)}</loc>`,
        ...(lastmod ? [`    <lastmod>${lastmod}</lastmod>`] : []),
        ...Object.entries(SITEMAP_LOCALES).map(([lang, p]) => `    <xhtml:link rel="alternate" hreflang="${lang}" href="${url(page, p)}"/>`),
        `    <xhtml:link rel="alternate" hreflang="x-default" href="${url(page, '')}"/>`,
        '  </url>',
      ].join('\n'),
    ),
  )
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${entries.join('\n')}\n</urlset>\n`
}

/**
 * Vite plugin that serves /sitemap.xml in dev and writes it into the production build.
 * @returns The plugin.
 */
function sitemap(): Plugin {
  return {
    name: 'ultrapet-sitemap',
    configureServer(server) {
      server.middlewares.use('/sitemap.xml', (_req, res) => {
        res.setHeader('Content-Type', 'application/xml; charset=utf-8')
        res.end(buildSitemap())
      })
    },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'sitemap.xml', source: buildSitemap() })
    },
  }
}

export default defineConfig({
  plugins: [tanstackRouter({ target: 'react', autoCodeSplitting: true }), react(), tailwindcss(), imagetools(), sitemap()],
  define: { __SITE_URL__: JSON.stringify(SITE_URL) },
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
