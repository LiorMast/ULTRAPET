/**
 * DiscountDialog.test.tsx — Tests for the discount dialog: the defaults (percentage, from today, no end date),
 * the percent/amount switch, an amount for a dated period, a bulk discount and its minimum quantity check, the field
 * checks (empty, zero, negative, not a number, over 100%, end before start, missing end), editing an existing
 * discount (regular and bulk), "End discount now" (ends yesterday; only on a discount that has not ended), the
 * server's refusal keeping the dialog open, and the Hebrew texts.
 */
import { useState } from 'react'
import { screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/api'
import { DiscountDialog, israelNow, israelToday, type DiscountValue } from '@/components/DiscountDialog'
import type { Locale } from '@/i18n'
import { renderComponent } from '@/test/utils'

/**
 * Renders the dialog open, the way an admin page would use it (it closes itself after a save).
 * @param options.onSave - The save handler; resolves by default.
 * @param options.initial - The discount to edit, if any.
 * @param options.locale - The page language; English by default.
 * @returns The render result with `user`, once the dialog is on screen.
 */
async function renderDialog({ onSave = vi.fn(async () => {}), initial, locale = 'en' }: { onSave?: (discount: DiscountValue) => Promise<unknown>; initial?: DiscountValue; locale?: Locale } = {}) {
  /**
   * The test page: the dialog, open until it closes itself.
   * @returns The dialog.
   */
  function Harness() {
    const [open, setOpen] = useState(true)
    return <DiscountDialog open={open} onOpenChange={setOpen} onSave={onSave} initial={initial} target="Dry dog food" />
  }
  const result = renderComponent(<Harness />, locale)
  await screen.findByRole('dialog')
  return result
}

/**
 * Shifts today's Israel date by some days.
 * @param days - Days to add (negative = earlier).
 * @returns The date, e.g. "2026-11-03".
 */
function dayFromToday(days: number): string {
  const date = new Date(`${israelToday()}T12:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

/** The dialog's value input. */
const valueInput = () => screen.getByLabelText('Value *')

describe('DiscountDialog', () => {
  it('starts as a percentage from today with no end date', async () => {
    await renderDialog()
    const dialog = await screen.findByRole('dialog', { name: 'New discount' })
    expect(dialog).toHaveAccessibleDescription(/Dry dog food/)
    expect(within(dialog).getByRole('radio', { name: 'Percentage (%)' })).toBeChecked()
    expect(within(dialog).getByLabelText('Start date *')).toHaveValue(israelToday())
    expect(within(dialog).getByRole('checkbox', { name: 'No end date' })).toBeChecked()
    expect(within(dialog).getByLabelText('End date')).toBeDisabled()
  })

  it('saves a percentage discount with no end date and closes', async () => {
    const onSave = vi.fn(async () => {})
    const { user } = await renderDialog({ onSave })
    await user.type(valueInput(), '12.5')
    expect(screen.getByText(/^\u206612\.5%\u2069 off, from .+, with no end date$/)).toHaveAttribute('role', 'status')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(onSave).toHaveBeenCalledWith({ type: 'percent', value: 12.5, minQuantity: null, startsAt: `${israelToday()}T00:00:00`, endsAt: null })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('saves an amount for a set period', async () => {
    const onSave = vi.fn(async () => {})
    const { user } = await renderDialog({ onSave })
    await user.click(screen.getByRole('radio', { name: 'Amount (₪)' }))
    expect(valueInput()).toHaveAccessibleDescription(/In shekels before VAT/)
    await user.type(valueInput(), '20')
    await user.clear(screen.getByLabelText('Start date *'))
    await user.type(screen.getByLabelText('Start date *'), '2026-12-01')
    await user.click(screen.getByRole('checkbox', { name: 'No end date' }))
    await user.type(screen.getByLabelText('End date'), '2026-12-31')
    expect(screen.getByText(/^\u2066₪20\.00\u2069 off, from Dec 1, 2026 to Dec 31, 2026$/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(onSave).toHaveBeenCalledWith({ type: 'amount', value: 20, minQuantity: null, startsAt: '2026-12-01T00:00:00', endsAt: '2026-12-31T23:59:00' })
  })

  it('saves a bulk discount with its minimum quantity', async () => {
    const onSave = vi.fn(async () => {})
    const { user } = await renderDialog({ onSave })
    expect(screen.getByRole('checkbox', { name: 'Bulk discount' })).not.toBeChecked()
    expect(screen.queryByLabelText('Minimum quantity *')).not.toBeInTheDocument()
    await user.type(valueInput(), '5')
    await user.click(screen.getByRole('checkbox', { name: 'Bulk discount' }))
    const quantity = screen.getByLabelText('Minimum quantity *')
    expect(quantity).toHaveAccessibleDescription(/at least this many units/)
    await user.type(quantity, '10')
    expect(screen.getByText(/^\u20665%\u2069 off for \u206610\u2069 units or more, from .+, with no end date$/)).toHaveAttribute('role', 'status')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(onSave).toHaveBeenCalledWith({ type: 'percent', value: 5, minQuantity: 10, startsAt: `${israelToday()}T00:00:00`, endsAt: null })
  })

  it('checks the minimum quantity', async () => {
    const onSave = vi.fn(async () => {})
    const { user } = await renderDialog({ onSave })
    const save = () => user.click(screen.getByRole('button', { name: 'Save' }))
    await user.type(valueInput(), '5')
    await user.click(screen.getByRole('checkbox', { name: 'Bulk discount' }))
    const quantity = screen.getByLabelText('Minimum quantity *')
    await save()
    expect(quantity).toHaveAccessibleDescription(/Required/)
    expect(quantity).toHaveFocus()
    for (const wrong of ['1', '2.5', 'ten']) {
      await user.clear(quantity)
      await user.type(quantity, wrong)
      await save()
      expect(quantity).toHaveAccessibleDescription(/Enter a whole number, 2 or more/)
      expect(screen.getByRole('status')).toBeEmptyDOMElement()
    }
    expect(onSave).not.toHaveBeenCalled()
    // Unticking makes it a regular discount again.
    await user.click(screen.getByRole('checkbox', { name: 'Bulk discount' }))
    await save()
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ minQuantity: null }))
  })

  it('checks the value before saving', async () => {
    const onSave = vi.fn(async () => {})
    const { user } = await renderDialog({ onSave })
    const save = () => user.click(screen.getByRole('button', { name: 'Save' }))
    await save()
    expect(valueInput()).toHaveAccessibleDescription(/Required/)
    expect(valueInput()).toHaveFocus()
    await user.type(valueInput(), '0')
    await save()
    expect(valueInput()).toHaveAccessibleDescription(/Enter a value above zero/)
    await user.clear(valueInput())
    await user.type(valueInput(), '-5')
    await save()
    expect(valueInput()).toHaveAccessibleDescription(/Enter a value above zero/)
    expect(screen.queryByText(/ off, from /)).not.toBeInTheDocument()
    await user.clear(valueInput())
    await user.type(valueInput(), '1.234')
    await save()
    expect(valueInput()).toHaveAccessibleDescription(/at most two decimals/)
    await user.clear(valueInput())
    await user.type(valueInput(), '150')
    await save()
    expect(valueInput()).toHaveAccessibleDescription(/at most 100%/)
    // The same 150 is fine as an amount.
    await user.click(screen.getByRole('radio', { name: 'Amount (₪)' }))
    await save()
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ type: 'amount', value: 150 }))
  })

  it('checks the end date', async () => {
    const onSave = vi.fn(async () => {})
    const { user } = await renderDialog({ onSave })
    await user.type(valueInput(), '5')
    await user.click(screen.getByRole('checkbox', { name: 'No end date' }))
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(screen.getByLabelText('End date')).toHaveAccessibleDescription('Required')
    await user.clear(screen.getByLabelText('Start date *'))
    await user.type(screen.getByLabelText('Start date *'), '2026-12-10')
    await user.type(screen.getByLabelText('End date'), '2026-12-01')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(screen.getByLabelText('End date')).toHaveAccessibleDescription('The end is before the start.')
    expect(onSave).not.toHaveBeenCalled()
  })

  it('edits an existing discount', async () => {
    const onSave = vi.fn(async () => {})
    const { user } = await renderDialog({ onSave, initial: { type: 'amount', value: 15, minQuantity: null, startsAt: '2026-11-01T00:00:00', endsAt: '2026-11-30T23:59:00' } })
    expect(await screen.findByRole('dialog', { name: 'Edit discount' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'Amount (₪)' })).toBeChecked()
    expect(valueInput()).toHaveValue('15')
    expect(screen.getByRole('checkbox', { name: 'No end date' })).not.toBeChecked()
    await user.clear(valueInput())
    await user.type(valueInput(), '25')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(onSave).toHaveBeenCalledWith({ type: 'amount', value: 25, minQuantity: null, startsAt: '2026-11-01T00:00:00', endsAt: '2026-11-30T23:59:00' })
  })

  it('edits a bulk discount', async () => {
    const onSave = vi.fn(async () => {})
    const { user } = await renderDialog({ onSave, initial: { type: 'percent', value: 10, minQuantity: 24, startsAt: '2026-11-01T00:00:00', endsAt: null } })
    expect(screen.getByRole('checkbox', { name: 'Bulk discount' })).toBeChecked()
    expect(screen.getByLabelText('Minimum quantity *')).toHaveValue('24')
    await user.clear(screen.getByLabelText('Minimum quantity *'))
    await user.type(screen.getByLabelText('Minimum quantity *'), '48')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(onSave).toHaveBeenCalledWith({ type: 'percent', value: 10, minQuantity: 48, startsAt: '2026-11-01T00:00:00', endsAt: null })
  })

  it('saves the start and end times', async () => {
    const onSave = vi.fn(async () => {})
    const { user } = await renderDialog({ onSave })
    expect(screen.getByLabelText('Start time')).toHaveValue('00:00')
    expect(screen.getByLabelText('End time')).toBeDisabled()
    await user.type(valueInput(), '10')
    await user.clear(screen.getByLabelText('Start date *'))
    await user.type(screen.getByLabelText('Start date *'), '2026-12-01')
    await user.clear(screen.getByLabelText('Start time'))
    await user.type(screen.getByLabelText('Start time'), '08:30')
    await user.click(screen.getByRole('checkbox', { name: 'No end date' }))
    expect(screen.getByLabelText('End time')).toHaveValue('23:59')
    await user.type(screen.getByLabelText('End date'), '2026-12-01')
    await user.clear(screen.getByLabelText('End time'))
    await user.type(screen.getByLabelText('End time'), '18:00')
    // A time shows in the words only when it is not the default one.
    expect(screen.getByText(/^\u206610%\u2069 off, from Dec 1, 2026, \u206608:30\u2069 to Dec 1, 2026, \u206618:00\u2069$/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(onSave).toHaveBeenCalledWith({ type: 'percent', value: 10, minQuantity: null, startsAt: '2026-12-01T08:30:00', endsAt: '2026-12-01T18:00:00' })
  })

  it('refuses an end time before the start time on the same day', async () => {
    const onSave = vi.fn(async () => {})
    const { user } = await renderDialog({ onSave })
    await user.type(valueInput(), '10')
    await user.clear(screen.getByLabelText('Start time'))
    await user.type(screen.getByLabelText('Start time'), '12:00')
    await user.click(screen.getByRole('checkbox', { name: 'No end date' }))
    await user.type(screen.getByLabelText('End date'), israelToday())
    await user.clear(screen.getByLabelText('End time'))
    await user.type(screen.getByLabelText('End time'), '11:00')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(screen.getByLabelText('End date')).toHaveAccessibleDescription('The end is before the start.')
    expect(onSave).not.toHaveBeenCalled()
  })

  it('ends a running discount at this moment, dropping unsaved changes', async () => {
    const onSave = vi.fn(async () => {})
    const initial: DiscountValue = { type: 'percent', value: 10, minQuantity: 12, startsAt: `${dayFromToday(-30)}T00:00:00`, endsAt: `${dayFromToday(30)}T23:59:00` }
    const { user } = await renderDialog({ onSave, initial })
    await user.clear(valueInput())
    await user.type(valueInput(), '50')
    const before = israelNow()
    await user.click(screen.getByRole('button', { name: 'End discount now' }))
    const after = israelNow()
    expect(onSave).toHaveBeenCalledWith({ ...initial, endsAt: expect.any(String) })
    const { endsAt } = (onSave.mock.calls[0] as unknown as [DiscountValue])[0]
    expect(endsAt! >= before && endsAt! <= after).toBe(true)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('ends a discount that has not started with an empty period now', async () => {
    const onSave = vi.fn(async () => {})
    const { user } = await renderDialog({ onSave, initial: { type: 'amount', value: 5, minQuantity: null, startsAt: `${dayFromToday(3)}T00:00:00`, endsAt: null } })
    await user.click(screen.getByRole('button', { name: 'End discount now' }))
    const saved = (onSave.mock.calls[0] as unknown as [DiscountValue])[0]
    expect(saved.startsAt.slice(0, 10)).toBe(israelToday())
    expect(saved.endsAt).toBe(saved.startsAt)
  })

  it('offers "End discount now" only on a discount that has not ended', async () => {
    const { unmount } = await renderDialog()
    expect(screen.queryByRole('button', { name: 'End discount now' })).not.toBeInTheDocument()
    unmount()
    const { unmount: unmountEnded } = await renderDialog({ initial: { type: 'percent', value: 10, minQuantity: null, startsAt: `${dayFromToday(-10)}T00:00:00`, endsAt: `${dayFromToday(-1)}T23:59:00` } })
    expect(screen.queryByRole('button', { name: 'End discount now' })).not.toBeInTheDocument()
    unmountEnded()
    // Ending later today still offers it.
    await renderDialog({ initial: { type: 'percent', value: 10, minQuantity: null, startsAt: `${dayFromToday(-10)}T00:00:00`, endsAt: `${israelToday()}T23:59:59` } })
    expect(screen.getByRole('button', { name: 'End discount now' })).toBeInTheDocument()
  })

  it("keeps the dialog open with the server's reason when ending is refused", async () => {
    const onSave = vi.fn(async () => {
      throw new ApiError(400, { error: 'invalid' })
    })
    const { user } = await renderDialog({ onSave, initial: { type: 'percent', value: 10, minQuantity: null, startsAt: `${dayFromToday(-1)}T00:00:00`, endsAt: null } })
    await user.click(screen.getByRole('button', { name: 'End discount now' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid value')
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it("keeps the dialog open with the server's reason when the save is refused", async () => {
    const onSave = vi.fn(async () => {
      throw new ApiError(400, { error: 'invalid' })
    })
    const { user } = await renderDialog({ onSave })
    await user.type(valueInput(), '10')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid value')
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled()
  })

  it('speaks Hebrew on Hebrew pages', async () => {
    const { user } = await renderDialog({ locale: 'he' })
    expect(await screen.findByRole('dialog', { name: 'הנחה חדשה' })).toBeInTheDocument()
    await user.click(screen.getByRole('radio', { name: 'סכום (₪)' }))
    await user.type(screen.getByLabelText('ערך *'), '30')
    expect(screen.getByText(/^הנחה של \u2066.*30.*₪.*\u2069, מ־/)).toBeInTheDocument()
    await user.click(screen.getByRole('checkbox', { name: 'הנחת כמות' }))
    await user.type(screen.getByLabelText('כמות מינימלית *'), '12')
    expect(screen.getByText(/^הנחה של \u2066.*30.*₪.*\u2069 בקנייה של \u206612\u2069 יחידות ומעלה, מ־/)).toBeInTheDocument()
  })
})
