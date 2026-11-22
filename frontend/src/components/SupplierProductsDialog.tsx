/**
 * SupplierProductsDialog.tsx — The products one supplier supplies, in the admin panel (table product_suppliers): a
 * dialog that lists them, each with the supplier's own item code, the cost price and its currency, adds products
 * (a type-to-search field over the catalog), removes them, and saves the whole list at once.
 *
 * The dialog knows nothing about storage: it loads the list with the caller's `load` when it opens and saves through
 * `onSave`, which answers the saved list (backend/app/staff/routes.py replaces it in one transaction, so a refused
 * line saves nothing; the refused line's box gets the error and the focus).
 * supplierProductsAction connects it to a DataTable page (routes/admin.suppliers.tsx) as the row's "Products" button.
 * While the list loads, the body shows skeletons in its shape (ui/skeleton.tsx).
 */
import { useEffect, useId, useLayoutEffect, useRef, useState, type FormEvent } from 'react'
import { Package, Trash2 } from 'lucide-react'
import { ApiError, type SupplierProduct, type SupplierProductInput } from '@/api'
import type { RowAction } from '@/components/DataTable'
import { errorMessage } from '@/components/RecordDialog'
import { SearchableField, type SearchOption } from '@/components/SearchableField'
import { Button } from '@/components/ui/button'
import { INPUT_CLASS, LABEL_CLASS } from '@/components/ui/input'
import { Skeleton, SkeletonFields, SkeletonGroup } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useI18n } from '@/i18n'
import type { Dictionary } from '@/i18n/he'
import { useToast } from '@/toast'

/** The cost currencies the form offers (ISO 4217), shekels first; a stored line in another currency keeps its own. */
export const COST_CURRENCIES = ['ILS', 'USD', 'EUR', 'GBP', 'CNY']

/** A cost price as typed: digits with an optional decimal point or comma (e.g. "12.50", "12,5"); empty = unknown. */
const COST_PATTERN = /^\d+([.,]\d+)?$/

/** One line of the form: the product and the texts its boxes edit. */
type Line = { productId: string; supplierSku: string; costPrice: string; costCurrency: string }

/**
 * Turns a saved line into the texts the form edits.
 * @param line - A line as the server answers it.
 * @returns The form line.
 */
const toLine = (line: SupplierProduct): Line => ({
  productId: line.productId,
  supplierSku: line.supplierSku ?? '',
  costPrice: line.costPrice === null ? '' : String(line.costPrice),
  costCurrency: line.costCurrency,
})

/**
 * Turns a form line into what the server stores.
 * @param line - The form line (its cost already checked).
 * @returns The line to send: a blank code or cost is null.
 */
const toInput = (line: Line): SupplierProductInput => ({
  productId: line.productId,
  supplierSku: line.supplierSku.trim() || null,
  costPrice: line.costPrice.trim() ? line.costPrice.trim().replace(',', '.') : null,
  costCurrency: line.costCurrency,
})

/**
 * The supplier products dialog.
 * @param props.target - The supplier's name, shown under the title.
 * @param props.products - The catalog's products to pick from (value = the product id, label = its name, detail = its
 *   SKU); also names the listed lines.
 * @param props.load - Loads the supplier's lines (e.g. fetchSupplierProducts), aborted when the dialog closes.
 * @param props.onSave - Saves the whole list and answers the saved lines (e.g. saveSupplierProducts).
 * @param props.onClose - Called when the dialog closes.
 * @param props.onCloseAutoFocus - Passed to DialogContent, so the focus goes back to the row's button.
 * @returns The dialog.
 */
