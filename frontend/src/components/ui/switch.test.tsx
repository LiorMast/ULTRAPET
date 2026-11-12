/**
 * switch.test.tsx — Tests for the Switch primitive (ui/switch.tsx): a `role="switch"` named by its label, toggled by
 * click, by its label and by Space, and inert when disabled.
 */
import { useState } from 'react'
import { screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Switch } from '@/components/ui/switch'
import { renderComponent } from '@/test/utils'

/**
 * A labelled switch that keeps its own state.
 * @param props.onChange - Spy told of each new state.
 * @param props.disabled - Turns the switch off.
 * @returns The switch and its label.
 */
function Harness({ onChange = () => {}, disabled }: { onChange?: (checked: boolean) => void; disabled?: boolean }) {
  const [checked, setChecked] = useState(false)
  return (
    <>
      <Switch
        id="notify"
        checked={checked}
        disabled={disabled}
        onCheckedChange={(next) => {
          setChecked(next)
          onChange(next)
        }}
      />
      <label htmlFor="notify">Notify me</label>
    </>
  )
}

describe('Switch', () => {
  it('toggles by click, by its label and by Space', async () => {
    const onChange = vi.fn()
    const { user } = renderComponent(<Harness onChange={onChange} />, 'en')
    const toggle = await screen.findByRole('switch', { name: 'Notify me' })
    expect(toggle).not.toBeChecked()
    await user.click(toggle)
    expect(toggle).toBeChecked()
    await user.click(screen.getByText('Notify me'))
    expect(toggle).not.toBeChecked()
    toggle.focus()
    await user.keyboard(' ')
    expect(toggle).toBeChecked()
    expect(onChange.mock.calls).toEqual([[true], [false], [true]])
  })

  it('does nothing when disabled', async () => {
    const onChange = vi.fn()
    const { user } = renderComponent(<Harness onChange={onChange} disabled />, 'en')
    const toggle = await screen.findByRole('switch', { name: 'Notify me' })
    expect(toggle).toBeDisabled()
    await user.click(toggle)
    expect(toggle).not.toBeChecked()
    expect(onChange).not.toHaveBeenCalled()
  })
})
