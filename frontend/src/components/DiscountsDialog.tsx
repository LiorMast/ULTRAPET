/**
 * DiscountsDialog.tsx — The discounts of one category or product in the admin panel: a dialog that lists them
 * (each one in words, marked when it has ended or not started yet), and adds, edits and deletes them. Adding and
 * editing open DiscountDialog on top of it.
 *
 * The discounts are general price rules (table price_rules, `businessUserId` null: for every business customer).
 * The dialog knows nothing about storage: the page saves through the staff API and reloads its rows, and the
 * dialog shows the new list. The helpers below connect it to a DataTable page (routes/admin.categories.tsx,
 * routes/admin.products.tsx): withDiscounts attaches each row's rules, DiscountsCell shows them in the table,
 * and discountsAction is the row's "Discounts" button that opens this dialog.
 */
import { useId, useRef, useState } from 'react'
import { Pencil, Percent, Plus, Trash2 } from 'lucide-react'
import { ApiError, type StaffPriceRule } from '@/api'
import type { RowAction } from '@/components/DataTable'
import { DiscountDialog, describeDiscount, israelToday, type DiscountValue } from '@/components/DiscountDialog'
import { errorMessage } from '@/components/RecordDialog'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useI18n, type Locale } from '@/i18n'
import type { Dictionary } from '@/i18n/he'

/** A table row with its general discounts and their words (what the table's search and sorting see). */
export type DiscountRow<Row> = Row & { discounts: StaffPriceRule[]; discountText: string }

/**
 * Reads a price rule as the discount DiscountDialog edits.
 * @param rule - A percent or amount rule.
 * @returns The discount; a rule without a start date gets an empty `startsOn` (in effect since it was made).
 */
export function ruleDiscount(rule: StaffPriceRule): DiscountValue {
  return {
    type: rule.kind === 'amount' ? 'amount' : 'percent',
    value: rule.value,
    minQuantity: rule.minQuantity,
    startsOn: rule.startsOn ?? '',
    endsOn: rule.endsOn,
  }
}

/**
 * The price rule fields of a discount, for the staff API (createStaffRow / updateStaffRow 'price-rules').
 * @param discount - The discount from DiscountDialog.
 * @returns { kind, value, minQuantity, startsOn, endsOn }.
 */
export function discountFields(discount: DiscountValue) {
  return { kind: discount.type, value: discount.value, minQuantity: discount.minQuantity, startsOn: discount.startsOn, endsOn: discount.endsOn }
}

/** Where a rule stands today: in effect, not started yet, past its end date, or switched off (isActive false). */
export type RuleState = 'active' | 'upcoming' | 'ended' | 'paused'

/**
 * Tells where a rule stands on a day (as backend/app/pricing.py applies it: both ends inclusive).
 * @param rule - The rule.
 * @param today - The Israel date ("2026-11-03", see israelToday).
 * @returns "paused" when switched off, else "ended", "upcoming" or "active" by its dates.
 */
export function ruleState(rule: StaffPriceRule, today: string): RuleState {
  if (!rule.isActive) return 'paused'
  if (rule.endsOn !== null && rule.endsOn < today) return 'ended'
  if (rule.startsOn !== null && rule.startsOn > today) return 'upcoming'
  return 'active'
}

/**
 * Words a rule with its state.
 * @param rule - The rule.
 * @param t - The dictionary.
 * @param locale - The page language.
 * @param today - Today's Israel date ("2026-11-03").
 * @returns E.g. "10% off, from 1 Nov 2026 to 30 Nov 2026 (ended)", and whether it no longer applies (ended or paused).
 */
function ruleLabel(rule: StaffPriceRule, t: Dictionary, locale: Locale, today: string): { text: string; ended: boolean } {
  const state = ruleState(rule, today)
  const word = state === 'active' ? '' : t.admin.discounts[state]
  const text = describeDiscount(ruleDiscount(rule), t, locale)
  return { text: word ? `${text} (${word})` : text, ended: state === 'ended' || state === 'paused' }
}

/**
 * Attaches to each row its general discounts.
 * @param rows - The categories or products.
 * @param rules - Every price rule (customers' rules are left out).
 * @param target - Which rule field points at the row: "categoryId" or "productId".
 * @param t - The dictionary.
 * @param locale - The page language.
 * @returns The rows with `discounts` (oldest first) and `discountText`.
 */
