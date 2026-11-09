/**
 * Navbar.test.tsx — Tests for the site header (Navbar), its Products and language dropdowns, the home-page
 * scrollspy, and the mobile drawer (MobileMenu), rendered inside the real app with renderPage().
 */
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CATALOG_PDF_URL } from '@/config'
import categories from '@/stubs/product-categories.json'
import { TEST_STAFF } from '@/test/api'
import { renderPage } from '@/test/utils'

describe('Navbar links', () => {
  it('shows the Hebrew menu with unprefixed links on Hebrew pages', async () => {
    await renderPage('/')
    const nav = screen.getByRole('navigation', { name: 'תפריט ראשי' })

    expect(within(nav).getByRole('link', { name: 'מותגים' })).toHaveAttribute('href', '/#brands')
    expect(within(nav).getByRole('link', { name: 'תווית פרטית' })).toHaveAttribute('href', '/#private-label')
    expect(within(nav).getByRole('link', { name: 'משווקים' })).toHaveAttribute('href', '/where-to-buy')
    expect(within(nav).getByRole('link', { name: 'אודות' })).toHaveAttribute('href', '/#about')
    expect(within(nav).getByRole('link', { name: 'צור קשר' })).toHaveAttribute('href', '/#contact')
    expect(within(nav).getByRole('button', { name: 'מוצרים' })).toBeInTheDocument()
  })

  it('shows the English menu with /en links on English pages', async () => {
    await renderPage('/en')
    const nav = screen.getByRole('navigation', { name: 'Main menu' })

    expect(within(nav).getByRole('link', { name: 'Brands' })).toHaveAttribute('href', '/en#brands')
    expect(within(nav).getByRole('link', { name: 'Where to Buy' })).toHaveAttribute('href', '/en/where-to-buy')
    expect(screen.getByRole('link', { name: 'UltraPet – home page' })).toHaveAttribute('href', '/en')
    expect(screen.getByRole('button', { name: 'Login' })).toBeInTheDocument()
  })

  it('shows the logo with an accessible name', async () => {
    await renderPage('/')
    expect(screen.getByRole('link', { name: 'אולטרה פט – לדף הבית' })).toHaveAttribute('href', '/')
    expect(screen.getAllByRole('img', { name: 'UltraPet' }).length).toBeGreaterThan(0)
  })

  it('marks the current page as active', async () => {
    await renderPage('/en/where-to-buy')
    const nav = screen.getByRole('navigation', { name: 'Main menu' })
    expect(within(nav).getByRole('link', { name: 'Where to Buy' })).toHaveAttribute('aria-current', 'page')
    expect(within(nav).getByRole('link', { name: 'Brands' })).not.toHaveAttribute('aria-current')
  })
})

/**
 * Fakes the page layout (jsdom has none): gives the listed sections a distance from the top of the window
 * (sections not listed sit far below), then fires a scroll event so the scrollspy re-measures.
 * @param tops - Section id -> its top edge in px relative to the window.
 */
function scrollTo(tops: Record<string, number>) {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    return { top: tops[this.id] ?? 5000 } as DOMRect
  })
  fireEvent.scroll(window)
}

describe('Scrollspy', () => {
  afterEach(() => vi.restoreAllMocks())

  it('puts the section being read in the URL and marks its menu link current', async () => {
    const { router } = await renderPage('/en')
    const nav = screen.getByRole('navigation', { name: 'Main menu' })

    scrollTo({ stats: -2000, brands: -1500, categories: -900, 'private-label': -400, business: 80, about: 900 })
    await waitFor(() => expect(router.state.location.hash).toBe('business'))
    expect(within(nav).getByRole('link', { name: 'Private Label' })).not.toHaveAttribute('aria-current')

    scrollTo({ stats: -2000, brands: -1500, categories: -900, 'private-label': -400, business: -100, about: 88 })
    await waitFor(() => expect(router.state.location.hash).toBe('about'))
    expect(router.state.location.pathname).toBe('/')
    expect(within(nav).getByRole('link', { name: 'About' })).toHaveAttribute('aria-current', 'page')
    expect(within(nav).getByRole('link', { name: 'Brands' })).not.toHaveAttribute('aria-current')
  })

  it('clears the hash on the hero, above the first section', async () => {
    const { router } = await renderPage('/#about')
    scrollTo({ stats: 700 })
    await waitFor(() => expect(router.state.location.hash).toBe(''))
    expect(screen.getByRole('navigation', { name: 'תפריט ראשי' }).querySelector('[aria-current]')).toBeNull()
  })

  it('does nothing on other pages', async () => {
    const { router } = await renderPage('/where-to-buy')
    scrollTo({ about: 0 })
    await new Promise((resolve) => requestAnimationFrame(resolve))
    expect(router.state.location.hash).toBe('')
    expect(router.state.location.pathname).toBe('/where-to-buy')
  })
})

describe('Navbar background', () => {
  it.each(['/', '/where-to-buy'])('is the same white bar material on every page (%s)', async (url) => {
    await renderPage(url)
    expect(screen.getByRole('banner')).toHaveClass('material-bar')
  })
})

