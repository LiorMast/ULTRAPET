/**
 * SegmentedSwitch.test.tsx — Tests for the multi-choice switch (SegmentedSwitch.tsx): a radio group named by its
 * legend, choosing by click and by the arrow keys, disabled options and groups, a hidden legend, and the thumb that
 * follows the chosen option in both text directions.
 */
import { useState } from 'react'
import { screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { SegmentedSwitch, type SegmentedOption } from '@/components/SegmentedSwitch'
import { renderComponent } from '@/test/utils'

type Size = 's' | 'm' | 'l'

const OPTIONS: SegmentedOption<Size>[] = [
  { value: 's', label: 'Small' },
  { value: 'm', label: 'Medium' },
  { value: 'l', label: 'Large' },
]

/**
 * A switch that keeps its own choice, like a form field does.
 * @param props.onChange - Spy told of each new choice.
 * @param props.initial - The first choice (default "s").
 * @param props.options - The choices (default OPTIONS).
 * @param props.disabled - Turns the switch off.
 * @param props.hideLegend - Hides the legend visually.
 * @returns The switch.
 */
function Harness({
  onChange = () => {},
  initial = 's',
  options = OPTIONS,
  disabled,
  hideLegend,
}: {
  onChange?: (value: Size) => void
  initial?: Size
  options?: SegmentedOption<Size>[]
  disabled?: boolean
  hideLegend?: boolean
}) {
  const [value, setValue] = useState<Size>(initial)
  return (
    <SegmentedSwitch
      legend="Size"
      options={options}
      value={value}
      disabled={disabled}
      hideLegend={hideLegend}
      onChange={(next) => {
        setValue(next)
        onChange(next)
      }}
    />
  )
}

const radio = (name: string) => screen.getByRole('radio', { name })
const thumb = () => document.querySelector<HTMLElement>('[data-slot="segmented-thumb"]')

describe('SegmentedSwitch', () => {
  it('is a radio group named by its legend, one radio per option named by its label', async () => {
    renderComponent(<Harness initial="m" />, 'en')
    const group = await screen.findByRole('group', { name: 'Size' })
    expect(group.tagName).toBe('FIELDSET')
    expect(screen.getAllByRole('radio')).toHaveLength(3)
    expect(radio('Medium')).toBeChecked()
    expect(radio('Small')).not.toBeChecked()
    // The radios share one generated group name, so the browser treats them as one tab stop.
    const names = new Set(screen.getAllByRole('radio').map((input) => input.getAttribute('name')))
    expect(names.size).toBe(1)
  })

  it('chooses by click and by the arrow keys, reporting each value', async () => {
    const onChange = vi.fn()
    const { user } = renderComponent(<Harness onChange={onChange} />, 'en')
    await user.click(await screen.findByText('Large'))
    expect(radio('Large')).toBeChecked()
    expect(onChange).toHaveBeenLastCalledWith('l')
    await user.keyboard('{ArrowLeft}')
    expect(radio('Medium')).toBeChecked()
    expect(onChange).toHaveBeenLastCalledWith('m')
  })

  it('skips a disabled option and turns every radio off when the switch is disabled', async () => {
    const onChange = vi.fn()
    const { user, unmount } = renderComponent(
      <Harness onChange={onChange} options={[OPTIONS[0], { ...OPTIONS[1], disabled: true }, OPTIONS[2]]} />,
      'en',
    )
    expect(await screen.findByRole('radio', { name: 'Medium' })).toBeDisabled()
    await user.click(screen.getByText('Medium'))
    expect(onChange).not.toHaveBeenCalled()
    expect(radio('Small')).toBeChecked()
    unmount()

    renderComponent(<Harness disabled />, 'en')
    for (const name of ['Small', 'Medium', 'Large']) expect(await screen.findByRole('radio', { name })).toBeDisabled()
  })

  it('keeps the accessible name when the legend is hidden', async () => {
    renderComponent(<Harness hideLegend />, 'en')
    expect(await screen.findByRole('group', { name: 'Size' })).toBeInTheDocument()
    expect(screen.getByText('Size')).toHaveClass('sr-only')
  })

  it.each(['en', 'he'] as const)('slides the thumb to the chosen option (%s, logical inset)', async (locale) => {
    const { user } = renderComponent(<Harness />, locale)
    await screen.findByRole('group', { name: 'Size' })
    expect(thumb()?.style.width).toBe('calc(33.3333%)')
    expect(thumb()?.style.insetInlineStart).toBe('calc(0%)')
    await user.click(screen.getByText('Large'))
    expect(thumb()?.style.insetInlineStart).toBe('calc(66.6667%)')
  })
})
