/**
 * router.ts — Creates the TanStack Router instance for the site.
 *
 * - The routes come from the files in src/routes (compiled into routeTree.gen.ts by the Vite plugin).
 * - Language prefixes: the browser shows /en/where-to-buy, but the route files only know /where-to-buy.
 *   `rewrite.input` strips the prefix from incoming URLs and `rewrite.output` adds it to every link the
 *   router builds, so <Link to="/where-to-buy"> renders href="/en/where-to-buy" on English pages.
 * - The router context carries the page language, so route `head` options (titles, meta tags) can be
 *   translated outside React.
 * - Pages load their data from the API in route loaders (src/api.ts); when a load fails, LoadError (in
 *   routes/__root.tsx) replaces the page with a "try again" screen.
 * - The first page load shows a skeleton of the page (PageSkeleton, the default pending component) when its data takes
 *   more than 400ms; after it, navigations never do (pendingMs becomes Infinity): the current page stays while the
 *   next one loads, and routes/__root.tsx runs the progress bar.
 * - A change of page (a new path) cross-fades through a view transition (index.css `::view-transition-*`); a change of
 *   only the search or the hash (catalog filters, the home scrollspy) switches without one, and browsers without view
 *   transitions simply switch.
 * - Used by main.tsx (browser history) and by the tests (memory history, see src/test/utils.tsx).
 */
import { createRouter, type RouterHistory } from '@tanstack/react-router'
import { delocalizePath, localizePath, type Locale } from '@/i18n'
import { PageSkeleton } from '@/components/PageSkeleton'
import { LoadError } from '@/routes/__root'
import { routeTree } from './routeTree.gen'

/**
 * Builds the app router for one page load.
 * @param options.locale - The language of this page load; every link the router builds gets its prefix.
 * @param options.history - Optional history to use instead of the browser's (tests pass a memory history).
 * @returns The configured router.
 */
export function createAppRouter({ locale, history }: { locale: Locale; history?: RouterHistory }) {
  const router = createRouter({
    routeTree,
    history,
    scrollRestoration: true,
    defaultPreload: 'intent',
    defaultErrorComponent: LoadError,
    // The first load's skeleton: shown after 400ms (for at least 300ms, no blink) in place of the first route still loading.
    defaultPendingComponent: PageSkeleton,
    defaultPendingMs: 400,
    defaultPendingMinMs: 300,
    defaultViewTransition: { types: ({ pathChanged }) => (pathChanged ? ['page'] : false) },
    rewrite: localeRewrite(locale),
    context: { locale },
  })
  // Skeletons are for the first load only: once it has resolved, a navigation keeps the current page on screen (a
  // field being typed in keeps its focus) while the progress bar runs, however long the next page takes.
  const stopWatching = router.subscribe('onResolved', () => {
    router.options.defaultPendingMs = Infinity
    stopWatching()
  })
  return router
}

/**
 * The URL rewrite that maps browser URLs (/en/where-to-buy) to route paths (/where-to-buy) and back.
 * Shared with the component tests, which build small routers of their own.
 * @param locale - The language of this page load; every link the router builds gets its prefix.
 * @returns The `rewrite` option for createRouter.
 */
export function localeRewrite(locale: Locale) {
  return {
    input: ({ url }: { url: URL }) => {
      url.pathname = delocalizePath(url.pathname)
      return url
    },
    output: ({ url }: { url: URL }) => {
      url.pathname = localizePath(url.pathname, locale)
      return url
    },
  }
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof createAppRouter>
  }
}
