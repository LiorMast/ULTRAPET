/**
 * DiscountsDialog.tsx — The discounts of one category, product or business customer in the admin panel: a dialog
 * that lists them (each one in words, marked when it has ended or not started yet), and adds, edits and deletes
 * them. Adding and editing open DiscountDialog on top of it.
 *
 * A category's or product's discounts are its general price rules (table price_rules, `businessUserId` null: for
 * every business customer). A customer's are that customer's own rules on every product or any category or product: the dialog then
 * gets `scope` (DiscountDialog asks what each one applies to) and `describeTarget` (each line names its category or
 * product). A customer's fixed price is listed and can be deleted, not edited (DiscountDialog edits discounts only).
 * The dialog knows nothing about storage: the page saves through the staff API and reloads its rows, and the
 * dialog shows the new list. The helpers below connect it to a DataTable page (routes/admin.categories.tsx,
 * routes/admin.products.tsx, routes/admin.customers.tsx): withDiscounts attaches each row's rules, DiscountsCell
 * shows them in the table, and discountsAction is the row's "Discounts" button that opens this dialog.
 */
import { useId, useRef, useState } from 'react'
import { Pencil, Percent, Plus, Trash2 } from 'lucide-react'
import { ApiError, type StaffPriceRule } from '@/api'
import type { RowAction } from '@/components/DataTable'
import { ALL_PRODUCTS, DiscountDialog, describeDiscount, formatValue, israelNow, israelTime, scopeTarget, type DiscountValue, type RuleScope } from '@/components/DiscountDialog'
import { errorMessage } from '@/components/RecordDialog'
import { useToast } from '@/toast'
import type { SearchOption } from '@/components/SearchableField'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useI18n, type Locale } from '@/i18n'
import type { Dictionary } from '@/i18n/he'

/** A table row with its discounts and their words (what the table's search and sorting see). */
export type DiscountRow<Row> = Row & { discounts: StaffPriceRule[]; discountText: string }

/** Names what a rule applies to, for the lines of a customer's discounts (e.g. "Category: Dry dog food"). */
export type DescribeTarget = (rule: StaffPriceRule) => string

/**
 * Reads a price rule as the discount DiscountDialog edits.
 * @param rule - A percent or amount rule.
 * @returns The discount, its period as Israel times; a rule without a start gets an empty `startsAt` (in effect since
 *   it was made).
 */
export function ruleDiscount(rule: StaffPriceRule): DiscountValue {
  return {
    type: rule.kind === 'amount' ? 'amount' : 'percent',
    value: rule.value,
    minQuantity: rule.minQuantity,
    startsAt: rule.startsAt === null ? '' : israelTime(rule.startsAt),
    endsAt: rule.endsAt === null ? null : israelTime(rule.endsAt),
  }
}

/**
 * What a rule applies to, as DiscountDialog's scope fields read it.
 * @param rule - The rule.
 * @returns Its category or product (ALL_PRODUCTS when it has neither) and its customer.
 */
export function ruleScope(rule: StaffPriceRule): RuleScope {
  const target =
    rule.categoryId !== null ? scopeTarget('category', rule.categoryId) : rule.productId !== null ? scopeTarget('product', rule.productId) : ALL_PRODUCTS
  return { target, customerId: rule.businessUserId }
}

/**
 * The price rule fields of a discount, for the staff API (createStaffRow / updateStaffRow 'price-rules').
 * @param discount - The discount from DiscountDialog.
 * @returns { kind, value, minQuantity, startsAt, endsAt } (Israel times, without a UTC offset: the server reads them as
 *   Israel time); an empty start (a rule in effect since it was made,
 *   ended with "End discount now") is sent as null.
 */
export function discountFields(discount: DiscountValue) {
  return { kind: discount.type, value: discount.value, minQuantity: discount.minQuantity, startsAt: discount.startsAt || null, endsAt: discount.endsAt }
}

/** Where a rule stands now: in effect, not started yet, past its end, or switched off (isActive false). */
export type RuleState = 'active' | 'upcoming' | 'ended' | 'paused'

