/**
 * cart.tsx — The signed-in business customer's shopping cart: the cart state for the whole site.
 *
 * CartProvider (inside AuthProvider) holds the lines and useCart() gives components the lines, totals and the
 * actions (add, setQuantity, remove). Used by AddToCartButton (the catalog cards and the product page) and
 * CartDrawer (the header's cart icon and panel).
 *
 * Until the server cart and checkout (Phase 4) exist, the cart lives in localStorage, one per customer
 * (`ultrapet.cart.<email>`): it survives reloads, another customer signing in on the same browser sees their own
 * cart, and visitors and staff have none. Each line keeps a snapshot of the product (name, photo, unit price)
 * taken when it was added; checkout will re-price the lines on the server (bulk discounts included).
 */
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { useAuth } from '@/auth'
import type { Localized } from '@/config'

/** One product in the cart: the snapshot taken when it was added, and how many units. */
export type CartLine = {
  id: string
  slug: string
  name: Localized<string>
  image: string | null
  unitPrice: number
  quantity: number
}

/** What AddToCartButton gives the cart: a line without its quantity. */
export type CartProduct = Omit<CartLine, 'quantity'>

/** The fewest and the most units one line may hold. */
export const MIN_QUANTITY = 1
export const MAX_QUANTITY = 9999

type CartValue = {
  lines: CartLine[]
  count: number
  subtotal: number
  addedTick: number
  add: (product: CartProduct, quantity?: number) => void
  setQuantity: (id: string, quantity: number) => void
  remove: (id: string) => void
}

const CartContext = createContext<CartValue | null>(null)

/** The cart of visitors and staff (one shared array, so memoized values stay stable). */
const NO_LINES: CartLine[] = []

/**
 * Keeps a quantity a whole number within MIN_QUANTITY..MAX_QUANTITY.
 * @param quantity - Any number (typed, or a sum).
 * @returns The clamped whole number.
 */
export function clampQuantity(quantity: number): number {
  if (!Number.isFinite(quantity)) return MIN_QUANTITY
  return Math.min(Math.max(Math.round(quantity), MIN_QUANTITY), MAX_QUANTITY)
}

/**
 * The browser storage key of one customer's cart.
 * @param email - The customer's email.
 * @returns The localStorage key.
 */
function storageKey(email: string): string {
  return `ultrapet.cart.${email}`
}

/**
 * Reads a customer's saved cart. Storage can be blocked (private mode) or hold junk, so both are guarded.
 * @param email - The customer's email.
 * @returns The saved lines, or an empty cart.
 */
function readCart(email: string): CartLine[] {
  try {
    const saved = JSON.parse(window.localStorage.getItem(storageKey(email)) ?? '[]') as unknown
    return Array.isArray(saved) ? (saved as CartLine[]).filter((line) => typeof line?.id === 'string' && typeof line.unitPrice === 'number') : []
  } catch {
    return []
  }
}

/**
 * Saves a customer's cart (an empty cart removes the key).
 * @param email - The customer's email.
 * @param lines - The lines to keep.
 */
function writeCart(email: string, lines: CartLine[]) {
  try {
    if (lines.length) window.localStorage.setItem(storageKey(email), JSON.stringify(lines))
    else window.localStorage.removeItem(storageKey(email))
  } catch {
    // Storage unavailable: the cart then lasts only for this page load.
  }
}

/**
 * Provides the cart of the signed-in business customer (empty and inert for visitors and staff).
 * @param props.children - The app.
 * @returns The provider wrapping the children.
 */
export function CartProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const owner = user?.kind === 'business' ? user.email : null
  // The lines belong to `owner`; when another customer signs in, their own cart is read (during render, no effect).
  const [cart, setCart] = useState<{ owner: string | null; lines: CartLine[] }>(() => ({ owner, lines: owner ? readCart(owner) : [] }))
  const [addedTick, setAddedTick] = useState(0)
  if (cart.owner !== owner) setCart({ owner, lines: owner ? readCart(owner) : [] })
  const lines = cart.owner === owner ? cart.lines : NO_LINES

  /**
   * Replaces the lines through `change` and saves them for the current customer.
   * @param change - Gets the current lines, returns the new ones.
   */
  const update = useCallback(
    (change: (current: CartLine[]) => CartLine[]) => {
      if (!owner) return
      setCart((current) => {
        const next = change(current.owner === owner ? current.lines : readCart(owner))
        writeCart(owner, next)
        return { owner, lines: next }
      })
    },
    [owner],
  )

  /**
   * Adds units of a product; a product already in the cart gets the units added to its line.
   * @param product - The product snapshot (id, slug, name, photo, unit price).
   * @param quantity - Units to add (default 1).
   */
  const add = useCallback(
    (product: CartProduct, quantity = 1) => {
      if (!owner) return
      update((current) => {
        const existing = current.find((line) => line.id === product.id)
        if (!existing) return [...current, { ...product, quantity: clampQuantity(quantity) }]
        return current.map((line) => (line.id === product.id ? { ...line, ...product, quantity: clampQuantity(line.quantity + quantity) } : line))
      })
      setAddedTick((tick) => tick + 1)
    },
    [owner, update],
  )

  /**
   * Sets a line's quantity (clamped to MIN_QUANTITY..MAX_QUANTITY).
   * @param id - The product id.
   * @param quantity - The new number of units.
   */
  const setQuantity = useCallback(
    (id: string, quantity: number) => update((current) => current.map((line) => (line.id === id ? { ...line, quantity: clampQuantity(quantity) } : line))),
    [update],
  )

  /**
   * Removes a product from the cart.
   * @param id - The product id.
   */
  const remove = useCallback((id: string) => update((current) => current.filter((line) => line.id !== id)), [update])

  const value = useMemo(() => {
    const count = lines.reduce((sum, line) => sum + line.quantity, 0)
    // Rounded to agorot once, like the server's prices.
    const subtotal = Math.round(lines.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0) * 100) / 100
    return { lines, count, subtotal, addedTick, add, setQuantity, remove }
  }, [lines, addedTick, add, setQuantity, remove])
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

/**
 * Gives a component the cart.
 * @returns The lines, `count` (units), `subtotal` (shekels before VAT), `addedTick` (grows on every add) and the
 *   actions `add`, `setQuantity`, `remove`.
 */
export function useCart(): CartValue {
  const value = useContext(CartContext)
  if (!value) throw new Error('useCart must be used inside <CartProvider>')
  return value
}
