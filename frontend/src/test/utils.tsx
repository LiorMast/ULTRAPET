/**
 * test/utils.tsx — Helpers for component tests.
 * renderPage() renders the real app (routes, layout, Navbar) at a URL, the way a browser loads it, and waits
 * until the page's data has loaded (from the fake API in test/api.ts), so tests exercise the same wiring
 * users get (`user` / `staff` sign a business customer / a staff user in, in the app and in the fake API). renderComponent() renders one component on its own
 * (with the router, language, session and cart providers) so a test can give it custom props. Both start signed
 * out unless a test passes a user, so a session saved by one test never leaks into the next.
 */
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { createMemoryHistory, createRootRoute, createRouter, RouterProvider } from '@tanstack/react-router'
import type { User } from '@/api'
import { AuthProvider } from '@/auth'
import { CartProvider } from '@/cart'
import { applyDocumentLocale, detectLocale, LocaleProvider, type Locale } from '@/i18n'
import { createAppRouter, localeRewrite } from '@/router'
import { signInFakeUser } from '@/test/api'

/**
 * Renders the whole app at a URL and waits for the header to appear and the page's loaders to finish.
 * @param url - Browser URL, e.g. "/", "/en/where-to-buy" or "/en#brands". Its language prefix picks the
 *   locale, exactly as in main.tsx.
 * @param options.user - Start signed in as this business customer (also in the fake API, e.g. for the catalog's
 *   price sorts); signed out by default.
 * @param options.staff - Start signed in as this staff user (for the /admin pages); signed out by default.
 * @returns The Testing Library render result, the `router` (to inspect the current location) and a
 *   `user` (user-event instance) for clicking and typing.
 */
export async function renderPage(url: string, { user = null, staff = null }: { user?: User | null; staff?: User | null } = {}) {
  const signedIn = staff ?? user
  if (signedIn) signInFakeUser(signedIn)
  const locale = detectLocale(new URL(url, 'http://localhost').pathname)
  applyDocumentLocale(locale)
  const router = createAppRouter({ locale, history: createMemoryHistory({ initialEntries: [url] }) })
  const result = render(
    <LocaleProvider locale={locale}>
      <AuthProvider initialUser={staff ?? user}>
        <CartProvider>
          <RouterProvider router={router} />
        </CartProvider>
      </AuthProvider>
    </LocaleProvider>,
  )
  await screen.findByRole('banner')
  await waitFor(() => {
    if (router.state.isLoading || router.state.status !== 'idle') throw new Error('the router is still loading')
  })
  return { ...result, router, user: userEvent.setup() }
}

/**
 * Renders a single component inside a minimal router and the language and session providers, so links,
 * translations and sign-in work but the rest of the app (header, other routes) is absent.
 * @param ui - The element to render, e.g. <Hero images={[]} />.
 * @param locale - Language of the page; defaults to Hebrew like the real site.
 * @returns The Testing Library render result and a `user` (user-event instance).
 */
export function renderComponent(ui: ReactNode, locale: Locale = 'he') {
  applyDocumentLocale(locale)
  const router = createRouter({
    routeTree: createRootRoute({ component: () => ui }),
    history: createMemoryHistory({ initialEntries: ['/'] }),
    rewrite: localeRewrite(locale),
  })
  const result = render(
    <LocaleProvider locale={locale}>
      <AuthProvider initialUser={null}>
        <CartProvider>
          <RouterProvider router={router} />
        </CartProvider>
      </AuthProvider>
    </LocaleProvider>,
  )
  return { ...result, user: userEvent.setup() }
}