/**
 * Tells where a rule stands on a day (as backend/app/pricing.py applies it: both ends inclusive).
 * @param rule - The rule.
 * @param now - The current Israel time ("2026-11-03T14:32:07", see israelNow).
 * @returns "paused" when switched off, else "ended", "upcoming" or "active" by its dates.
 */
export function ruleState(rule: StaffPriceRule, now: string): RuleState {
  if (!rule.isActive) return 'paused'
  // The end is exclusive: a rule that ends now has ended.
  if (rule.endsAt !== null && israelTime(rule.endsAt) <= now) return 'ended'
  if (rule.startsAt !== null && israelTime(rule.startsAt) > now) return 'upcoming'
  return 'active'
}

/**
 * Words a rule with its state.
 * @param rule - The rule.
 * @param t - The dictionary.
 * @param locale - The page language.
 * @param now - The current Israel time (see israelNow).
 * @param describeTarget - Names what the rule applies to, put first (a customer's discounts); omit for one target.
 * @returns E.g. "10% off, from 1 Nov 2026 to 30 Nov 2026 (ended)" (a fixed price: "Fixed price ₪80.00"), and whether
 *   it no longer applies (ended or paused).
 */
function ruleLabel(rule: StaffPriceRule, t: Dictionary, locale: Locale, now: string, describeTarget?: DescribeTarget): { text: string; ended: boolean } {
  const state = ruleState(rule, now)
  const word = state === 'active' ? '' : t.admin.discounts[state]
  const words =
    rule.kind === 'fixed_price'
      ? t.admin.discountFields.fixedPrice.replace('{value}', formatValue('amount', rule.value, locale))
      : describeDiscount(ruleDiscount(rule), t, locale)
  const text = describeTarget ? `${describeTarget(rule)}: ${words}` : words
  return { text: word ? `${text} (${word})` : text, ended: state === 'ended' || state === 'paused' }
}

/**
 * Attaches to each row its discounts.
 * @param rows - The categories, products or business customers.
 * @param rules - Every price rule.
 * @param target - Which rule field points at the row: "categoryId" or "productId" (the general rules only: customers'
 *   rules are left out), or "businessUserId" (the customer's own rules).
 * @param t - The dictionary.
 * @param locale - The page language.
 * @param describeTarget - Names what each rule applies to, in the words (a customer's discounts).
 * @returns The rows with `discounts` (oldest first) and `discountText`.
 */
export function withDiscounts<Row extends { id: string }>(
  rows: Row[],
  rules: StaffPriceRule[],
  target: 'categoryId' | 'productId' | 'businessUserId',
  t: Dictionary,
  locale: Locale,
  describeTarget?: DescribeTarget,
): DiscountRow<Row>[] {
  const now = israelNow()
  const byRow = new Map<string, StaffPriceRule[]>()
  for (const rule of rules) {
    const id = rule[target]
    if (id !== null && (target === 'businessUserId' || rule.businessUserId === null)) byRow.set(id, [...(byRow.get(id) ?? []), rule])
  }
  return rows.map((row) => {
    const discounts = byRow.get(row.id) ?? []
    return { ...row, discounts, discountText: discounts.map((rule) => ruleLabel(rule, t, locale, now, describeTarget).text).join('; ') }
  })
}

/**
 * The table cell of a row's discounts: one line each, ended ones dimmed.
 * @param props.rules - The row's discounts.
 * @param props.describeTarget - Names what each rule applies to, first on its line (a customer's discounts).
 * @returns The lines, or a dash when there are none.
 */
