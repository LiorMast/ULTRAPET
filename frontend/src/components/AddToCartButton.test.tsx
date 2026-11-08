/**
 * AddToCartButton.test.tsx — Tests for adding products to the cart (AddToCartButton, the cart state in src/cart.tsx,
 * QuantityStepper) inside the real app: who gets the buttons (customers only, where a price is shown), adding from a
 * catalog card (the "Added" morph and its status line, the header badge, merging, no navigation), adding a quantity
 * from the product page, and the cart being saved per customer in browser storage.
 */
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ADDED_MS } from '@/components/AddToCartButton'
import { TEST_STAFF, TEST_USER } from '@/test/api'
import { renderPage } from '@/test/utils'
import products from '@/stubs/products.json'
import prices from '@/stubs/prices.json'

/** A product with a price and a photo, for the product page tests. */
const product = products.find((p) => p.id in prices.prices && p.images.length > 0)!
const productUrl = `/en/products/${encodeURIComponent(product.slug)}`

/**
 * The first catalog card that has an "Add to cart" button, once the customer's prices arrived.
 * @returns The card (<article>), its button and its product name.
 */
async function firstCard() {
  const button = (await screen.findAllByRole('button', { name: 'Add to cart' }))[0]
  const card = button.closest('article')!
  return { card, button, name: within(card).getByRole('heading').textContent! }
}

afterEach(() => vi.useRealTimers())

describe('Add to cart', () => {
  it('is not offered to visitors (they get the login link) or staff', async () => {
    await renderPage('/en/catalog')
    expect(screen.queryByRole('button', { name: 'Add to cart' })).not.toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: /log in/i }).length).toBeGreaterThan(0)
  })

  it('is not offered to staff', async () => {
    await renderPage('/en/catalog', { staff: TEST_STAFF })
    expect(screen.queryByRole('button', { name: 'Add to cart' })).not.toBeInTheDocument()
  })

  it('adds one unit from a card: morphs to "Added", announces it, pops the badge, and stays on the page', async () => {
    const { user, router } = await renderPage('/en/catalog', { user: TEST_USER })
    const { button, name } = await firstCard()

    await user.click(button)
    expect(button).toHaveAttribute('data-added')
    expect(within(button).getByText('Added')).toHaveClass('opacity-100')
    expect(screen.getByText(`Added to cart: ${name}`)).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/catalog')

    const cart = screen.getByRole('button', { name: 'Shopping cart, 1 items' })
    expect(within(cart).getByTestId('cart-badge')).toHaveTextContent('1')
    expect(within(cart).getByTestId('cart-badge')).toHaveClass('animate-cart-pop')

    // Adding again merges into the same line.
    await user.click(button)
    expect(screen.getByRole('button', { name: 'Shopping cart, 2 items' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Shopping cart, 2 items' }))
    const panel = await screen.findByRole('dialog', { name: 'Shopping cart' })
    expect(within(panel).getAllByRole('listitem')).toHaveLength(1)
    expect(within(panel).getByRole('textbox', { name: `Quantity of ${name}` })).toHaveValue('2')
  })

  it('turns back into "Add to cart" after a moment', async () => {
    await renderPage('/en/catalog', { user: TEST_USER })
    const { button } = await firstCard()
    vi.useFakeTimers()
    fireEvent.click(button)
    expect(button).toHaveAttribute('data-added')
    act(() => vi.advanceTimersByTime(ADDED_MS))
    expect(button).not.toHaveAttribute('data-added')
    expect(within(button).getByText('Add to cart')).toHaveClass('opacity-100')
  })

  it('adds the chosen quantity from the product page, then resets it to 1', async () => {
    const { user } = await renderPage(productUrl, { user: TEST_USER })
    const main = screen.getByRole('main')
    const add = (await within(main).findAllByRole('button', { name: 'Add to cart' }))[0]
    const quantity = within(main).getByRole('textbox', { name: 'Quantity' })
    expect(within(main).getByRole('button', { name: 'Decrease quantity' })).toBeDisabled()

    await user.click(within(main).getByRole('button', { name: 'Increase quantity' }))
    await user.click(within(main).getByRole('button', { name: 'Increase quantity' }))
    expect(quantity).toHaveValue('3')
    await user.click(add)
    expect(quantity).toHaveValue('1')
    expect(screen.getByRole('button', { name: 'Shopping cart, 3 items' })).toBeInTheDocument()
  })

  it('accepts a typed quantity, keeping digits only', async () => {
    const { user } = await renderPage(productUrl, { user: TEST_USER })
    const main = screen.getByRole('main')
    const quantity = await within(main).findByRole('textbox', { name: 'Quantity' })
    await user.clear(quantity)
    await user.type(quantity, '1a2')
    expect(quantity).toHaveValue('12')
    await user.click(within(main).getAllByRole('button', { name: 'Add to cart' })[0])
    expect(screen.getByRole('button', { name: 'Shopping cart, 12 items' })).toBeInTheDocument()
  })

  it("keeps each customer's cart in browser storage", async () => {
    const first = await renderPage('/en/catalog', { user: TEST_USER })
    await first.user.click((await firstCard()).button)
    first.unmount()

    // The same customer comes back: the cart is still there.
    const again = await renderPage('/en', { user: TEST_USER })
    expect(screen.getByRole('button', { name: 'Shopping cart, 1 items' })).toBeInTheDocument()
    again.unmount()

    // Another customer on the same browser starts with an empty cart.
    await renderPage('/en', { user: { ...TEST_USER, email: 'other@example.com' } })
    await waitFor(() => expect(screen.getByRole('button', { name: 'Shopping cart' })).toBeInTheDocument())
  })
})
