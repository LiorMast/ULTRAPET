/**
 * router.ts — Creates the TanStack Router instance for the site.
 *
 * - The routes come from the files in src/routes (compiled into routeTree.gen.ts by the Vite plugin).
 * - Language prefixes: the browser shows /en/where-to-buy, but the route files only know /where-to-buy.
 *   `rewrite.input` strips the prefix from incoming URLs and `rewrite.output` adds it to every link the
 *   router builds, so <Link to="/where-to-buy"> renders href="/en/where-to-buy" on English pages.
 * - Used by main.tsx (browser history) and by the tests (memory history, see src/test/utils.tsx).
 */
import { createRouter, type RouterHistory } from '@tanstack/react-router'
import { delocalizePath, localizePath, type Locale } from '@/i18n'
import { routeTree } from './routeTree.gen'

/**
 * Builds the app router for one page load.
 * @param options.locale - The language of this page load; every link the router builds gets its prefix.
 * @param options.history - Optional history to use instead of the browser's (tests pass a memory history).
 * @returns The configured router.
 */
export function createAppRouter({ locale, history }: { locale: Locale; history?: RouterHistory }) {
  return createRouter({
    routeTree,
    history,
    scrollRestoration: true,
    defaultPreload: 'intent',
    rewrite: {
      input: ({ url }) => {
        url.pathname = delocalizePath(url.pathname)
        return url
      },
      output: ({ url }) => {
        url.pathname = localizePath(url.pathname, locale)
        return url
      },
    },
  })
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof createAppRouter>
  }
}