export function DiscountsCell({ rules, describeTarget }: { rules: StaffPriceRule[]; describeTarget?: DescribeTarget }) {
  const { t, locale } = useI18n()
  if (rules.length === 0) return <span className="text-brand-charcoal-muted">—</span>
  const now = israelNow()
  return (
    <>
      {rules.map((rule) => {
        const { text, ended } = ruleLabel(rule, t, locale, now, describeTarget)
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
 * @param handlers.onSave - Saves a discount of the row: creates a rule, or changes `rule` (with `scope`, also what it
 *   applies to); then reloads the rows.
 * @param handlers.onDelete - Deletes a rule, then reloads the rows.
 * @param handlers.targets - The category and product choices, when each discount picks its own (a customer's).
 * @param handlers.describeTarget - Names what each rule applies to (with `targets`).
 * @param handlers.description - The dialog's text under the row name; default: the general discounts' text.
 * @returns The row action.
 */
export function discountsAction<Row extends { discounts: StaffPriceRule[] }>(
  t: Dictionary,
  handlers: {
    target: (row: Row) => string
    onSave: (row: Row, discount: DiscountValue, rule?: StaffPriceRule, scope?: RuleScope) => Promise<unknown>
    onDelete: (rule: StaffPriceRule) => Promise<unknown>
    targets?: SearchOption[]
    describeTarget?: DescribeTarget
    description?: string
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
        onSave={(discount, rule, scope) => handlers.onSave(row, discount, rule, scope)}
        onDelete={handlers.onDelete}
        targets={handlers.targets}
        describeTarget={handlers.describeTarget}
        description={handlers.description}
        {...props}
      />
    ),
  }
}

/**
 * The discounts dialog of one category, product or customer.
 * @param props.target - Whose discounts they are, shown under the title (e.g. "Dry dog food", "Demo Pet Shop").
 * @param props.rules - Its discounts.
 * @param props.onSave - Saves a new discount, or the changed `rule` (with `targets`, also the chosen RuleScope);
 *   rejects with ApiError to keep the form open.
 * @param props.onDelete - Deletes a rule; rejects with ApiError to show why.
 * @param props.targets - The category and product choices: each discount then picks what it applies to.
 * @param props.describeTarget - Names what each rule applies to, first on its line.
 * @param props.description - The text under the target; default: the general discounts' text.
 * @param props.onClose - Closes the dialog.
 * @param props.onCloseAutoFocus - Where the focus goes after closing (the DataTable row's button).
 * @returns The dialog.
 */
export function DiscountsDialog({
  target,
  rules,
  onSave,
  onDelete,
  targets,
  describeTarget,
  description,
  onClose,
  onCloseAutoFocus,
}: {
  target: string
  rules: StaffPriceRule[]
  onSave: (discount: DiscountValue, rule?: StaffPriceRule, scope?: RuleScope) => Promise<unknown>
  onDelete: (rule: StaffPriceRule) => Promise<unknown>
  targets?: SearchOption[]
  describeTarget?: DescribeTarget
  description?: string
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
  const toast = useToast()
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  const addButton = useRef<HTMLButtonElement>(null)
  const now = israelNow()

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
      toast.success(d.deleted)
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
            {description ?? d.description}
          </DialogDescription>
        </DialogHeader>
        <div className="min-h-0 space-y-3 overflow-y-auto px-6 py-5">
          {rules.length === 0 ? (
            <p className="text-sm text-brand-charcoal-muted">{d.none}</p>
          ) : (
            <ul className="divide-y divide-neutral-150 border-y border-neutral-150">
              {rules.map((rule) => {
                const { text, ended } = ruleLabel(rule, t, locale, now, describeTarget)
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
                        {/* A fixed price is not a discount DiscountDialog edits: it can only be deleted here. */}
                        {rule.kind !== 'fixed_price' && (
                          <Button id={`${id}-edit-${rule.id}`} variant="ghost" size="xs" aria-label={d.editRule.replace('{discount}', text)} onClick={() => openEditor(rule)}>
                            <Pencil aria-hidden />
                            {t.admin.edit}
                          </Button>
                        )}
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
          scope={targets && { targets, initial: editing && ruleScope(editing) }}
          onCloseAutoFocus={handleEditorCloseFocus}
          onSave={async (discount, scope) => {
            await onSave(discount, editing, scope)
            toast.success(d.saved)
          }}
        />
      </DialogContent>
    </Dialog>
  )
}
