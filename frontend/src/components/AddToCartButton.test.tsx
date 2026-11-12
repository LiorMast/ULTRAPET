/**
 * AddToCartButton.test.tsx — Tests for adding products to the cart (AddToCartButton, the cart state in src/cart.tsx,
 * QuantityStepper) inside the real app: who gets the buttons (customers only, where a price is shown), adding from a
 * catalog card (the "Added" morph and its status line, the header badge, merging, no navigation), adding a quantity
 * from the product page, the product photo flying to the cart icon (the badge pops when it lands; no flight with
 * reduced motion), the cart being saved per customer in browser storage, and the stock status (a product out of stock
 * cannot be added; low stock is marked; visitors see no stock at all).
 */
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ADDED_MS } from '@/components/AddToCartButton'
import { setFakeStock, TEST_STAFF, TEST_USER } from '@/test/api'
import { renderPage } from '@/test/utils'
import products from '@/stubs/products.json'
import prices from '@/stubs/prices.json'

/** A product with a price and a photo, for the product page tests. */
const product = products.find((p) => p.id in prices.prices && p.images.length > 0)!
const productUrl = `/en/products/${encodeURIComponent(product.slug)}`

/** Two other priced products of the catalog's first page (the stub order), for the stock tests. */
const [soldOut, running] = products.slice(0, 24).filter((p) => p.id in prices.prices && p.id !== product.id)

/**
 * The catalog card of a product.
 * @param name - The product's English name.
 * @returns The card (<article>).
 */
const cardOf = (name: string) => screen.getByRole('heading', { name }).closest('article')!

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

    const cart = screen.getByRole('button', { name: 'Shopping cart, 1 item' })
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
    expect(screen.getByRole('button', { name: 'Shopping cart, 1 item' })).toBeInTheDocument()
    again.unmount()

    // Another customer on the same browser starts with an empty cart.
    await renderPage('/en', { user: { ...TEST_USER, email: 'other@example.com' } })
    await waitFor(() => expect(screen.getByRole('button', { name: 'Shopping cart' })).toBeInTheDocument())
  })

  it('flies the card photo to the cart icon, and pops the badge only when it lands', async () => {
    const { user } = await renderPage('/en/catalog', { user: TEST_USER })
    const { button, card } = await firstCard()
    // jsdom has no layout or Web Animations: give boxes a size and control when the flight finishes.
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ left: 100, top: 400, right: 300, bottom: 600, width: 200, height: 200 } as DOMRect)
    let land!: () => void
    const finished = new Promise<void>((resolve) => (land = resolve))
    const animate = vi.fn(() => ({ finished }) as unknown as Animation)
    HTMLElement.prototype.animate = animate

    await user.click(button)
    const flyer = document.querySelector<HTMLImageElement>('body > div[aria-hidden="true"] > img')
    expect(flyer?.src).toBe(card.querySelector('img')!.src)
    expect(animate).toHaveBeenCalledTimes(2)
    const cart = screen.getByRole('button', { name: 'Shopping cart, 1 item' })
    expect(within(cart).getByTestId('cart-badge')).not.toHaveClass('animate-cart-pop')

    await act(async () => land())
    expect(within(cart).getByTestId('cart-badge')).toHaveClass('animate-cart-pop')
    expect(document.querySelector('body > div[aria-hidden="true"] > img')).toBeNull()
    delete (HTMLElement.prototype as Partial<HTMLElement>).animate
  })

  it('does not fly with reduced motion: the badge pops at once', async () => {
    const { user } = await renderPage('/en/catalog', { user: TEST_USER })
    const { button } = await firstCard()
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ left: 100, top: 400, right: 300, bottom: 600, width: 200, height: 200 } as DOMRect)
    const animate = vi.fn()
    HTMLElement.prototype.animate = animate
    vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: true } as MediaQueryList)

    await user.click(button)
    expect(animate).not.toHaveBeenCalled()
    expect(within(screen.getByRole('button', { name: 'Shopping cart, 1 item' })).getByTestId('cart-badge')).toHaveClass('animate-cart-pop')
    delete (HTMLElement.prototype as Partial<HTMLElement>).animate
  })
})

describe('Stock', () => {
  it('cannot add a product that is out of stock, and marks one that is low, on the catalog cards', async () => {
    await setFakeStock(soldOut.id, 0)
    await setFakeStock(running.id, 2, 5)
    await renderPage('/en/catalog', { user: TEST_USER })
    await screen.findAllByRole('button', { name: 'Add to cart' })

    const out = cardOf(soldOut.name.en)
    expect(within(out).getByRole('button', { name: 'Out of stock' })).toBeDisabled()
    expect(within(out).queryByRole('button', { name: 'Add to cart' })).not.toBeInTheDocument()

    const low = cardOf(running.name.en)
    expect(within(low).getByText('Low stock')).toBeInTheDocument()
    expect(within(low).getByRole('button', { name: 'Add to cart' })).toBeEnabled()
  })

  it('shows the stock status on the product page, and no quantity or Add to cart when out of stock', async () => {
    await setFakeStock(product.id, 40, 5)
    const first = await renderPage(productUrl, { user: TEST_USER })
    const main = screen.getByRole('main')
    expect(await within(main).findByText('In stock')).toBeInTheDocument()
    expect(within(main).getByRole('textbox', { name: 'Quantity' })).toBeInTheDocument()
    first.unmount()

    await setFakeStock(product.id, 0, 5)
    await renderPage(productUrl, { user: TEST_USER })
    const page = screen.getByRole('main')
    expect(await within(page).findByRole('button', { name: 'Out of stock' })).toBeDisabled()
    expect(within(page).getByText('Out of stock', { selector: '[data-slot="discount-ribbon"]' })).toBeInTheDocument()
    expect(within(page).queryByRole('textbox', { name: 'Quantity' })).not.toBeInTheDocument()
  })

  it('shows nothing about stock to visitors, nor for products whose stock is not tracked', async () => {
    await setFakeStock(soldOut.id, 0)
    const visitor = await renderPage('/en/catalog')
    expect(screen.queryByText('Out of stock')).not.toBeInTheDocument()
    visitor.unmount()

    // The product itself is untracked (its related products below may not be).
    await renderPage(productUrl, { user: TEST_USER })
    const details = screen.getByRole('article', { name: product.name.en })
    await within(details).findByRole('button', { name: 'Add to cart' })
    expect(within(details).queryByText(/^(In stock|Low stock|Out of stock)$/)).not.toBeInTheDocument()
  })
})
