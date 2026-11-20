/**
 * ProductManager.test.tsx — Tests of the staff's manage mode on the customer views (ProductManager.tsx, the manage
 * mode store in auth.tsx, the staff data in manage.ts): only staff get the "Manage mode" switch; off, they see the
 * customer view; on, the catalog cards, the brand page's cards and the product page carry the product's staff
 * information and every action of /admin/products (edit, active, stock, discounts, delete; add and change order on the
 * catalog), the products hidden from customers show with a ribbon, and signing out turns the mode off.
 */
import { screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { readManageMode, setManageMode } from '@/auth'
import { fakeFetch, setFakeProduct, TEST_STAFF, TEST_USER } from '@/test/api'
import { renderPage } from '@/test/utils'
import products from '@/stubs/products.json'

const [first, second] = products

/**
 * The wait for what the lazy management chunk renders (the bar, the strips): loading it takes longer than Testing
 * Library's 1 s default when the whole suite runs at once.
 */
const LAZY = { timeout: 5_000 }

/** The English catalog narrowed to the first product and a few like it (fewer cards keep the tests light). */
const CATALOG = `/en/catalog?q=${encodeURIComponent(first.name.en)}`

/**
 * The catalog card of a product.
 * @param name - The product's English name.
 * @returns The card (<article>).
 */
const cardOf = (name: string) => screen.getByRole('heading', { name }).closest('article') as HTMLElement

/**
 * Opens the catalog as staff with manage mode on and waits for the cards' staff strips.
 * @param url - The page; default the English catalog narrowed to the first product (CATALOG).
 * @returns renderPage's result.
 */
async function manageCatalog(url = CATALOG) {
  setManageMode(true)
  const page = await renderPage(url, { staff: TEST_STAFF })
  await screen.findByRole('button', { name: `Edit ${first.name.en}` }, LAZY)
  return page
}

describe('Manage mode', { timeout: 20_000 }, () => {
  it('is never offered to visitors or business customers', async () => {
    await renderPage('/en/catalog')
    expect(screen.queryByRole('switch', { name: 'Manage mode' })).not.toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Product management' })).not.toBeInTheDocument()
  })

  it('stays off for a customer even when the switch was left on in the browser', async () => {
    setManageMode(true)
    await renderPage('/en/catalog', { user: TEST_USER })
    expect(screen.queryByRole('switch', { name: 'Manage mode' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: `Edit ${first.name.en}` })).not.toBeInTheDocument()
  })

  it('starts off for staff (the customer view), and turning it on expands every card', async () => {
    const { user } = await renderPage(CATALOG, { staff: TEST_STAFF })
    const toggle = await screen.findByRole('switch', { name: 'Manage mode' }, LAZY)
    expect(toggle).not.toBeChecked()
    expect(toggle).toHaveAccessibleDescription(/Turn the switch off to see the site as customers do/)
    expect(screen.queryByRole('button', { name: `Edit ${first.name.en}` })).not.toBeInTheDocument()

    await user.click(toggle)
    const card = cardOf(first.name.en)
    expect(await within(card).findByRole('button', { name: `Edit ${first.name.en}` }, LAZY)).toBeInTheDocument()
    for (const name of [`Stock: ${first.name.en}`, `Discounts: ${first.name.en}`, `Delete ${first.name.en}`]) {
      expect(within(card).getByRole('button', { name })).toBeInTheDocument()
    }
    expect(within(card).getByRole('switch', { name: `Active: ${first.name.en}` })).toBeChecked()
    expect(within(card).getByText('Not counted')).toBeInTheDocument()
    // The catalog-wide actions.
    const bar = screen.getByRole('region', { name: 'Product management' })
    for (const name of ['Change order', 'PDF catalog', 'Add product']) expect(within(bar).getByRole('button', { name })).toBeInTheDocument()
    expect(readManageMode()).toBe(true)

    await user.click(screen.getByRole('switch', { name: 'Manage mode' }))
    await waitFor(() => expect(screen.queryByRole('button', { name: `Edit ${first.name.en}` })).not.toBeInTheDocument())
  })

  it('shows the products hidden from customers, marked, only in manage mode', async () => {
    await setFakeProduct(first.slug, { isActive: false })
    await renderPage('/en/catalog', { staff: TEST_STAFF })
    expect(screen.queryByRole('heading', { name: first.name.en })).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: second.name.en })).toBeInTheDocument()

    setManageMode(true)
    const card = await waitFor(() => cardOf(first.name.en), LAZY)
    expect(within(card).getByText('Hidden from customers')).toBeInTheDocument()
    expect(await within(card).findByRole('switch', { name: `Active: ${first.name.en}` }, LAZY)).not.toBeChecked()
    expect(within(cardOf(second.name.en)).queryByText('Hidden from customers')).not.toBeInTheDocument()
  })

  it('hides a product from customers with its Active switch', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(fakeFetch)
    const { user } = await manageCatalog()
    const card = cardOf(first.name.en)
    await user.click(within(card).getByRole('switch', { name: `Active: ${first.name.en}` }))

    expect(await screen.findByText('The product is hidden from customers.')).toBeInTheDocument()
    const sent = fetchSpy.mock.calls.find(([, init]) => init?.method === 'PATCH' || init?.method === 'PUT')!
    expect(JSON.parse(String(sent[1]?.body))).toEqual({ isActive: false })
    expect(await within(cardOf(first.name.en)).findByText('Hidden from customers')).toBeInTheDocument()
  })

  it('edits a product with the admin form, and shows the change on the card', async () => {
    const { user } = await manageCatalog()
    await user.click(within(cardOf(first.name.en)).getByRole('button', { name: `Edit ${first.name.en}` }))
    const dialog = await screen.findByRole('dialog', { name: `Edit ${first.name.en}` })
    // The admin form, photos included.
    expect(within(dialog).getByText('Photos')).toBeInTheDocument()
    const sku = within(dialog).getByRole('textbox', { name: 'SKU' })
    await user.clear(sku)
    await user.type(sku, 'UP-777')
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))

    expect(await screen.findByText('Changes saved.')).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(await within(cardOf(first.name.en)).findByText('UP-777')).toBeInTheDocument()
    expect(within(cardOf(first.name.en)).getByRole('button', { name: `Edit ${first.name.en}` })).toHaveFocus()
  })

  it('records a stock count from the card', async () => {
    const { user } = await manageCatalog()
    await user.click(within(cardOf(first.name.en)).getByRole('button', { name: `Stock: ${first.name.en}` }))
    const dialog = await screen.findByRole('dialog', { name: 'Stock' })
    await user.type(within(dialog).getByRole('textbox', { name: 'Units counted *' }), '12')
    await user.click(within(dialog).getByRole('button', { name: 'Record' }))
    expect(await screen.findByText('Stock updated.')).toBeInTheDocument()
    await user.click(within(dialog).getAllByRole('button', { name: 'Close' })[0])
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(await within(cardOf(first.name.en)).findByText('12')).toBeInTheDocument()
  })

  it("opens the product's discounts", async () => {
    const { user } = await manageCatalog()
    await user.click(within(cardOf(first.name.en)).getByRole('button', { name: `Discounts: ${first.name.en}` }))
    const dialog = await screen.findByRole('dialog', { name: 'Discounts' })
    expect(within(dialog).getByText(first.name.en)).toBeInTheDocument()
    expect(within(dialog).getByText('No discounts yet.')).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Add discount' })).toBeInTheDocument()
  })

  it('deletes a product after the confirmation', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(fakeFetch)
    const { user } = await manageCatalog()
    await user.click(within(cardOf(first.name.en)).getByRole('button', { name: `Delete ${first.name.en}` }))
    const dialog = await screen.findByRole('alertdialog', { name: `Delete ${first.name.en}?` })
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }))

    expect(await screen.findByText('Record deleted.')).toBeInTheDocument()
    expect(fetchSpy.mock.calls.some(([url, init]) => String(url).startsWith('/api/staff/products/') && init?.method === 'DELETE')).toBe(true)
    // Its staff row is gone (the fake catalog itself is the stub list).
    await waitFor(() => expect(screen.queryByRole('button', { name: `Edit ${first.name.en}` })).not.toBeInTheDocument())
  })

  it('adds a product and changes the order from the bar', async () => {
    const { user } = await manageCatalog()
    const bar = screen.getByRole('region', { name: 'Product management' })
    await user.click(within(bar).getByRole('button', { name: 'Add product' }))
    const add = await screen.findByRole('dialog', { name: 'New product' })
    await user.click(within(add).getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(within(bar).getByRole('button', { name: 'Add product' })).toHaveFocus())

    await user.click(within(bar).getByRole('button', { name: 'Change order' }))
    const order = await screen.findByRole('dialog', { name: 'Change the order' })
    expect(within(order).getByText(first.name.en)).toBeInTheDocument()
  })

  it('turns the product page price block into the staff panel', async () => {
    setManageMode(true)
    await renderPage(`/en/products/${first.slug}`, { staff: TEST_STAFF })
    const panel = await screen.findByText('Only staff see this part.', {}, LAZY)
    const strip = panel.closest('div')!.parentElement!
    // Labelled actions on the page.
    expect(within(strip).getByRole('button', { name: `Edit ${first.name.en}` })).toHaveTextContent('Edit')
    expect(within(strip).getByRole('button', { name: `Stock: ${first.name.en}` })).toHaveTextContent('Stock')
    expect(screen.queryByRole('link', { name: 'Log in to see the price' })).not.toBeInTheDocument()
  })

  it('opens a hidden product page for staff in manage mode only', async () => {
    await setFakeProduct(first.slug, { isActive: false })
    setManageMode(true)
    await renderPage(`/en/products/${first.slug}`, { staff: TEST_STAFF })
    expect(screen.getByRole('heading', { level: 1, name: first.name.en })).toBeInTheDocument()
    expect(screen.getByText('Hidden from customers')).toBeInTheDocument()
  })

  it("expands a brand page's product cards, with the switch only", async () => {
    const branded = products.find((product) => product.brand)!
    setManageMode(true)
    await renderPage(`/en/brands/${branded.brand}`, { staff: TEST_STAFF })
    expect(await screen.findAllByRole('button', { name: /^Edit / }, LAZY)).not.toHaveLength(0)
    // The bar is loaded lazily, like the strips.
    const bar = await screen.findByRole('region', { name: 'Product management' }, LAZY)
    expect(within(bar).getByRole('switch', { name: 'Manage mode' })).toBeChecked()
    expect(within(bar).queryByRole('button', { name: 'Add product' })).not.toBeInTheDocument()
  })

  it('is turned off by signing out', async () => {
    setManageMode(true)
    const { user } = await renderPage(CATALOG, { staff: TEST_STAFF })
    await user.click(screen.getByRole('button', { name: 'Open menu' }))
    const drawer = await screen.findByRole('dialog', { name: 'Main menu' })
    await user.click(within(drawer).getByRole('button', { name: 'Sign out' }))
    expect(readManageMode()).toBe(false)
    await waitFor(() => expect(screen.queryByRole('switch', { name: 'Manage mode' })).not.toBeInTheDocument(), LAZY)
  })

  it('speaks Hebrew', async () => {
    setManageMode(true)
    await renderPage(`/catalog?q=${encodeURIComponent(first.name.he)}`, { staff: TEST_STAFF })
    expect(await screen.findByRole('switch', { name: 'מצב ניהול' }, LAZY)).toBeChecked()
    expect(await screen.findByRole('button', { name: `עריכה: ${first.name.he}` }, LAZY)).toBeInTheDocument()
  })
})