export function withDiscounts<Row extends { id: string }>(
  rows: Row[],
  rules: StaffPriceRule[],
  target: 'categoryId' | 'productId',
  t: Dictionary,
  locale: Locale,
): DiscountRow<Row>[] {
  const today = israelToday()
  const byRow = new Map<string, StaffPriceRule[]>()
  for (const rule of rules) {
    const id = rule[target]
    if (rule.businessUserId === null && id !== null) byRow.set(id, [...(byRow.get(id) ?? []), rule])
  }
  return rows.map((row) => {
    const discounts = byRow.get(row.id) ?? []
    return { ...row, discounts, discountText: discounts.map((rule) => ruleLabel(rule, t, locale, today).text).join('; ') }
  })
}

/**
 * The table cell of a row's discounts: one line each, ended ones dimmed.
 * @param props.rules - The row's discounts.
 * @returns The lines, or a dash when there are none.
 */
export function DiscountsCell({ rules }: { rules: StaffPriceRule[] }) {
  const { t, locale } = useI18n()
  if (rules.length === 0) return <span className="text-brand-charcoal-muted">—</span>
  const today = israelToday()
  return (
    <>
      {rules.map((rule) => {
        const { text, ended } = ruleLabel(rule, t, locale, today)
        return (
          <span key={rule.id} className={ended ? 'block text-brand-charcoal-muted' : 'block'}>
            {text}
          </span>
        )
      })}
    </>
  )
}

/**
 * The "Discounts" button of a DataTable row, opening the row's DiscountsDialog.
 * @param t - The dictionary.
 * @param handlers.target - The row's name for people, shown in the dialog.
 * @param handlers.onSave - Saves a discount of the row: creates a rule, or changes `rule`; then reloads the rows.
 * @param handlers.onDelete - Deletes a rule, then reloads the rows.
 * @returns The row action.
 */
export function discountsAction<Row extends { discounts: StaffPriceRule[] }>(
  t: Dictionary,
  handlers: {
    target: (row: Row) => string
    onSave: (row: Row, discount: DiscountValue, rule?: StaffPriceRule) => Promise<unknown>
    onDelete: (rule: StaffPriceRule) => Promise<unknown>
  },
): RowAction<Row> {
  return {
    name: 'discounts',
    label: t.admin.discounts.button,
    rowLabel: (name) => t.admin.discounts.buttonRow.replace('{name}', name),
    icon: <Percent aria-hidden />,
    dialog: (row, props) => (
      <DiscountsDialog
        target={handlers.target(row)}
        rules={row.discounts}
        onSave={(discount, rule) => handlers.onSave(row, discount, rule)}
        onDelete={handlers.onDelete}
        {...props}
      />
    ),
  }
}

/**
 * The discounts dialog of one category or product.
 * @param props.target - What the discounts apply to, shown under the title (e.g. "Dry dog food").
 * @param props.rules - Its discounts.
 * @param props.onSave - Saves a new discount, or the changed `rule`; rejects with ApiError to keep the form open.
 * @param props.onDelete - Deletes a rule; rejects with ApiError to show why.
 * @param props.onClose - Closes the dialog.
 * @param props.onCloseAutoFocus - Where the focus goes after closing (the DataTable row's button).
 * @returns The dialog.
 */