describe('Products dropdown', () => {
  it('lists the database categories, the product catalog and the PDF catalog', async () => {
    const { user } = await renderPage('/')
    await user.click(screen.getByRole('button', { name: 'מוצרים' }))
    const menu = await screen.findByRole('menu')

    const items = within(menu).getAllByRole('menuitem')
    expect(items).toHaveLength(categories.length + 2)
    expect(items[0]).toHaveTextContent('כל המוצרים')
    expect(items.slice(1, -1).map((item) => item.textContent)).toEqual(categories.map((c) => c.name.he))
    expect(items[1]).toHaveAttribute('href', `/catalog?category=${categories[0].slug}`)
    expect(menu.querySelector('svg')).toBeNull()
    expect(within(menu).getByRole('menuitem', { name: 'כל המוצרים' })).toHaveAttribute('href', '/catalog')

    const catalog = within(menu).getByRole('menuitem', { name: 'הקטלוג המלא להורדה (PDF)' })
    expect(catalog).toHaveAttribute('href', CATALOG_PDF_URL)
    expect(catalog).toHaveAttribute('target', '_blank')
  })

  it('opens the catalog filtered by the chosen category', async () => {
    const { user, router } = await renderPage('/en')
    await user.click(screen.getByRole('button', { name: 'Products' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Cat Litter' }))

    await waitFor(() => expect(router.state.location.pathname).toBe('/catalog'))
    expect(router.state.location.search).toMatchObject({ category: 'cat-litter' })
  })
})

describe('Language switcher', () => {
  it('links to the same page in each enabled language and lists the coming-soon ones', async () => {
    const { user } = await renderPage('/where-to-buy')
    await user.click(screen.getByRole('button', { name: /^שפה:/ }))
    const menu = await screen.findByRole('menu')

    expect(within(menu).getByRole('menuitem', { name: 'English' })).toHaveAttribute('href', '/en/where-to-buy')
    const hebrew = within(menu).getByRole('menuitem', { name: 'עברית' })
    expect(hebrew).toHaveAttribute('href', '/where-to-buy')
    expect(hebrew).toHaveAttribute('aria-current', 'true')

    expect(within(menu).getByRole('menuitem', { name: /Русский/ })).toHaveAttribute('aria-disabled', 'true')
    expect(within(menu).getByRole('menuitem', { name: /العربية/ })).toHaveAttribute('aria-disabled', 'true')
  })

  it('keeps the #section when switching language', async () => {
    const { user } = await renderPage('/en#brands')
    await user.click(screen.getByRole('button', { name: /^Language:/ }))
    const menu = await screen.findByRole('menu')
    expect(within(menu).getByRole('menuitem', { name: 'עברית' })).toHaveAttribute('href', '/#brands')
  })

  it('has a compact toggle to the other language for the mobile header', async () => {
    await renderPage('/en/login')
    expect(screen.getByRole('link', { name: 'עב – עברית' })).toHaveAttribute('href', '/login')
  })
})

describe('Mobile menu', () => {
  it('opens a drawer with the menu, languages and the business button, and closes on Escape', async () => {
    const { user } = await renderPage('/')
    const trigger = screen.getByRole('button', { name: 'פתיחת תפריט' })
    expect(trigger).toHaveAttribute('aria-expanded', 'false')

    await user.click(trigger)
    const drawer = await screen.findByRole('dialog', { name: 'תפריט ראשי' })
    expect(trigger).toHaveAttribute('aria-expanded', 'true')
    expect(within(drawer).getByRole('link', { name: 'מותגים' })).toHaveAttribute('href', '/#brands')
    expect(within(drawer).getByRole('link', { name: 'התחברות' })).toHaveAttribute('href', '/login')
    expect(within(drawer).getByRole('group', { name: 'שפה' })).toBeInTheDocument()
    expect(within(drawer).getByRole('link', { name: 'חשבון עסקי' })).toHaveAttribute('href', '/#business')

    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('turns Login into Log out when signed in, with an Admin panel entry for staff, and confirms signing out', async () => {
    const { user } = await renderPage('/en', { staff: TEST_STAFF })
    await user.click(screen.getByRole('button', { name: 'Open menu' }))
    const drawer = await screen.findByRole('dialog', { name: 'Main menu' })
    expect(within(drawer).getByRole('link', { name: 'Admin panel' })).toHaveAttribute('href', '/en/admin')
    expect(within(drawer).queryByRole('link', { name: 'Login' })).not.toBeInTheDocument()
    await user.click(within(drawer).getByRole('button', { name: 'Sign out' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByText('You are signed out.')).toHaveAttribute('data-kind', 'success')
    await user.click(screen.getByRole('button', { name: 'Open menu' }))
    expect(within(await screen.findByRole('dialog')).getByRole('link', { name: 'Login' })).toBeInTheDocument()
  })

  it('expands the Products group to show the categories', async () => {
    const { user } = await renderPage('/')
    await user.click(screen.getByRole('button', { name: 'פתיחת תפריט' }))
    const drawer = await screen.findByRole('dialog')

    await user.click(within(drawer).getByText('מוצרים'))
    expect(within(drawer).getByText('מוצרים').closest('details')).toHaveAttribute('open')
    expect(within(drawer).getByRole('link', { name: 'חול לחתולים' })).toHaveAttribute('href', '/catalog?category=cat-litter')
  })

  it('closes after choosing a destination', async () => {
    const { user, router } = await renderPage('/')
    await user.click(screen.getByRole('button', { name: 'פתיחת תפריט' }))
    const drawer = await screen.findByRole('dialog')

    await user.click(within(drawer).getByRole('link', { name: 'משווקים' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(router.state.location.pathname).toBe('/where-to-buy')
  })
})

describe('Not found', () => {
  it.each(['/no-such-page', '/ru', '/categories/no-such-category'])('shows "page not found" for %s', async (url) => {
    await renderPage(url)
    expect(await screen.findByRole('heading', { name: 'הדף לא נמצא' })).toBeInTheDocument()
  })
})
