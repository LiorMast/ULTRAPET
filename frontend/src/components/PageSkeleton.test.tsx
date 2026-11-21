/**
 * PageSkeleton.test.tsx — Tests for the first page load's skeleton (PageSkeleton.tsx, the router's
 * default pending component): while the first load waits on the API, the page's skeleton shows (placeholder shapes,
 * one "Loading…" status) inside the real layout, or with the header's skeleton while the header's own data loads, or
 * inside the staff panel's layout; the real page then replaces it; later navigations never show it; skeletonFor picks
 * each page's skeleton, the sign-in card's for the admin and account pages of anyone else.
 */
import { screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { skeletonFor } from '@/components/PageSkeleton'
import products from '@/stubs/products.json'
import { holdRequests, TEST_STAFF, TEST_USER } from '@/test/api'
import { renderApp, renderPage } from '@/test/utils'

/** The skeleton shown (its wrapper names it), or null. */
const skeleton = () => document.querySelector<HTMLElement>('[data-skeleton]')

describe('the first load', () => {
  it("shows the page's skeleton inside the real layout while the page's data loads, then the page", async () => {
    const held = holdRequests((path) => path === '/api/products')
    renderApp('/en/catalog')

    await waitFor(() => expect(skeleton()).not.toBeNull(), { timeout: 2000 })
    expect(skeleton()).toHaveAttribute('data-skeleton', 'catalog')
    // The header's data came in, so the real header is there; the page's place holds the skeleton.
    expect(screen.getByRole('banner')).toBeInTheDocument()
    expect(screen.getByRole('main')).toContainElement(skeleton())
    expect(screen.getByRole('main')).toHaveAttribute('aria-busy', 'true')
    expect(screen.getByRole('status')).toHaveTextContent('Loading…')
    // Placeholder shapes, hidden from assistive technology; no page heading yet.
    const shapes = skeleton()!.querySelectorAll('[data-slot="skeleton"]')
    expect(shapes.length).toBeGreaterThan(20)
    expect(shapes[0]).toHaveAttribute('aria-hidden', 'true')
    expect(screen.queryByRole('heading', { level: 1 })).not.toBeInTheDocument()

    held.release()
    expect(await screen.findByRole('heading', { level: 1, name: 'All our products' })).toBeInTheDocument()
    expect(skeleton()).toBeNull()
  })

  it("shows the header's skeleton too while the header's own data loads", async () => {
    const held = holdRequests((path) => path === '/api/categories')
    renderApp(`/en/products/${products[0].slug}`)

    await waitFor(() => expect(skeleton()).toHaveAttribute('data-skeleton', 'product'), { timeout: 2000 })
    expect(screen.queryByRole('banner')).not.toBeInTheDocument()
    expect(screen.getByRole('main')).toHaveAttribute('aria-busy', 'true')
    // The header's skeleton shows the real logo at once.
    expect(document.querySelector('img[alt="UltraPet"]')).not.toBeNull()

    held.release()
    expect(await screen.findByRole('heading', { level: 1, name: products[0].name.en })).toBeInTheDocument()
    expect(screen.getByRole('banner')).toBeInTheDocument()
    expect(skeleton()).toBeNull()
  })

  it('shows only the page part inside the staff panel once the panel is shown', async () => {
    const held = holdRequests((path) => path === '/api/staff/brands')
    renderApp('/en/admin/brands', { staff: TEST_STAFF })

    await waitFor(() => expect(skeleton()).toHaveAttribute('data-skeleton', 'admin'), { timeout: 2000 })
    // The panel's real menu is there (above the skeleton), so the skeleton draws only the page part.
    const menu = screen.getByRole('navigation', { name: 'Admin' })
    expect(within(menu).getByRole('link', { name: 'Brands' })).toBeInTheDocument()
    expect(menu.compareDocumentPosition(skeleton()!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(skeleton()!.querySelectorAll('.h-9.w-24')).toHaveLength(0)
    held.release()
    expect(await screen.findByRole('heading', { level: 1, name: 'Brands' })).toBeInTheDocument()
  })

  it('never shows on a later navigation: the current page stays while the next one loads', async () => {
    const { router } = await renderPage('/en')
    const held = holdRequests((path) => path === '/api/articles')
    void router.navigate({ to: '/articles' })
    await waitFor(() => expect(held.calls).toEqual(['GET /api/articles']))
    // Well past the first load's 400ms.
    await new Promise((resolve) => setTimeout(resolve, 700))
    expect(skeleton()).toBeNull()
    expect(document.getElementById('stats')).not.toBeNull()
    held.release()
    expect(await screen.findByRole('heading', { level: 1, name: 'Pet care guides and tips' })).toBeInTheDocument()
  })
})

describe('skeletonFor', () => {
  it("picks each page's skeleton", () => {
    expect(skeletonFor('/', null)).toBe('home')
    expect(skeletonFor('/catalog', null)).toBe('catalog')
    expect(skeletonFor('/products/$slug', null)).toBe('product')
    expect(skeletonFor('/brands/$slug', null)).toBe('brand')
    expect(skeletonFor('/articles/', null)).toBe('articles')
    expect(skeletonFor('/articles/$slug', null)).toBe('article')
    expect(skeletonFor('/where-to-buy', null)).toBe('whereToBuy')
    expect(skeletonFor('/login', null)).toBe('signIn')
    expect(skeletonFor('/private-label', null)).toBe('page')
    expect(skeletonFor(undefined, null)).toBe('page')
  })

  it('shows the sign-in card on the admin pages to anyone but staff, and on My account to anyone but a customer', () => {
    expect(skeletonFor('/admin/products', null)).toBe('signIn')
    expect(skeletonFor('/admin/products', TEST_USER)).toBe('signIn')
    expect(skeletonFor('/admin/products', TEST_STAFF)).toBe('admin')
    expect(skeletonFor('/admin/customers/$id', TEST_STAFF)).toBe('adminProfile')
    expect(skeletonFor('/account', null)).toBe('signIn')
    expect(skeletonFor('/account', TEST_STAFF)).toBe('signIn')
    expect(skeletonFor('/account', TEST_USER)).toBe('account')
  })
})