export function SupplierProductsDialog({
  target,
  products,
  load,
  onSave,
  onClose,
  onCloseAutoFocus,
}: {
  target: string
  products: SearchOption[]
  load: (signal: AbortSignal) => Promise<SupplierProduct[]>
  onSave: (lines: SupplierProductInput[]) => Promise<SupplierProduct[]>
  onClose: () => void
  onCloseAutoFocus: (event: Event) => void
}) {
  const { t, locale } = useI18n()
  const s = t.admin.supplierProducts
  const id = useId()
  const toast = useToast()
  const [lines, setLines] = useState<Line[] | null>(null)
  const [loadFailed, setLoadFailed] = useState(false)
  // The refused line's box: its line index, the field and the message.
  const [lineError, setLineError] = useState<{ index: number; field: keyof Line; message: string } | null>(null)
  const [formError, setFormError] = useState('')
  const [pending, setPending] = useState(false)
  // The box to focus once the lines rerender (after a line was added or removed), by its element id.
  const focusNext = useRef<string | null>(null)

  // The latest `load`, so the caller's inline function never reloads the list on a rerender.
  const loader = useRef(load)
  useLayoutEffect(() => {
    loader.current = load
  })
  useEffect(() => {
    const controller = new AbortController()
    loader.current(controller.signal).then(
      (saved) => setLines(saved.map(toLine)),
      () => !controller.signal.aborted && setLoadFailed(true),
    )
    return () => controller.abort()
  }, [])

  useEffect(() => {
    if (!focusNext.current) return
    document.getElementById(focusNext.current)?.focus()
    focusNext.current = null
  })

  const byId = new Map(products.map((option) => [option.value, option]))
  const linked = new Set(lines?.map((line) => line.productId))
  const available = products.filter((option) => !linked.has(option.value))
  const boxId = (productId: string, field: keyof Line) => `${id}-${field}-${productId}`
  const addId = `${id}-add`

  /**
   * Changes one box of a line (and clears that line's error).
   * @param index - The line's position.
   * @param field - The box.
   * @param value - Its new text.
   */
  const handleChange = (index: number, field: keyof Line, value: string) => {
    setLines((current) => current && current.map((line, i) => (i === index ? { ...line, [field]: value } : line)))
    if (lineError?.index === index) setLineError(null)
  }

  /**
   * Adds a picked product as a new line at the end (shekels, no code, no cost) and focuses its first box.
   * @param productId - The picked product's id.
   */
  const handleAdd = (productId: string) => {
    if (!productId || linked.has(productId)) return
    setLines((current) => [...(current ?? []), { productId, supplierSku: '', costPrice: '', costCurrency: 'ILS' }])
    focusNext.current = boxId(productId, 'supplierSku')
  }

  /**
   * Removes a line and moves the focus to the next line's first box (the previous one's at the end; the add field
   * when none is left).
   * @param index - The line's position.
   */
  const handleRemove = (index: number) => {
    if (!lines) return
    const next = lines[index + 1] ?? lines[index - 1]
    setLines(lines.filter((_, i) => i !== index))
    setLineError(null)
    focusNext.current = next ? boxId(next.productId, 'supplierSku') : addId
  }

  /**
   * Checks the costs and saves the whole list; on success shows the saved list and confirms it in a toast. A refused
   * line's box gets the server's error and the focus.
   * @param event - The form's submit event.
   */
  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (pending || !lines) return
    setFormError('')
    const wrong = lines.findIndex((line) => line.costPrice.trim() !== '' && !COST_PATTERN.test(line.costPrice.trim()))
    if (wrong >= 0) {
      setLineError({ index: wrong, field: 'costPrice', message: s.errors.costPrice })
      document.getElementById(boxId(lines[wrong].productId, 'costPrice'))?.focus()
      return
    }
    setLineError(null)
    setPending(true)
    try {
      setLines((await onSave(lines.map(toInput))).map(toLine))
      toast.success(s.saved)
    } catch (error) {
      const api = error instanceof ApiError ? error : undefined
      const field = api?.field as keyof Line | undefined
      if (api?.index !== undefined && field && field !== 'productId' && lines[api.index]) {
        setLineError({ index: api.index, field, message: field === 'costPrice' ? s.errors.costPrice : errorMessage(api.code, t) })
        document.getElementById(boxId(lines[api.index].productId, field))?.focus()
      } else {
        setFormError(errorMessage(api?.code, t))
      }
    } finally {
      setPending(false)
    }
  }

  return (
    <Dialog open onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent closeLabel={t.admin.close} className="max-w-3xl" onCloseAutoFocus={onCloseAutoFocus}>
        <DialogHeader>
          <DialogTitle>{s.title}</DialogTitle>
          <DialogDescription>
            <span className="block font-semibold text-brand-charcoal">{target}</span>
            {s.description}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} noValidate className="flex min-h-0 flex-col">
          <div className="min-h-0 space-y-6 overflow-y-auto px-6 py-5">
            {lines === null ? (
              loadFailed ? (
                <p role="alert" className="text-sm font-medium text-brand-red-dark">
                  {s.loadFailed}
                </p>
              ) : (
                // The lines are on their way: placeholders in the shape of the form below.
                <SkeletonGroup label={s.loading} className="space-y-6">
                  <SkeletonFields count={1} />
                  <Skeleton className="h-28 w-full rounded-2xl" />
                  <Skeleton className="h-28 w-full rounded-2xl" />
                </SkeletonGroup>
              )
            ) : (
              <>
                <div>
                  <label htmlFor={addId} className={LABEL_CLASS}>
                    {s.add}
                  </label>
                  <SearchableField
                    id={addId}
                    label={s.add}
                    value=""
                    strict
                    options={available}
                    onChange={(value) => handleAdd(value)}
                    aria-describedby={`${addId}-hint`}
                    inputClassName={INPUT_CLASS}
                    className="mt-1.5"
                  />
                  <p id={`${addId}-hint`} className="mt-1 text-xs text-brand-charcoal-muted">
                    {s.addHint}
                  </p>
                </div>

                <section aria-labelledby={`${id}-list`}>
                  <h3 id={`${id}-list`} className={LABEL_CLASS}>
                    {s.count.replace('{n}', lines.length.toLocaleString(locale))}
                  </h3>
                  {lines.length === 0 ? (
                    <p className="mt-2 text-sm text-brand-charcoal-muted">{s.none}</p>
                  ) : (
                    <ul className="mt-2 space-y-3">
                      {lines.map((line, index) => {
                        const product = byId.get(line.productId)
                        const name = product?.label ?? line.productId
                        const currencies = COST_CURRENCIES.includes(line.costCurrency) ? COST_CURRENCIES : [...COST_CURRENCIES, line.costCurrency]
                        const errorFor = (field: keyof Line) => (lineError?.index === index && lineError.field === field ? lineError.message : '')
                        const errorId = (field: keyof Line) => `${boxId(line.productId, field)}-error`
                        // A box's error state, and the message under it.
                        const invalidProps = (field: keyof Line) =>
                          errorFor(field) ? { 'aria-invalid': true, 'aria-describedby': errorId(field) } : {}
                        const errorNote = (field: keyof Line) =>
                          errorFor(field) && (
                            <p id={errorId(field)} role="alert" className="mt-1 text-xs font-medium text-brand-red-dark">
                              {errorFor(field)}
                            </p>
                          )
                        return (
                          <li key={line.productId} className="rounded-2xl border border-neutral-200 p-4">
                            <div className="flex items-start justify-between gap-3">
                              <p className="min-w-0 text-sm">
                                <span className="block font-semibold text-brand-charcoal">{name}</span>
                                {product?.detail && <span className="block text-xs text-brand-charcoal-muted" dir="ltr">{product.detail}</span>}
                              </p>
                              <Button type="button" variant="actionDanger" size="action" aria-label={s.removeRow.replace('{name}', name)} onClick={() => handleRemove(index)}>
                                <Trash2 aria-hidden />
                                {s.remove}
                              </Button>
                            </div>
                            <div className="mt-3 grid gap-4 sm:grid-cols-[1fr_10rem_7rem]">
                              {(['supplierSku', 'costPrice'] as const).map((field) => (
                                <div key={field}>
                                  <label htmlFor={boxId(line.productId, field)} className={LABEL_CLASS}>
                                    {s[field]}
                                  </label>
                                  <input
                                    id={boxId(line.productId, field)}
                                    type="text"
                                    dir="ltr"
                                    autoComplete="off"
                                    inputMode={field === 'costPrice' ? 'decimal' : undefined}
                                    value={line[field]}
                                    onChange={(e) => handleChange(index, field, e.target.value)}
                                    {...invalidProps(field)}
                                    className={INPUT_CLASS}
                                  />
                                  {errorNote(field)}
                                </div>
                              ))}
                              <div>
                                <label htmlFor={boxId(line.productId, 'costCurrency')} className={LABEL_CLASS}>
                                  {s.currency}
                                </label>
                                <select
                                  id={boxId(line.productId, 'costCurrency')}
                                  dir="ltr"
                                  value={line.costCurrency}
                                  onChange={(e) => handleChange(index, 'costCurrency', e.target.value)}
                                  {...invalidProps('costCurrency')}
                                  className={INPUT_CLASS}
                                >
                                  {currencies.map((code) => (
                                    <option key={code} value={code}>
                                      {code}
                                    </option>
                                  ))}
                                </select>
                                {errorNote('costCurrency')}
                              </div>
                            </div>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </section>
                {formError && (
                  <p role="alert" className="text-sm font-medium text-brand-red-dark">
                    {formError}
                  </p>
                )}
              </>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" size="sm" onClick={onClose}>
              {t.admin.close}
            </Button>
            {lines !== null && (
              <Button type="submit" size="sm" loading={pending}>
                {s.save}
              </Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/**
 * The "Products" row action of a suppliers table: opens SupplierProductsDialog for the row.
 * @param t - The dictionary.
 * @param handlers.target - The row's name, shown in the dialog.
 * @param handlers.products - The products to pick from (see SupplierProductsDialog).
 * @param handlers.load - Loads the row's lines (e.g. fetchSupplierProducts), aborted when the dialog closes.
 * @param handlers.onSave - Saves the row's whole list and answers the saved lines (e.g. saveSupplierProducts).
 * @returns The row action.
 */
export function supplierProductsAction<Row>(
  t: Dictionary,
  handlers: {
    target: (row: Row) => string
    products: SearchOption[]
    load: (row: Row, signal: AbortSignal) => Promise<SupplierProduct[]>
    onSave: (row: Row, lines: SupplierProductInput[]) => Promise<SupplierProduct[]>
  },
): RowAction<Row> {
  return {
    name: 'products',
    label: t.admin.supplierProducts.button,
    rowLabel: (name) => t.admin.supplierProducts.buttonRow.replace('{name}', name),
    icon: <Package aria-hidden />,
    dialog: (row, props) => (
      <SupplierProductsDialog
        target={handlers.target(row)}
        products={handlers.products}
        load={(signal) => handlers.load(row, signal)}
        onSave={(lines) => handlers.onSave(row, lines)}
        {...props}
      />
    ),
  }
}
