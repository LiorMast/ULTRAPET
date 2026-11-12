/**
 * SubNavDrawer.test.tsx — Tests for the header's admin drawer (SubNavDrawer + useSubNavDrawer, wired by the
 * Navbar to LoginPopover's Admin panel button): the button opens and closes it (aria-expanded, inert while
 * closed), it lists every admin page (ADMIN_NAV), choosing a page navigates and closes it, Escape closes it with
 * the focus back on the button, Hebrew labels, and no drawer for customers or after signing out.
 */
import { act, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { TEST_STAFF, TEST_USER } from '@/test/api'
import { renderPage } from '@/test/utils'

/**
 * Finds the header's Admin panel button and the drawer it controls (through aria-controls).
 * @param name - The button's label in the page's language.
 * @returns The toggle button and the drawer element.
 */
async function findAdminDrawer(name = 'Admin panel') {
  const toggle = await within(screen.getByRole('banner')).findByRole('button', { name })
  const drawer = document.getElementById(toggle.getAttribute('aria-controls') ?? '')
  if (!drawer) throw new Error('the Admin panel button controls no element')
  return { toggle, drawer }
}

describe('Admin drawer', () => {
  it('opens and closes with the Admin panel button', async () => {
    const { user } = await renderPage('/en', { staff: TEST_STAFF })
    const { toggle, drawer } = await findAdminDrawer()
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(drawer).toHaveAttribute('inert')
    expect(drawer).toHaveAttribute('data-state', 'closed')

    await user.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    expect(toggle).toHaveAttribute('data-state', 'open')
    expect(drawer).not.toHaveAttribute('inert')
    expect(drawer).toHaveAttribute('data-state', 'open')

    await user.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(drawer).toHaveAttribute('inert')
  })

  it('lists every page of the admin panel', async () => {
    const { user } = await renderPage('/en', { staff: TEST_STAFF })
    const { toggle, drawer } = await findAdminDrawer()
    await user.click(toggle)
    const nav = within(drawer).getByRole('navigation', { name: 'Admin panel' })
    const links = within(nav).getAllByRole('link')
    expect(links.map((link) => [link.textContent, link.getAttribute('href')])).toEqual([
      ['Products', '/en/admin/products'],
      ['Categories', '/en/admin/categories'],
      ['Discounts', '/en/admin/discounts'],
      ['Customers', '/en/admin/customers'],
      ['Brands', '/en/admin/brands'],
    ])
  })

  it('goes to the chosen page and stays open', async () => {
    const { user, router } = await renderPage('/en', { staff: TEST_STAFF })
    const { toggle, drawer } = await findAdminDrawer()
    await user.click(toggle)
    await user.click(within(drawer).getByRole('link', { name: 'Categories' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/admin/categories'))
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    expect(drawer).not.toHaveAttribute('inert')
    // On the page itself the drawer marks it as the current one.
    expect(within(drawer).getByRole('link', { name: 'Categories' })).toHaveAttribute('aria-current', 'page')
  })

  it('closes with Escape, from a link inside it or from the button', async () => {
    const { user } = await renderPage('/en', { staff: TEST_STAFF })
    const { toggle, drawer } = await findAdminDrawer()
    await user.click(toggle)
    act(() => within(drawer).getByRole('link', { name: 'Brands' }).focus())
    await user.keyboard('{Escape}')
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(toggle).toHaveFocus()

    await user.keyboard('{Enter}')
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    await user.keyboard('{Escape}')
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
  })

  it('uses Hebrew labels', async () => {
    const { user } = await renderPage('/', { staff: TEST_STAFF })
    const { toggle, drawer } = await findAdminDrawer('לוח ניהול')
    await user.click(toggle)
    const nav = within(drawer).getByRole('navigation', { name: 'לוח ניהול' })
    expect(within(nav).getAllByRole('link').map((link) => link.textContent)).toEqual(['מוצרים', 'קטגוריות', 'הנחות', 'לקוחות', 'מותגים'])
  })

  it('is not there for business customers', async () => {
    await renderPage('/en', { user: TEST_USER })
    const header = within(screen.getByRole('banner'))
    expect(header.queryByRole('button', { name: 'Admin panel' })).not.toBeInTheDocument()
    expect(header.queryByRole('navigation', { name: 'Admin panel' })).not.toBeInTheDocument()
  })

  it('goes away when the staff member signs out', async () => {
    const { user } = await renderPage('/en', { staff: TEST_STAFF })
    const { toggle } = await findAdminDrawer()
    await user.click(toggle)
    await user.click(within(screen.getByRole('banner')).getByRole('button', { name: 'Sign out' }))
    const header = within(screen.getByRole('banner'))
    expect(await header.findByRole('button', { name: 'Login' })).toBeInTheDocument()
    expect(header.queryByRole('navigation', { name: 'Admin panel' })).not.toBeInTheDocument()
  })
})
