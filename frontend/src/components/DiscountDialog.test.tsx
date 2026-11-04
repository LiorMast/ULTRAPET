/**
 * DiscountDialog.test.tsx — Tests for the discount dialog: the defaults (percentage, from today, no end date),
 * the percent/amount switch, an amount for a dated period, the field checks (empty, zero, negative, not a number,
 * over 100%, end before start, missing end), editing an existing discount, the server's
 * refusal keeping the dialog open, and the Hebrew texts.
 */
import { useState } from 'react'
import { screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/api'
import { DiscountDialog, israelToday, type DiscountValue } from '@/components/DiscountDialog'
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
    expect(onSave).toHaveBeenCalledWith({ type: 'percent', value: 12.5, startsOn: israelToday(), endsOn: null })
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
    expect(onSave).toHaveBeenCalledWith({ type: 'amount', value: 20, startsOn: '2026-12-01', endsOn: '2026-12-31' })
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
    expect(screen.getByLabelText('End date')).toHaveAccessibleDescription('The end date is before the start date.')
    expect(onSave).not.toHaveBeenCalled()
  })

  it('edits an existing discount', async () => {
    const onSave = vi.fn(async () => {})
    const { user } = await renderDialog({ onSave, initial: { type: 'amount', value: 15, startsOn: '2026-11-01', endsOn: '2026-11-30' } })
    expect(await screen.findByRole('dialog', { name: 'Edit discount' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'Amount (₪)' })).toBeChecked()
    expect(valueInput()).toHaveValue('15')
    expect(screen.getByRole('checkbox', { name: 'No end date' })).not.toBeChecked()
    await user.clear(valueInput())
    await user.type(valueInput(), '25')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(onSave).toHaveBeenCalledWith({ type: 'amount', value: 25, startsOn: '2026-11-01', endsOn: '2026-11-30' })
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
  })
})
