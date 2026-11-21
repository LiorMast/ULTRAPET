/**
 * CatalogCard.test.tsx — Tests for the discounts a signed-in customer sees on the catalog cards (CatalogCard,
 * PriceSlot, DiscountRibbons) and on the product page, inside the real app against the fake API (src/test/api.ts,
 * whose /api/prices applies the price rules like backend/app/pricing.py): one ribbon per kind of discount in its
 * color, the list price struck out, the total percentage of all discounts combined; nothing for undiscounted products,
 * for visitors, and in Hebrew the translated names; and the bulk prices footnote (BulkNote: the first tier on a card,
 * every tier with its saving on the product page).
 */
import { screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { discountPercent } from '@/components/CatalogCard'
import products from '@/stubs/products.json'
import prices from '@/stubs/prices.json'
import { addFakePriceRule, TEST_USER } from '@/test/api'
import { renderPage } from '@/test/utils'

/** The first two products of the catalog (same category) and the first product of another category. */
const [first, second] = products
const other = products.slice(0, 24).find((product) => product.category !== first.category && String(product.id) in prices.prices)!

/** The list prices of the stub products, by public id. */
const LIST = prices.prices as Record<string, number>

/**
 * The catalog card of a product.
 * @param name - The product's English name.
 * @returns The card (<article>).
 */
const cardOf = (name: string) => screen.getByRole('heading', { name }).closest('article')!

/**
 * The discount ribbons inside an element.
 * @param element - A card or the product page's details.
 * @returns The ribbons, in display order.
 */
const ribbonsIn = (element: HTMLElement) => [...element.querySelectorAll<HTMLElement>('[data-slot="discount-ribbons"] [data-slot="discount-ribbon"]')]

/**
 * Formats shekels the way the English site does.
 * @param amount - Shekels.
 * @returns E.g. "₪303.90".
 */
const shekels = (amount: number) => new Intl.NumberFormat('en', { style: 'currency', currency: 'ILS' }).format(amount)

/** A general 10% on the first product's category and the customer's own 20% on the first product. */
async function seedDiscounts() {
  await addFakePriceRule({ category: first.category, kind: 'percent', value: 10 })
  await addFakePriceRule({ product: String(first.id), customer: true, kind: 'percent', value: 20 })
}

describe('discounts on the catalog cards', () => {
  it('shows a ribbon per kind of discount, the list price struck out and the combined percentage', async () => {
    await seedDiscounts()
    await renderPage('/en/catalog', { user: TEST_USER })
    const card = cardOf(first.name.en)
    await within(card).findByRole('button', { name: 'Add to cart' })

    const ribbons = ribbonsIn(card)
    expect(ribbons.map((ribbon) => ribbon.textContent)).toEqual(['Sale', 'Your discount'])
    // The default colors: brand red with white text, charcoal with white text.
    expect(ribbons[0]).toHaveStyle({ backgroundColor: '#BE1E24', color: '#FFFFFF' })
    expect(ribbons[1]).toHaveStyle({ backgroundColor: '#1A1A1A', color: '#FFFFFF' })

    // 303.90 - 20% - 10% = 218.81: 28% off in all.
    const list = LIST[String(first.id)]
    const price = Math.round(list * 0.8 * 0.9 * 100) / 100
    expect(within(card).getByText(shekels(price))).toBeInTheDocument()
    expect(within(card).getByText(shekels(list)).tagName).toBe('S')
    expect(within(card).getByText(`-${discountPercent(list, price)}%`)).toBeInTheDocument()
    expect(card).toHaveTextContent(`Wholesale price: ${shekels(price)}Price before discount: ${shekels(list)}Total discount: -28%`)
  })

  it('shows only the kinds that apply, and nothing on a product without a discount', async () => {
    await seedDiscounts()
    await renderPage('/en/catalog', { user: TEST_USER })
    const card = cardOf(second.name.en)
    await within(card).findByRole('button', { name: 'Add to cart' })
    expect(ribbonsIn(card).map((ribbon) => ribbon.textContent)).toEqual(['Sale'])
    expect(within(card).getByText('-10%')).toBeInTheDocument()

    const plain = cardOf(other.name.en)
    expect(ribbonsIn(plain)).toEqual([])
    expect(plain.querySelector('s')).toBeNull()
    expect(within(plain).getByText(shekels(LIST[String(other.id)]))).toBeInTheDocument()
  })

  it('shows a fixed price below the list price as the customer\'s discount only', async () => {
    await addFakePriceRule({ category: first.category, kind: 'percent', value: 10 })
    await addFakePriceRule({ product: String(first.id), customer: true, kind: 'fixed_price', value: 150 })
    await renderPage('/en/catalog', { user: TEST_USER })
    const card = cardOf(first.name.en)
    await within(card).findByRole('button', { name: 'Add to cart' })
    expect(ribbonsIn(card).map((ribbon) => ribbon.textContent)).toEqual(['Your discount'])
    expect(within(card).getByText(shekels(150))).toBeInTheDocument()
  })

  it('shows visitors no discounts at all', async () => {
    await seedDiscounts()
    await renderPage('/en/catalog')
    const card = cardOf(first.name.en)
    expect(ribbonsIn(card)).toEqual([])
    expect(card.querySelector('s')).toBeNull()
    expect(within(card).getByRole('link', { name: 'Log in to see the price' })).toBeInTheDocument()
  })

  it('names the kinds in Hebrew', async () => {
    await seedDiscounts()
    await renderPage('/catalog', { user: TEST_USER })
    const card = screen.getByRole('heading', { name: first.name.he }).closest('article')!
    await within(card).findByRole('button', { name: 'הוספה לסל' })
    expect(ribbonsIn(card).map((ribbon) => ribbon.textContent)).toEqual(['מבצע', 'ההנחה שלך'])
  })
})

describe('discounts on the product page', () => {
  it('shows the ribbons above the price, the list price struck out and the total', async () => {
    await seedDiscounts()
    await renderPage(`/en/products/${encodeURIComponent(first.slug)}`, { user: TEST_USER })
    const details = screen.getByRole('article', { name: first.name.en })
    await within(details).findByRole('button', { name: 'Add to cart' })
    const block = within(details).getByText(shekels(LIST[String(first.id)]), { selector: 's' }).closest('div')!
    expect(ribbonsIn(block).map((ribbon) => ribbon.textContent)).toEqual(['Sale', 'Your discount'])
    expect(within(block).getByText('-28%')).toBeInTheDocument()
  })
})

describe('the bulk prices footnote', () => {
  /** A general 5% from 12 units on the first product's category and the customer's own 10% from 50 on the first product. */
  async function seedBulk() {
    await addFakePriceRule({ category: first.category, kind: 'percent', value: 5, minQuantity: 12 })
    await addFakePriceRule({ product: String(first.id), customer: true, kind: 'percent', value: 10, minQuantity: 50 })
  }
  const list = () => LIST[String(first.id)]
  const at12 = () => Math.round(list() * 0.95 * 100) / 100
  const at50 = () => Math.round(list() * 0.9 * 0.95 * 100) / 100

  it('shows the first tier on a card, with a pointer to the product page when there are more', async () => {
    await seedBulk()
    await renderPage('/en/catalog', { user: TEST_USER })
    const card = cardOf(first.name.en)
    await within(card).findByRole('button', { name: 'Add to cart' })
    const note = card.querySelector('[data-slot="bulk-note"]')!
    expect(note).toHaveTextContent(`From 12 units: ${shekels(at12())} per unit · more on the product page`)
    // Bulk never changes the one-unit price: no ribbon, no struck-out price.
    expect(ribbonsIn(card)).toEqual([])
    expect(within(card).getByText(shekels(list()))).toBeInTheDocument()

    const single = cardOf(second.name.en).querySelector('[data-slot="bulk-note"]')!
    expect(single).toHaveTextContent(`From 12 units: ${shekels(Math.round(LIST[String(second.id)] * 0.95 * 100) / 100)} per unit`)
    expect(single).not.toHaveTextContent('more on the product page')
    expect(cardOf(other.name.en).querySelector('[data-slot="bulk-note"]')).toBeNull()
  })

  it('lists every tier with its saving on the product page', async () => {
    await seedBulk()
    await renderPage(`/en/products/${encodeURIComponent(first.slug)}`, { user: TEST_USER })
    const details = screen.getByRole('article', { name: first.name.en })
    await within(details).findByRole('button', { name: 'Add to cart' })
    const note = details.querySelector<HTMLElement>('[data-slot="bulk-note"]')!
    expect(within(note).getByText('Bulk prices')).toBeInTheDocument()
    expect(within(note).getAllByRole('listitem').map((item) => item.textContent)).toEqual([
      `From 12 units: ${shekels(at12())} per unit (-5%)`,
      `From 50 units: ${shekels(at50())} per unit (-15%)`,
    ])
    expect(note).toHaveTextContent('The bulk price applies in the cart from that quantity on.')
  })

  it('takes the saving off the list price when a regular discount applies too, and reads in Hebrew', async () => {
    await addFakePriceRule({ category: first.category, kind: 'percent', value: 10 })
    await addFakePriceRule({ product: String(first.id), kind: 'percent', value: 10, minQuantity: 6 })
    await renderPage(`/products/${encodeURIComponent(first.slug)}`, { user: TEST_USER })
    const details = screen.getByRole('article', { name: first.name.he })
    await within(details).findByRole('button', { name: 'הוספה לסל' })
    const note = details.querySelector<HTMLElement>('[data-slot="bulk-note"]')!
    expect(within(note).getByText('מחירי כמות')).toBeInTheDocument()
    // 10% then 10% more = 19% off the list price.
    expect(within(note).getByRole('listitem')).toHaveTextContent(/^מ־6 יחידות: .+ ליחידה \(-19%\)$/)
  })

  it('is not shown to visitors', async () => {
    await seedBulk()
    await renderPage('/en/catalog')
    expect(cardOf(first.name.en).querySelector('[data-slot="bulk-note"]')).toBeNull()
  })
})
