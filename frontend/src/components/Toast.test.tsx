/**
 * Toast.test.tsx — Tests for the toast notification (Toast.tsx), rendered alone (it needs no providers): its
 * message in a live region with a decorative icon, the color variants, the success / error / warning kinds (role,
 * color, icon; explicit props win), staying for 2 seconds, then fading and calling onDone, and a custom duration.
 */
import { act, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Check } from 'lucide-react'
import { Toast, TOAST_FADE_MS, TOAST_SHOW_MS } from '@/components/Toast'

const toast = () => screen.getByRole('status')

describe('Toast', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('shows the message in a polite status region, with a decorative icon, outside the page content', () => {
    render(<Toast icon={Check} message="Saved" />)
    expect(toast()).toHaveTextContent('Saved')
    expect(toast().querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
    expect(toast().parentElement).toBe(document.body)
  })

  it('renders without an icon', () => {
    render(<Toast message="Saved" />)
    expect(toast().querySelector('svg')).toBeNull()
  })

  it('takes its color from the color prop (charcoal by default)', () => {
    const { unmount } = render(<Toast message="A" />)
    expect(toast()).toHaveClass('bg-brand-charcoal')
    unmount()
    render(<Toast message="B" color="red" />)
    expect(toast()).toHaveClass('bg-brand-red')
  })

  it.each([
    ['success', 'status', 'bg-success', 'lucide-circle-check'],
    ['error', 'alert', 'bg-brand-red', 'lucide-circle-x'],
    ['warning', 'status', 'bg-warning', 'lucide-triangle-alert'],
  ] as const)('a %s toast has its own role, color and icon', (kind, role, colorClass, iconClass) => {
    render(<Toast kind={kind} message="Done" />)
    const element = screen.getByRole(role)
    expect(element).toHaveTextContent('Done')
    expect(element).toHaveAttribute('data-kind', kind)
    expect(element).toHaveClass(colorClass)
    expect(element.querySelector('svg')).toHaveClass(iconClass)
  })

  it('lets an explicit icon and color override the kind', () => {
    render(<Toast kind="success" icon={Check} color="light" message="Done" />)
    expect(toast()).toHaveClass('bg-white')
    expect(toast().querySelector('svg')).toHaveClass('lucide-check')
  })

  it('stays for 2 seconds, fades, then calls onDone', () => {
    vi.useFakeTimers()
    const onDone = vi.fn()
    render(<Toast message="Saved" onDone={onDone} />)
    act(() => vi.advanceTimersByTime(TOAST_SHOW_MS - 1))
    expect(toast()).not.toHaveAttribute('data-leaving')
    act(() => vi.advanceTimersByTime(1))
    expect(toast()).toHaveAttribute('data-leaving')
    expect(toast()).toHaveClass('opacity-0')
    expect(onDone).not.toHaveBeenCalled()
    act(() => vi.advanceTimersByTime(TOAST_FADE_MS))
    expect(onDone).toHaveBeenCalledOnce()
  })

  it('accepts a custom duration', () => {
    vi.useFakeTimers()
    const onDone = vi.fn()
    render(<Toast message="Saved" duration={3000} onDone={onDone} />)
    act(() => vi.advanceTimersByTime(TOAST_SHOW_MS + TOAST_FADE_MS))
    expect(onDone).not.toHaveBeenCalled()
    act(() => vi.advanceTimersByTime(3000 - TOAST_SHOW_MS))
    expect(onDone).toHaveBeenCalledOnce()
  })
})