export function DiscountsDialog({
  target,
  rules,
  onSave,
  onDelete,
  onClose,
  onCloseAutoFocus,
}: {
  target: string
  rules: StaffPriceRule[]
  onSave: (discount: DiscountValue, rule?: StaffPriceRule) => Promise<unknown>
  onDelete: (rule: StaffPriceRule) => Promise<unknown>
  onClose: () => void
  onCloseAutoFocus: (event: Event) => void
}) {
  const { t, locale } = useI18n()
  const d = t.admin.discounts
  const id = useId()
  const [editorOpen, setEditorOpen] = useState(false)
  // The rule being edited stays set while the editor fades out, so its title does not change mid-close.
  const [editing, setEditing] = useState<StaffPriceRule | undefined>()
  const [confirming, setConfirming] = useState<string | null>(null)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  const addButton = useRef<HTMLButtonElement>(null)
  const today = israelToday()

  /**
   * Opens the discount form.
   * @param rule - The rule to edit; omit to add one.
   */
  const openEditor = (rule?: StaffPriceRule) => {
    setEditing(rule)
    setConfirming(null)
    setError('')
    setEditorOpen(true)
  }

  /**
   * Puts the focus back on the button that opened the discount form: the rule's Edit, or "Add discount".
   * @param event - Radix's close-autofocus event; its default (focus a DialogTrigger, which we do not use) is replaced.
   */
  const handleEditorCloseFocus = (event: Event) => {
    event.preventDefault()
    ;(editing ? document.getElementById(`${id}-edit-${editing.id}`) : addButton.current)?.focus()
  }

  /**
   * Deletes a rule after the inline confirmation; on success the focus moves to "Add discount" (the row is gone).
   * @param rule - The rule.
   */
  const handleDelete = async (rule: StaffPriceRule) => {
    setPending(true)
    setError('')
    try {
      await onDelete(rule)
      setConfirming(null)
      setStatus(d.deleted)
      addButton.current?.focus()
    } catch (caught) {
      setError(errorMessage(caught instanceof ApiError ? caught.code : undefined, t))
    } finally {
      setPending(false)
    }
  }

  /**
   * Leaves the inline confirmation and puts the focus back on the rule's Delete button.
   * @param rule - The rule.
   */
  const cancelDelete = (rule: StaffPriceRule) => {
    setConfirming(null)
    requestAnimationFrame(() => document.getElementById(`${id}-delete-${rule.id}`)?.focus())
  }

  return (
    <Dialog open onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent closeLabel={t.admin.close} onCloseAutoFocus={onCloseAutoFocus}>
        <DialogHeader>
          <DialogTitle>{d.title}</DialogTitle>
          <DialogDescription>
            <span className="block font-semibold text-brand-charcoal">{target}</span>
            {d.description}
          </DialogDescription>
        </DialogHeader>
        <div className="min-h-0 space-y-3 overflow-y-auto px-6 py-5">
          {rules.length === 0 ? (
            <p className="text-sm text-brand-charcoal-muted">{d.none}</p>
          ) : (
            <ul className="divide-y divide-neutral-150 border-y border-neutral-150">
              {rules.map((rule) => {
                const { text, ended } = ruleLabel(rule, t, locale, today)
                return (
                  <li key={rule.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-3">
                    <span className={ended ? 'text-sm text-brand-charcoal-muted' : 'text-sm text-brand-charcoal'}>{text}</span>
                    {confirming === rule.id ? (
                      <span className="flex items-center gap-2">
                        <span id={`${id}-confirm`} className="text-sm font-semibold text-brand-charcoal">
                          {d.confirm}
                        </span>
                        <Button size="xs" autoFocus disabled={pending} aria-describedby={`${id}-confirm`} onClick={() => handleDelete(rule)}>
                          {t.admin.delete}
                        </Button>
                        <Button size="xs" variant="outline" onClick={() => cancelDelete(rule)}>
                          {t.admin.cancel}
                        </Button>
                      </span>
                    ) : (
                      <span className="flex gap-1">
                        <Button id={`${id}-edit-${rule.id}`} variant="ghost" size="xs" aria-label={d.editRule.replace('{discount}', text)} onClick={() => openEditor(rule)}>
                          <Pencil aria-hidden />
                          {t.admin.edit}
                        </Button>
                        <Button
                          id={`${id}-delete-${rule.id}`}
                          variant="ghost"
                          size="xs"
                          aria-label={d.deleteRule.replace('{discount}', text)}
                          onClick={() => {
                            setError('')
                            setConfirming(rule.id)
                          }}
                        >
                          <Trash2 aria-hidden />
                          {t.admin.delete}
                        </Button>
                      </span>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
          {error && (
            <p role="alert" className="text-sm font-medium text-brand-red-dark">
              {error}
            </p>
          )}
          <p role="status" className="min-h-5 text-sm text-brand-charcoal-muted">
            {status}
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>
            {t.admin.close}
          </Button>
          <Button ref={addButton} size="sm" onClick={() => openEditor()}>
            <Plus aria-hidden />
            {d.add}
          </Button>
        </DialogFooter>
        <DiscountDialog
          open={editorOpen}
          onOpenChange={setEditorOpen}
          initial={editing && ruleDiscount(editing)}
          target={target}
          onCloseAutoFocus={handleEditorCloseFocus}
          onSave={async (discount) => {
            await onSave(discount, editing)
            setStatus(d.saved)
          }}
        />
      </DialogContent>
    </Dialog>
  )
}
