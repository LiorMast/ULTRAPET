/**
 * StockDialog.tsx — The stock of one product in the admin panel (the stock ledger, backend/app/inventory.py): a dialog
 * that shows the units on hand and the stock status, records a movement (goods received, a customer return, units
 * removed, or a stock count) and lists the latest movements with who recorded them, when and why.
 *
 * A product whose stock is not tracked yet (stockQuantity null: always orderable) starts with a stock count; the
 * other kinds are offered once it is tracked. The dialog knows nothing about storage: it loads the stock with the
 * caller's `load` when it opens and records through `onSave`, which answers the stock after the movement (the page
 * also reloads its rows, so the table's cell follows).
 *
 * The helpers below connect it to the products page (routes/admin.products.tsx): stockStatus (the server's rule),
 * StockCell (the table cell: units + a Low / Out ribbon), StockSummary (the stock alerts above the table) and
 * stockAction (the row's "Stock" button that opens this dialog). The ribbons are DiscountRibbon's stock kinds, the
 * same ones customers see on the catalog.
 */
import { useEffect, useId, useLayoutEffect, useRef, useState, type FormEvent } from 'react'
import { Boxes } from 'lucide-react'
import { cn } from 'cn'
import { ApiError, type ProductStock, type StockMovement, type StockMovementInput, type StockMovementKind, type StockStatus } from '@/api'
import type { RowAction } from '@/components/DataTable'
import { DiscountRibbon, STOCK_RIBBONS } from '@/components/DiscountRibbon'
import { errorMessage, INPUT_CLASS, LABEL_CLASS } from '@/components/RecordDialog'
import { SegmentedSwitch } from '@/components/SegmentedSwitch'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useI18n, type Locale } from '@/i18n'
import type { Dictionary } from '@/i18n/he'
import { useToast } from '@/toast'

/** The movement kinds, in the order the form offers them. */
const KINDS: StockMovementKind[] = ['received', 'returned', 'removed', 'count']

/** What a stock row needs: its units on hand (null = not tracked) and its low-stock threshold (null = none). */
type StockFields = { stockQuantity: number | null; lowStockThreshold: number | null }

/**
 * The stock status of a product, by the server's rule (app/inventory.py stock_status).
 * @param quantity - Its units on hand; null = not tracked.
 * @param threshold - Its low-stock threshold; null = no low-stock warning.
 * @returns null when not tracked, "out" at 0 units, "low" at or below the threshold, else "in".
 */
export function stockStatus(quantity: number | null, threshold: number | null): StockStatus | null {
  if (quantity === null) return null
  if (quantity <= 0) return 'out'
  return threshold !== null && quantity <= threshold ? 'low' : 'in'
}

/**
 * A product's stock in the table: its units, with a ribbon when low or out; "Not counted" when untracked.
 * @param props.quantity - The units on hand (null = not tracked).
 * @param props.threshold - The low-stock threshold (null = none).
 * @returns The cell content.
 */
export function StockCell({ quantity, threshold }: { quantity: number | null; threshold: number | null }) {
  const { t, locale } = useI18n()
  const status = stockStatus(quantity, threshold)
  if (quantity === null || status === null) return <span className="text-brand-charcoal-muted">{t.stock.untracked}</span>
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <span className="font-semibold tabular-nums">{quantity.toLocaleString(locale)}</span>
      {status !== 'in' && <DiscountRibbon kind={STOCK_RIBBONS[status]} message={t.stock[status]} />}
    </span>
  )
}

/**
 * The stock alerts of a list of products: how many are out of stock and how many are low. Nothing when there are none.
 * @param props.products - The products (their units on hand and low-stock thresholds).
 * @param props.className - Extra classes for the line.
 * @returns The line of alerts, or null.
 */
