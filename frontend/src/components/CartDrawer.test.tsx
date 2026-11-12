/**
 * CartDrawer.test.tsx — Tests for the header's shopping cart (CartDrawer on the reusable Offcanvas): only signed-in
 * business customers get the cart icon; it opens a titled panel from the end side with the empty state, the
 * minimum order and a disabled Checkout; it closes with the close button and Escape, and the catalog link
 * navigates and closes it; with products in it, it lists the lines (quantity, remove, subtotal) under the
 * minimum-order banner, and a stepper going down to 0 removes its line (the focus moves on).
 * Hovering the icon shows a tooltip with the cart's summary. Also covers Offcanvas on its own (uncontrolled trigger, start side, no footer).
 */
import { screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Offcanvas } from '@/components/Offcanvas'
import { TEST_STAFF, TEST_USER } from '@/test/api'
import { renderComponent, renderPage } from '@/test/utils'
import products from '@/stubs/products.json'
import prices from '@/stubs/prices.json'

describe('Cart drawer', () => {
  it('is not shown to visitors', async () => {
    await renderPage('/en')
    expect(screen.queryByRole('button', { name: 'Shopping cart' })).not.toBeInTheDocument()
  })

  it('is not shown to staff', async () => {
    await renderPage('/en', { staff: TEST_STAFF })
    expect(screen.queryByRole('button', { name: 'Shopping cart' })).not.toBeInTheDocument()
  })

  it('opens the cart panel for a business customer (English, from the right)', async () => {
    const { user } = await renderPage('/en', { user: TEST_USER })
    const button = within(screen.getByRole('banner')).getByRole('button', { name: 'Shopping cart' })
    expect(button).toHaveAttribute('aria-expanded', 'false')
    await user.click(button)

    const panel = await screen.findByRole('dialog', { name: 'Shopping cart' })
    expect(panel).toHaveAttribute('data-side', 'right')
    expect(panel).toHaveAccessibleDescription('Minimum order ₪2,000')
    expect(within(panel).getByText('Your cart is empty')).toBeInTheDocument()
    expect(within(panel).getByRole('button', { name: 'Checkout' })).toBeDisabled()
    expect(within(panel).getByRole('link', { name: 'Browse the catalog' })).toHaveAttribute('href', '/en/catalog')
  })

  it('slides from the left in Hebrew and closes with the close button, focusing the cart icon', async () => {
    const { user } = await renderPage('/', { user: TEST_USER })
    const button = screen.getByRole('button', { name: 'סל קניות' })
    await user.click(button)
    const panel = await screen.findByRole('dialog', { name: 'סל קניות' })
    expect(panel).toHaveAttribute('data-side', 'left')

    await user.click(within(panel).getByRole('button', { name: 'סגירה' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(button).toHaveFocus()
  })

  it('closes with Escape', async () => {
    const { user } = await renderPage('/en', { user: TEST_USER })
    await user.click(screen.getByRole('button', { name: 'Shopping cart' }))
    await screen.findByRole('dialog', { name: 'Shopping cart' })
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('goes to the catalog and closes from the empty state link', async () => {
    const { user, router } = await renderPage('/en', { user: TEST_USER })
    await user.click(screen.getByRole('button', { name: 'Shopping cart' }))
    const panel = await screen.findByRole('dialog', { name: 'Shopping cart' })
    await user.click(within(panel).getByRole('link', { name: 'Browse the catalog' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/catalog'))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it("shows the cart's summary in a tooltip on hover", async () => {
    const { user } = await renderPage('/en/catalog', { user: TEST_USER })
    const cart = screen.getByRole('button', { name: 'Shopping cart' })
    await user.hover(cart)
    expect(await screen.findByRole('tooltip')).toHaveTextContent('Shopping cartYour cart is empty')
    await user.unhover(cart)
    await waitFor(() => expect(screen.queryByRole('tooltip')).not.toBeInTheDocument())

    await user.click((await screen.findAllByRole('button', { name: 'Add to cart' }))[0])
    await user.hover(screen.getByRole('button', { name: 'Shopping cart, 1 item' }))
    expect(await screen.findByRole('tooltip')).toHaveTextContent(/1 item · ₪[\d.,]+ before VAT/)
  })

  it('lists the lines: change the quantity, remove, subtotal and the minimum order', async () => {
    const { user } = await renderPage('/en/catalog', { user: TEST_USER })
    const add = (await screen.findAllByRole('button', { name: 'Add to cart' }))[0]
    const name = within(add.closest('article')!).getByRole('heading').textContent!
    const unit = prices.prices[Object.keys(prices.prices).find((id) => products.find((p) => p.id === id)?.name.en === name)! as keyof typeof prices.prices]
    await user.click(add)
    await user.click(screen.getByRole('button', { name: 'Shopping cart, 1 item' }))
    const panel = await screen.findByRole('dialog', { name: 'Shopping cart' })

    const line = within(panel).getByRole('listitem')
    expect(within(line).getByRole('link', { name })).toHaveAttribute('href', expect.stringContaining('/en/products/'))
    expect(panel).toHaveTextContent('Subtotal')
    expect(panel).toHaveTextContent(new Intl.NumberFormat('en', { style: 'currency', currency: 'ILS' }).format(unit))
    const banner = panel.querySelector('[data-slot="offcanvas-notice"]')!
    expect(banner).toHaveTextContent(/Add ₪[\d.,]+ more to reach the ₪2,000 minimum order/)
    expect(within(banner as HTMLElement).getByRole('progressbar', { name: 'Progress to the minimum order' })).toHaveAttribute('aria-valuemax', '2000')

    // Enough units to pass the minimum.
    const quantity = within(line).getByRole('textbox', { name: `Quantity of ${name}` })
    await user.clear(quantity)
    await user.type(quantity, String(Math.ceil(2000 / unit)))
    expect(banner).toHaveTextContent('Minimum order reached')
    expect(within(banner as HTMLElement).queryByRole('progressbar')).not.toBeInTheDocument()
    expect(within(panel).getByRole('button', { name: 'Checkout' })).toBeDisabled()

    await user.click(within(line).getByRole('button', { name: `Remove ${name}` }))
    expect(within(panel).getByText('Your cart is empty')).toBeInTheDocument()
    // The page behind the open panel is hidden from assistive tech, so the header button is too.
    expect(screen.getByRole('button', { name: 'Shopping cart', hidden: true })).toBeInTheDocument()
  })

  it('removes a line when its stepper goes down to 0, moving the focus to the next line', async () => {
    const { user } = await renderPage('/en/catalog', { user: TEST_USER })
    const adds = await screen.findAllByRole('button', { name: 'Add to cart' })
    const names = adds.slice(0, 2).map((add) => within(add.closest('article')!).getByRole('heading').textContent!)
    await user.click(adds[0])
    await user.click(adds[1])
    await user.click(screen.getByRole('button', { name: 'Shopping cart, 2 items' }))
    const panel = await screen.findByRole('dialog', { name: 'Shopping cart' })

    const first = within(panel).getAllByRole('listitem')[0]
    expect(within(first).queryByRole('button', { name: 'Decrease quantity' })).not.toBeInTheDocument()
    await user.click(within(first).getByRole('button', { name: 'Decrease to 0 (remove)' }))
    expect(within(panel).getAllByRole('listitem')).toHaveLength(1)
    expect(within(panel).queryByRole('link', { name: names[0] })).not.toBeInTheDocument()
    await waitFor(() => expect(within(panel).getByRole('link', { name: names[1] })).toHaveFocus())

    // Typing 0 removes the last line too; the focus goes to the empty state's link.
    const quantity = within(panel).getByRole('textbox', { name: `Quantity of ${names[1]}` })
    await user.clear(quantity)
    await user.type(quantity, '0')
    expect(within(panel).getByText('Your cart is empty')).toBeInTheDocument()
    await waitFor(() => expect(within(panel).getByRole('link', { name: 'Browse the catalog' })).toHaveFocus())
  })
})

describe('Offcanvas', () => {
  it('opens from its own trigger on the start side, without a footer or description', async () => {
    const { user } = renderComponent(
      <Offcanvas title="Filters" side="start" trigger={<button type="button">Open filters</button>}>
        <p>Body text</p>
      </Offcanvas>,
      'en',
    )
    await user.click(await screen.findByRole('button', { name: 'Open filters' }))
    const panel = await screen.findByRole('dialog', { name: 'Filters' })
    expect(panel).toHaveAttribute('data-side', 'left')
    expect(within(panel).getByText('Body text')).toBeInTheDocument()
    expect(panel.querySelector('[data-slot="sheet-footer"]')).toBeNull()
    expect(panel).not.toHaveAttribute('aria-describedby')

    await user.click(within(panel).getByRole('button', { name: 'Close' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })
})
