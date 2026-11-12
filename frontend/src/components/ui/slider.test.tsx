/**
 * slider.test.tsx — Tests for the Slider primitive (ui/slider.tsx): a named `role="slider"` with its range, moved by
 * the keyboard, and inert when disabled.
 */
import { useState } from 'react'
import { screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Slider } from '@/components/ui/slider'
import { renderComponent } from '@/test/utils'

/**
 * A slider from 1 to 12 that keeps its own state.
 * @param props.onChange - Spy told of each new value.
 * @param props.disabled - Turns the slider off.
 * @returns The slider.
 */
function Harness({ onChange = () => {}, disabled }: { onChange?: (value: number) => void; disabled?: boolean }) {
  const [value, setValue] = useState(3)
  return (
    <Slider
      aria-label="Products per page"
      aria-valuetext={`${value} per page`}
      min={1}
      max={12}
      step={1}
      value={[value]}
      disabled={disabled}
      onValueChange={([next]) => {
        setValue(next)
        onChange(next)
      }}
    />
  )
}

describe('Slider', () => {
  it('is a named slider with its range and value', async () => {
    renderComponent(<Harness />, 'en')
    const slider = await screen.findByRole('slider', { name: 'Products per page' })
    expect(slider).toHaveAttribute('aria-valuemin', '1')
    expect(slider).toHaveAttribute('aria-valuemax', '12')
    expect(slider).toHaveAttribute('aria-valuenow', '3')
    expect(slider).toHaveAttribute('aria-valuetext', '3 per page')
  })

  it('moves with the arrow keys, Home and End', async () => {
    const onChange = vi.fn()
    const { user } = renderComponent(<Harness onChange={onChange} />, 'en')
    const slider = await screen.findByRole('slider', { name: 'Products per page' })
    slider.focus()
    await user.keyboard('{ArrowRight}')
    expect(slider).toHaveAttribute('aria-valuenow', '4')
    await user.keyboard('{End}')
    expect(slider).toHaveAttribute('aria-valuenow', '12')
    await user.keyboard('{Home}')
    expect(slider).toHaveAttribute('aria-valuenow', '1')
    expect(onChange.mock.calls.map(([value]) => value)).toEqual([4, 12, 1])
  })

  it('does not move when disabled', async () => {
    const onChange = vi.fn()
    const { user } = renderComponent(<Harness onChange={onChange} disabled />, 'en')
    const slider = await screen.findByRole('slider', { name: 'Products per page' })
    slider.focus()
    await user.keyboard('{ArrowRight}')
    expect(onChange).not.toHaveBeenCalled()
  })
})