export function StockSummary({ products, className }: { products: StockFields[]; className?: string }) {
  const { t, locale } = useI18n()
  const s = t.admin.stock
  const statuses = products.map((product) => stockStatus(product.stockQuantity, product.lowStockThreshold))
  const out = statuses.filter((status) => status === 'out').length
  const low = statuses.filter((status) => status === 'low').length
  if (out === 0 && low === 0) return null
  return (
    <p className={cn('flex flex-wrap items-center gap-3', className)}>
      <span className={LABEL_CLASS}>{s.summaryLabel}</span>
      {out > 0 && <DiscountRibbon kind="outOfStock" message={s.summaryOut.replace('{n}', out.toLocaleString(locale))} />}
      {low > 0 && <DiscountRibbon kind="lowStock" message={s.summaryLow.replace('{n}', low.toLocaleString(locale))} />}
    </p>
  )
}

/**
 * The "Stock" row action of a products table: opens StockDialog for the row.
 * @param t - The dictionary.
 * @param handlers.target - The row's name, shown in the dialog.
 * @param handlers.load - Loads the row's stock (e.g. fetchProductStock), aborted when the dialog closes.
 * @param handlers.onSave - Records a movement of the row's product and answers its stock after it (e.g.
 *   recordStockMovement, then a reload of the page's rows).
 * @returns The row action.
 */
export function stockAction<Row>(
  t: Dictionary,
  handlers: {
    target: (row: Row) => string
    load: (row: Row, signal: AbortSignal) => Promise<ProductStock>
    onSave: (row: Row, movement: StockMovementInput) => Promise<ProductStock>
  },
): RowAction<Row> {
  return {
    name: 'stock',
    label: t.admin.stock.button,
    rowLabel: (name) => t.admin.stock.buttonRow.replace('{name}', name),
    icon: <Boxes aria-hidden />,
    dialog: (row, props) => (
      <StockDialog
        target={handlers.target(row)}
        load={(signal) => handlers.load(row, signal)}
        onSave={(movement) => handlers.onSave(row, movement)}
        {...props}
      />
    ),
  }
}

/**
 * A signed number of units, e.g. "+48", "−3", "±0".
 * @param change - The change.
 * @param locale - The page language (digit grouping).
 * @returns The text.
 */
function signed(change: number, locale: Locale): string {
  const units = Math.abs(change).toLocaleString(locale)
  return change > 0 ? `+${units}` : change < 0 ? `−${units}` : `±${units}`
}

/**
 * One movement of the history: its kind and change, the units after it, then when, who and why.
 * @param props.movement - The movement.
 * @returns The list item.
 */
function MovementItem({ movement }: { movement: StockMovement }) {
  const { t, locale } = useI18n()
  const s = t.admin.stock
  const when = new Date(movement.createdAt).toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Jerusalem' })
  const details = [when, movement.createdBy && s.by.replace('{name}', movement.createdBy), movement.note].filter(Boolean).join(' · ')
  return (
    <li className="py-3">
      <p className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-sm text-brand-charcoal">
        <span>
          <span className="font-semibold">{s.kinds[movement.kind]}</span>{' '}
          <bdi dir="ltr" className="tabular-nums">
            {signed(movement.quantityChange, locale)}
          </bdi>
        </span>
        <span className="text-brand-charcoal-muted">
          {s.onHand}: <span className="font-semibold tabular-nums text-brand-charcoal">{movement.quantityAfter.toLocaleString(locale)}</span>
        </span>
      </p>
      <p className="mt-1 text-xs text-brand-charcoal-muted">{details}</p>
    </li>
  )
}

/**
 * The stock dialog of one product.
 * @param props.target - The product's name, shown under the title.
 * @param props.load - Loads the product's stock (called once, when the dialog opens).
 * @param props.onSave - Records a movement; resolves with the stock after it, rejects with an ApiError the form shows.
 * @param props.onClose - Closes the dialog.
 * @param props.onCloseAutoFocus - Where the focus goes after closing (the DataTable row's button).
 * @returns The dialog.
 */
