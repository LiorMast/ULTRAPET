/**
 * ProductManager.tsx — The staff's manage mode on the customer views: the product management of /admin/products,
 * spread over the pages customers see, so staff manage a product where they look at it. Only a signed-in staff member
 * sees any of it (useManage in auth.tsx), and only after turning the "Manage mode" switch on; off, staff see exactly
 * what customers see.
 *
 *  - ProductManageBar: the switch (with what it does), and in manage mode the catalog-wide actions: the stock alerts
 *    (StockSummary), "Change order" (ReorderDialog of every product), "PDF catalog" (CatalogPdfButton) and "Add
 *    product" (RecordDialog). The catalog shows it whole; a product or brand page shows the switch only (`actions`).
 *  - ProductManageStrip: one product's staff information and actions. On a catalog card (`size="card"`, in place of
 *    the price and the cart button) and on the product page (`size="lg"`, a panel in place of the price block): the
 *    list price, SKU, stock (StockCell), active discounts, an "Active" switch (shown to customers or hidden), and
 *    Edit (RecordDialog: every field of the admin form, photos included), Stock (StockDialog), Discounts
 *    (DiscountsDialog) and Delete (DeleteDialog). On a card the actions are icon buttons with tooltips; on the page
 *    they carry their labels.
 *
 * Everything here is what /admin/products does, with the same parts: the columns and every save come from
 * productColumns.tsx (useProductHandlers: the staff API, then a reload of the page and of the staff rows, manage.ts),
 * so the two managers cannot drift apart. The data (ProductAdmin) comes from the page's loader (loadProductAdmin).
 * This module is loaded lazily (ManageBar / ManageStrip in manage.ts), so customers never download it.
 */
import { useId, useRef, useState, type ReactNode } from 'react'
import { ArrowUpDown, Boxes, Pencil, Percent, Plus, Trash2 } from 'lucide-react'
import { cva } from 'class-variance-authority'
import { cn } from 'cn'
import { ApiError, fetchCatalogPdf, generateCatalogPdf } from '@/api'
import { useManage } from '@/auth'
import { formatPrice } from '@/components/CatalogCard'
import { CatalogPdfButton } from '@/components/CatalogPdfDialog'
import type { RowValues } from '@/components/DataTable'
import { israelNow } from '@/components/DiscountDialog'
import { DiscountsDialog, ruleState } from '@/components/DiscountsDialog'
import { newProductRow, productColumns, useProductHandlers, type ProductRow } from '@/components/productColumns'
import { DeleteDialog, RecordDialog, errorMessage } from '@/components/RecordDialog'
import { ReorderDialog } from '@/components/ReorderDialog'
import { StockCell, StockDialog, StockSummary } from '@/components/StockDialog'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { localized } from '@/config'
import { useI18n } from '@/i18n'
import type { ProductAdmin } from '@/manage'
import { useToast } from '@/toast'

/** The dialog a manager has open: one of a product's actions, or one of the bar's. */
type OpenDialog = 'edit' | 'stock' | 'discounts' | 'delete' | 'add' | 'reorder' | null

/**
 * Puts the focus back on the button that opened a dialog when it closes (Radix would look for a DialogTrigger, which
 * these dialogs do not use); when that button is gone (its product was deleted), on the page's <main>.
 * Call it from the dialog's onCloseAutoFocus.
 * @param event - Radix's close-autofocus event; its default is replaced.
 * @param button - The button that opened the dialog.
 */
function focusBack(event: Event, button: HTMLElement | null | undefined) {
  event.preventDefault()
  requestAnimationFrame(() => (button?.isConnected ? button : document.getElementById('main'))?.focus())
}

/**
 * The manage mode bar: the "Manage mode" switch and, while it is on, the catalog-wide actions. Renders nothing unless a
 * staff member is signed in.
 * @param props.admin - The staff data (the page loader's loadProductAdmin); null until manage mode is on.
 * @param props.actions - Show the catalog-wide actions in manage mode (the catalog); false = the switch only (a
 *   product or brand page). Default true.
 * @param props.className - Extra classes on the bar.
 * @returns The bar (a labelled region), or null.
 */
