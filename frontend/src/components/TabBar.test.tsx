/**
 * TabBar.test.tsx — Tests for the bottom tab bar of phones and tablets (TabBar.tsx): the page tabs in both languages
 * with their links, the current page marked (Products also on a product page), the account tab per user (Log in for
 * visitors, the cart with its count for business customers, Admin for staff), the Menu tab opening the menu drawer and
 * the Cart tab opening the cart panel.
 */
import { screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { TEST_STAFF, TEST_USER } from '@/test/api'
import { renderPage } from '@/test/utils'
import products from '@/stubs/products.json'

/**
 * The tab bar's landmark.
 * @param name - Its accessible name in the page's language.
 * @returns The <nav>.
 */
const tabBar = (name = 'ניווט מהיר') => screen.getByRole('navigation', { name })

describe('Tab bar', () => {
  it('shows the page tabs, Log in and Menu to visitors (Hebrew), with Home current on the home page', async () => {
    await renderPage('/')
    const bar = tabBar()
    expect(bar).toHaveAttribute('data-tab-bar')
    const links = within(bar).getAllByRole('link')
    expect(links.map((link) => link.textContent)).toEqual(['בית', 'מוצרים', 'משווקים', 'התחברות'])
    expect(links.map((link) => link.getAttribute('href'))).toEqual(['/', '/catalog', '/where-to-buy', '/login'])
    expect(within(bar).getByRole('link', { name: 'בית' })).toHaveAttribute('aria-current', 'page')
    expect(within(bar).getByRole('link', { name: 'מוצרים' })).not.toHaveAttribute('aria-current')
    expect(within(bar).getByRole('button', { name: 'תפריט' })).toBeInTheDocument()
  })

  it('links to the English pages on English pages', async () => {
    await renderPage('/en/where-to-buy')
    const bar = tabBar('Quick navigation')
    expect(within(bar).getAllByRole('link').map((link) => link.getAttribute('href'))).toEqual(['/en', '/en/catalog', '/en/where-to-buy', '/en/login'])
    expect(within(bar).getByRole('link', { name: 'Stores' })).toHaveAttribute('aria-current', 'page')
    expect(within(bar).getByRole('link', { name: 'Home' })).not.toHaveAttribute('aria-current')
  })

  it('marks Products current on the catalog', async () => {
    await renderPage('/en/catalog')
    expect(within(tabBar('Quick navigation')).getByRole('link', { name: 'Products' })).toHaveAttribute('aria-current', 'page')
  })

  it('marks Products current on a product page', async () => {
    await renderPage(`/en/products/${encodeURIComponent(products[0].slug)}`)
    const bar = tabBar('Quick navigation')
    expect(within(bar).getByRole('link', { name: 'Products' })).toHaveAttribute('aria-current', 'page')
    expect(within(bar).getByRole('link', { name: 'Home' })).not.toHaveAttribute('aria-current')
  })

  it('gives staff an Admin tab instead of Log in', async () => {
    await renderPage('/en', { staff: TEST_STAFF })
    const bar = tabBar('Quick navigation')
    expect(within(bar).getByRole('link', { name: 'Admin' })).toHaveAttribute('href', '/en/admin')
    expect(within(bar).queryByRole('link', { name: 'Log in' })).not.toBeInTheDocument()
  })

  it('gives a business customer the Cart tab, which opens the cart panel', async () => {
    const { user } = await renderPage('/en', { user: TEST_USER })
    const bar = tabBar('Quick navigation')
    expect(within(bar).queryByRole('link', { name: 'Log in' })).not.toBeInTheDocument()
    const cart = within(bar).getByRole('button', { name: 'Shopping cart' })
    expect(cart).toHaveTextContent('Cart')
    expect(cart.querySelector('[data-cart-target]')).not.toBeNull()

    await user.click(cart)
    const panel = await screen.findByRole('dialog', { name: 'Shopping cart' })
    expect(within(panel).getByText('Your cart is empty')).toBeInTheDocument()
  })

  it('opens the menu drawer from the Menu tab', async () => {
    const { user } = await renderPage('/en')
    const menu = within(tabBar('Quick navigation')).getByRole('button', { name: 'Menu' })
    expect(menu).toHaveAttribute('aria-expanded', 'false')
    await user.click(menu)
    const drawer = await screen.findByRole('dialog', { name: 'Main menu' })
    expect(within(drawer).getByRole('link', { name: 'Where to Buy' })).toHaveAttribute('href', '/en/where-to-buy')
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(menu).toHaveFocus()
  })
})
