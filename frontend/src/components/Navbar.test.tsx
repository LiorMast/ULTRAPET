/**
 * Navbar.test.tsx — Tests for the site header (Navbar), its Products and language dropdowns, and the
 * mobile drawer (MobileMenu), rendered inside the real app with renderPage().
 */
import { screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { CATALOG_PDF_URL } from '@/config'
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

describe('Navbar background', () => {
  it.each(['/', '/where-to-buy'])('is always solid white (%s)', async (url) => {
    await renderPage(url)
    expect(screen.getByRole('banner')).toHaveClass('bg-white')
  })
})

describe('Products dropdown', () => {
  it('lists the six categories, the product catalog, "all categories" and the PDF catalog', async () => {
    const { user } = await renderPage('/')
    await user.click(screen.getByRole('button', { name: 'מוצרים' }))
    const menu = await screen.findByRole('menu')

    expect(within(menu).getAllByRole('menuitem')).toHaveLength(9)
    expect(within(menu).getByRole('menuitem', { name: 'קטלוג מוצרים' })).toHaveAttribute('href', '/catalog')
    expect(within(menu).getByRole('menuitem', { name: 'מזון לכלבים' })).toHaveAttribute('href', '/categories/dog-food')
    expect(within(menu).getByRole('menuitem', { name: 'בעלי כנף' })).toHaveAttribute('href', '/categories/birds')
    expect(within(menu).getByRole('menuitem', { name: 'כל הקטגוריות' })).toHaveAttribute('href', '/#categories')

    const catalog = within(menu).getByRole('menuitem', { name: 'הקטלוג המלא להורדה (PDF)' })
    expect(catalog).toHaveAttribute('href', CATALOG_PDF_URL)
    expect(catalog).toHaveAttribute('target', '_blank')
  })

  it('navigates to a category page', async () => {
    const { user, router } = await renderPage('/en')
    await user.click(screen.getByRole('button', { name: 'Products' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Cat Food' }))

    await waitFor(() => expect(router.state.location.pathname).toBe('/categories/cat-food'))
    expect(await screen.findByRole('heading', { level: 1, name: 'Cat Food' })).toBeInTheDocument()
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

  it('expands the Products group to show the categories', async () => {
    const { user } = await renderPage('/')
    await user.click(screen.getByRole('button', { name: 'פתיחת תפריט' }))
    const drawer = await screen.findByRole('dialog')

    await user.click(within(drawer).getByText('מוצרים'))
    expect(within(drawer).getByText('מוצרים').closest('details')).toHaveAttribute('open')
    expect(within(drawer).getByRole('link', { name: 'חול לחתולים' })).toHaveAttribute('href', '/categories/litter')
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