export function ProductManageBar({ admin, actions = true, className }: { admin: ProductAdmin | null; actions?: boolean; className?: string }) {
  const { t, locale } = useI18n()
  const m = t.manage
  const id = useId()
  const toast = useToast()
  const handlers = useProductHandlers()
  const { available, on, setOn } = useManage()
  const [open, setOpen] = useState<OpenDialog>(null)
  const addButton = useRef<HTMLButtonElement>(null)
  const reorderButton = useRef<HTMLButtonElement>(null)
  if (!available) return null
  const showActions = on && actions && admin !== null

  return (
    <section aria-label={m.label} className={cn('flex flex-wrap items-center gap-x-6 gap-y-3 rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 sm:px-6', className)}>
      <div className="flex items-center gap-3">
        <Switch id={`${id}-switch`} checked={on} onCheckedChange={setOn} aria-describedby={`${id}-hint`} />
        <label htmlFor={`${id}-switch`} className="cursor-pointer font-heading text-sm font-semibold text-brand-charcoal">
          {m.switchLabel}
        </label>
      </div>
      <p id={`${id}-hint`} className="min-w-0 flex-1 basis-64 text-xs text-brand-charcoal-muted">
        {m.hint}
      </p>
      {showActions && (
        <>
          <StockSummary products={admin.products} className="w-full" />
          <div className="flex w-full flex-wrap gap-2">
            {admin.products.length > 1 && (
              <Button ref={reorderButton} size="sm" variant="outline" onClick={() => setOpen('reorder')}>
                <ArrowUpDown aria-hidden />
                {t.admin.reorder.button}
              </Button>
            )}
            <CatalogPdfButton load={fetchCatalogPdf} onGenerate={generateCatalogPdf} />
            <Button ref={addButton} size="sm" onClick={() => setOpen('add')}>
              <Plus aria-hidden />
              {m.addProduct}
            </Button>
          </div>
        </>
      )}

      {open === 'add' && admin && (
        <RecordDialog
          columns={productColumns(t, locale, admin.categories, admin.brands)}
          initial={newProductRow(admin.categories)}
          title={m.addTitle}
          onSave={async (values) => {
            await handlers.create(values)
            toast.success(t.admin.created)
            setOpen(null)
          }}
          onClose={() => setOpen(null)}
          onCloseAutoFocus={(event) => focusBack(event, addButton.current)}
        />
      )}
      {open === 'reorder' && admin && (
        <ReorderDialog
          items={admin.products.map((row) => ({ id: row.id, label: localized(row.name, locale) }))}
          title={t.admin.reorder.title}
          description={t.admin.reorder.description}
          onSave={async (ids) => {
            await handlers.reorder(ids)
            toast.success(t.admin.reorder.saved)
            setOpen(null)
          }}
          onClose={() => setOpen(null)}
          onCloseAutoFocus={(event) => focusBack(event, reorderButton.current)}
        />
      )}
    </section>
  )
}

const stripVariants = cva('relative z-10 flex flex-col text-brand-charcoal', {
  variants: {
    size: {
      card: 'gap-3 text-xs',
      lg: 'gap-5 rounded-2xl border border-neutral-200 bg-neutral-50 p-5 text-sm sm:p-6',
    },
  },
  defaultVariants: { size: 'card' },
})

/**
 * One action of a product: an icon button with a tooltip on a card, a labelled button on the product page. Either way
 * its accessible name is the action and the product ("Edit Paw Adult 12 kg"), which contains the visible label.
 * @param props.icon - The lucide icon (decorative).
 * @param props.label - The action's short label ("Edit").
 * @param props.name - The accessible name (the label with the product's name).
 * @param props.compact - true = icon only, with a tooltip (a card).
 * @param props.danger - The destructive look (Delete).
 * @param props.buttonRef - Receives the button, so the dialog can put the focus back on it.
 * @param props.onClick - Opens the action's dialog.
 * @returns The button.
 */