export function StockDialog({
  target,
  load,
  onSave,
  onClose,
  onCloseAutoFocus,
}: {
  target: string
  load: (signal: AbortSignal) => Promise<ProductStock>
  onSave: (movement: StockMovementInput) => Promise<ProductStock>
  onClose: () => void
  onCloseAutoFocus: (event: Event) => void
}) {
  const { t, locale } = useI18n()
  const s = t.admin.stock
  const id = useId()
  const toast = useToast()
  const [stock, setStock] = useState<ProductStock | null>(null)
  const [loadFailed, setLoadFailed] = useState(false)
  const [chosen, setChosen] = useState<StockMovementKind>('received')
  const [quantity, setQuantity] = useState('')
  const [note, setNote] = useState('')
  const [quantityError, setQuantityError] = useState('')
  const [formError, setFormError] = useState('')
  const [pending, setPending] = useState(false)
  const quantityInput = useRef<HTMLInputElement>(null)

  // The latest `load`, so the caller's inline function never reloads the stock on a rerender.
  const loader = useRef(load)
  useLayoutEffect(() => {
    loader.current = load
  })
  useEffect(() => {
    const controller = new AbortController()
    loader.current(controller.signal).then(setStock, () => {
      if (!controller.signal.aborted) setLoadFailed(true)
    })
    return () => controller.abort()
  }, [])

  const onHand = stock?.stockQuantity ?? null
  const untracked = stock !== null && onHand === null
  // Only a count can start tracking a product.
  const kind: StockMovementKind = untracked ? 'count' : chosen
  const minimum = kind === 'count' ? 0 : 1
  const units = /^\d+$/.test(quantity.trim()) ? Number(quantity.trim()) : NaN
  const after = Number.isNaN(units) ? null : kind === 'count' ? units : kind === 'removed' ? (onHand ?? 0) - units : (onHand ?? 0) + units

  /**
   * Checks the form and records the movement; on success shows the new stock, clears the form and confirms it in a toast.
   * @param event - The form's submit event.
   */
  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setFormError('')
    if (Number.isNaN(units) || units < minimum) {
      setQuantityError(s.errors.quantity.replace('{min}', minimum.toLocaleString(locale)))
      quantityInput.current?.focus()
      return
    }
    if (after !== null && after < 0) {
      setQuantityError(s.errors.insufficient.replace('{n}', (onHand ?? 0).toLocaleString(locale)))
      quantityInput.current?.focus()
      return
    }
    setQuantityError('')
    setPending(true)
    try {
      setStock(await onSave({ kind, quantity: units, ...(note.trim() && { note: note.trim() }) }))
      setQuantity('')
      setNote('')
      toast.success(s.saved)
    } catch (error) {
      // The server's refusals of the units go next to the box; anything else under the form.
      const api = error instanceof ApiError ? error : undefined
      const message =
        api?.code === 'insufficient_stock'
          ? s.errors.insufficient.replace('{n}', (onHand ?? 0).toLocaleString(locale))
          : api?.code === 'untracked'
            ? s.errors.untracked
            : api?.code === 'invalid' && api.field === 'quantity'
              ? s.errors.quantity.replace('{min}', minimum.toLocaleString(locale))
              : ''
      if (message) {
        setQuantityError(message)
        quantityInput.current?.focus()
      } else {
        setFormError(errorMessage(api?.code, t))
      }
    } finally {
      setPending(false)
    }
  }

  const status = stock?.status ?? null
  const describedBy = [`${id}-quantity-hint`, quantityError && `${id}-quantity-error`].filter(Boolean).join(' ')

  return (
    <Dialog open onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent closeLabel={t.admin.close} onCloseAutoFocus={onCloseAutoFocus}>
        <DialogHeader>
          <DialogTitle>{s.title}</DialogTitle>
          <DialogDescription>
            <span className="block font-semibold text-brand-charcoal">{target}</span>
            {s.description}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} noValidate className="flex min-h-0 flex-col">
          <div className="min-h-0 space-y-6 overflow-y-auto px-6 py-5">
            {stock === null ? (
              <p role={loadFailed ? 'alert' : 'status'} className={cn('text-sm', loadFailed ? 'font-medium text-brand-red-dark' : 'text-brand-charcoal-muted')}>
                {loadFailed ? s.loadFailed : s.loading}
              </p>
            ) : (
              <>
                <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
                  <div>
                    <p className={LABEL_CLASS}>{s.onHand}</p>
                    <p className="mt-1 font-display text-3xl font-bold tabular-nums text-brand-charcoal">{onHand === null ? '—' : onHand.toLocaleString(locale)}</p>
                  </div>
                  {status ? (
                    <DiscountRibbon kind={STOCK_RIBBONS[status]} message={t.stock[status]} className="mb-1.5" />
                  ) : (
                    <span className="mb-1.5 text-sm text-brand-charcoal-muted">{t.stock.untracked}</span>
                  )}
                  <p className="mb-1.5 basis-full text-xs text-brand-charcoal-muted">
                    {stock.lowStockThreshold === null ? s.noThreshold : s.threshold.replace('{n}', stock.lowStockThreshold.toLocaleString(locale))}
                  </p>
                </div>
                {untracked && <p className="text-sm text-brand-charcoal">{s.untracked}</p>}

                <SegmentedSwitch
                  name={`${id}-kind`}
                  legend={s.kind}
                  size="sm"
                  options={KINDS.map((value) => ({ value, label: s.kinds[value], disabled: untracked && value !== 'count' }))}
                  value={kind}
                  onChange={(value) => {
                    setChosen(value)
                    setQuantityError('')
                  }}
                />

                <div className="grid gap-5 sm:grid-cols-2">
                  <div>
                    <label htmlFor={`${id}-quantity`} className={LABEL_CLASS}>{`${s.quantity[kind]} *`}</label>
                    <input
                      ref={quantityInput}
                      id={`${id}-quantity`}
                      type="text"
                      inputMode="numeric"
                      dir="ltr"
                      autoComplete="off"
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value)}
                      aria-required
                      aria-invalid={quantityError ? true : undefined}
                      aria-describedby={describedBy}
                      className={INPUT_CLASS}
                    />
                    <p id={`${id}-quantity-hint`} className="mt-1 text-xs text-brand-charcoal-muted">
                      {after !== null && after >= 0
                        ? (untracked ? s.previewNew : s.preview).replace('{to}', after.toLocaleString(locale)).replace('{from}', (onHand ?? 0).toLocaleString(locale))
                        : ' '}
                    </p>
                    {quantityError && (
                      <p id={`${id}-quantity-error`} role="alert" className="mt-1 text-xs font-medium text-brand-red-dark">
                        {quantityError}
                      </p>
                    )}
                  </div>
                  <div>
                    <label htmlFor={`${id}-note`} className={LABEL_CLASS}>
                      {s.note}
                    </label>
                    <input
                      id={`${id}-note`}
                      type="text"
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder={s.notePlaceholder[kind]}
                      className={INPUT_CLASS}
                    />
                  </div>
                </div>
                {formError && (
                  <p role="alert" className="text-sm font-medium text-brand-red-dark">
                    {formError}
                  </p>
                )}

                <section aria-labelledby={`${id}-history`}>
                  <h3 id={`${id}-history`} className={LABEL_CLASS}>
                    {s.history}
                  </h3>
                  {stock.movements.length === 0 ? (
                    <p className="mt-2 text-sm text-brand-charcoal-muted">{s.none}</p>
                  ) : (
                    <>
                      <ol className="mt-2 divide-y divide-neutral-150 border-y border-neutral-150">
                        {stock.movements.map((movement) => (
                          <MovementItem key={movement.id} movement={movement} />
                        ))}
                      </ol>
                      {stock.movementCount > stock.movements.length && (
                        <p className="mt-2 text-xs text-brand-charcoal-muted">
                          {s.historyLatest.replace('{shown}', stock.movements.length.toLocaleString(locale)).replace('{total}', stock.movementCount.toLocaleString(locale))}
                        </p>
                      )}
                    </>
                  )}
                </section>
              </>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" size="sm" onClick={onClose}>
              {t.admin.close}
            </Button>
            {stock !== null && (
              <Button type="submit" size="sm" disabled={pending}>
                {s.save}
              </Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