function ActionButton({
  icon,
  label,
  name,
  compact,
  danger,
  buttonRef,
  onClick,
}: {
  icon: ReactNode
  label: string
  name: string
  compact: boolean
  danger?: boolean
  buttonRef: (button: HTMLButtonElement | null) => void
  onClick: () => void
}) {
  const variant = danger ? 'actionDanger' : 'action'
  if (!compact) {
    return (
      <Button ref={buttonRef} variant={variant} size="action" aria-label={name} onClick={onClick}>
        {icon}
        {label}
      </Button>
    )
  }
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button ref={buttonRef} variant={variant} size="icon-sm" aria-label={name} onClick={onClick}>
          {icon}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}

/**
 * One product's staff information and actions (see the file header).
 * @param props.row - The product's staff row with its discounts (ProductAdmin.bySlug).
 * @param props.admin - The staff data (the edit form's category and brand choices).
 * @param props.size - `card` (a catalog card: compact, icon actions; default) or `lg` (the product page's panel).
 * @param props.onDeleted - Called after the product was deleted, instead of reloading the page (the product page
 *   leaves for the catalog); omit to reload (a card disappears from its list).
 * @param props.className - Extra classes.
 * @returns The strip.
 */
export function ProductManageStrip({
  row,
  admin,
  size = 'card',
  onDeleted,
  className,
}: {
  row: ProductRow
  admin: ProductAdmin
  size?: 'card' | 'lg'
  onDeleted?: () => void
  className?: string
}) {
  const { t, locale } = useI18n()
  const m = t.manage
  const f = t.admin.productFields
  const id = useId()
  const toast = useToast()
  const handlers = useProductHandlers()
  const [open, setOpen] = useState<OpenDialog>(null)
  // The switch shows the new state at once while the server saves it.
  const [activeDraft, setActiveDraft] = useState<boolean | null>(null)
  const buttons = useRef<Partial<Record<NonNullable<OpenDialog>, HTMLButtonElement | null>>>({})
  const name = localized(row.name, locale)
  const compact = size === 'card'
  const now = israelNow()
  const activeDiscounts = row.discounts.filter((rule) => ruleState(rule, now) === 'active').length

  /**
   * Puts the focus back on the button of the dialog that closes.
   * @param event - Radix's close-autofocus event.
   */
  const closeFocus = (event: Event) => focusBack(event, open ? buttons.current[open] : null)

  /**
   * Shows the product to customers or hides it (its `isActive`), and confirms it in a toast.
   * @param active - The new state.
   */
  const handleActive = async (active: boolean) => {
    if (activeDraft !== null) return
    setActiveDraft(active)
    try {
      await handlers.update(row.id, { isActive: active })
      toast.success(active ? m.shown : m.hiddenSaved)
    } catch (error) {
      toast.error(errorMessage(error instanceof ApiError ? error.code : undefined, t))
    } finally {
      setActiveDraft(null)
    }
  }

  /**
   * Saves the edit form's changed fields (nothing changed = nothing sent), then closes it.
   * @param changes - The changed fields.
   */
  const handleSave = async (changes: RowValues) => {
    if (Object.keys(changes).length > 0) await handlers.update(row.id, changes)
    toast.success(t.admin.saved)
    setOpen(null)
  }

  /** Deletes the product after the confirmation, then reloads the page or hands over to onDeleted. */
  const handleDelete = async () => {
    await handlers.remove(row.id, { reload: !onDeleted })
    toast.success(t.admin.deleted)
    setOpen(null)
    onDeleted?.()
  }

  /**
   * The ref callback of an action's button.
   * @param dialog - The action.
   * @returns The callback.
   */
  const buttonRef = (dialog: NonNullable<OpenDialog>) => (button: HTMLButtonElement | null) => {
    buttons.current[dialog] = button
  }

  const details = [
    { label: f.listPrice, value: row.listPrice !== null ? <span className="font-semibold tabular-nums">{formatPrice(locale, row.listPrice)}</span> : <span className="text-brand-charcoal-muted">{m.noListPrice}</span> },
    row.sku && { label: f.sku, value: <span dir="ltr" className="font-semibold">{row.sku}</span> },
    { label: f.stock, value: <StockCell quantity={row.stockQuantity} threshold={row.lowStockThreshold} /> },
    { label: f.discounts, value: activeDiscounts > 0 ? <span className="font-semibold">{m.activeCount.replace('{n}', activeDiscounts.toLocaleString(locale))}</span> : <span className="text-brand-charcoal-muted">—</span> },
  ].filter((detail) => !!detail)

  return (
    <div className={cn(stripVariants({ size }), className)}>
      {!compact && (
        <div>
          <p className="font-heading text-base font-semibold">{m.label}</p>
          <p className="mt-1 text-xs text-brand-charcoal-muted">{m.staffOnly}</p>
        </div>
      )}
      <dl className={cn('grid grid-cols-[auto_1fr] items-center gap-x-3', compact ? 'gap-y-1.5' : 'gap-y-2 sm:grid-cols-[auto_1fr_auto_1fr]')}>
        {details.map((detail) => (
          <div key={detail.label} className="contents">
            <dt className="text-brand-charcoal-muted">{detail.label}</dt>
            <dd className="min-w-0">{detail.value}</dd>
          </div>
        ))}
      </dl>
      <div className="flex items-center gap-3">
        <Switch
          id={`${id}-active`}
          checked={activeDraft ?? row.isActive}
          onCheckedChange={handleActive}
          aria-label={m.activeRow.replace('{name}', name)}
          aria-busy={activeDraft !== null || undefined}
        />
        <label htmlFor={`${id}-active`} className="cursor-pointer font-medium">
          {f.isActive}
        </label>
      </div>
      <div className="flex flex-wrap gap-1.5">
        <ActionButton icon={<Pencil aria-hidden />} label={t.admin.edit} name={t.admin.editRow.replace('{name}', name)} compact={compact} buttonRef={buttonRef('edit')} onClick={() => setOpen('edit')} />
        <ActionButton icon={<Boxes aria-hidden />} label={t.admin.stock.button} name={t.admin.stock.buttonRow.replace('{name}', name)} compact={compact} buttonRef={buttonRef('stock')} onClick={() => setOpen('stock')} />
        <ActionButton icon={<Percent aria-hidden />} label={t.admin.discounts.button} name={t.admin.discounts.buttonRow.replace('{name}', name)} compact={compact} buttonRef={buttonRef('discounts')} onClick={() => setOpen('discounts')} />
        <ActionButton icon={<Trash2 aria-hidden />} label={t.admin.delete} name={t.admin.deleteRow.replace('{name}', name)} compact={compact} danger buttonRef={buttonRef('delete')} onClick={() => setOpen('delete')} />
      </div>

      {open === 'edit' && (
        <RecordDialog
          columns={productColumns(t, locale, admin.categories, admin.brands)}
          row={row as unknown as RowValues}
          title={t.admin.editTitle.replace('{name}', name)}
          onSave={handleSave}
          onClose={() => setOpen(null)}
          onCloseAutoFocus={closeFocus}
        />
      )}
      {open === 'stock' && (
        <StockDialog
          target={name}
          load={(signal) => handlers.loadStock(row.id, signal)}
          onSave={(movement) => handlers.recordStock(row.id, movement)}
          onClose={() => setOpen(null)}
          onCloseAutoFocus={closeFocus}
        />
      )}
      {open === 'discounts' && (
        <DiscountsDialog
          target={name}
          rules={row.discounts}
          onSave={(discount, rule) => handlers.saveDiscount(row.id, discount, rule)}
          onDelete={handlers.deleteDiscount}
          onClose={() => setOpen(null)}
          onCloseAutoFocus={closeFocus}
        />
      )}
      {open === 'delete' && <DeleteDialog name={name} onConfirm={handleDelete} onClose={() => setOpen(null)} onCloseAutoFocus={closeFocus} />}
    </div>
  )
}
