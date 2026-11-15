/**
 * Toast.test.tsx — Tests for the toast notification (Toast.tsx), rendered alone (it needs no providers): its
 * message in a live region with a decorative icon, the color variants, the success / error / warning kinds (role,
 * color, icon; explicit props win), staying for 2 seconds, then fading and calling onDone, a custom duration, the close
 * button beside the live region (dismisses at once), and the pause while the pointer is on it.
 */
import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Check } from 'lucide-react'
import { Toast, TOAST_FADE_MS, TOAST_SHOW_MS } from '@/components/Toast'

const toast = () => screen.getByRole('status')

/** The toast's colored box (holds the live region and the close button). */
const box = () => document.querySelector<HTMLElement>('[data-slot="toast-box"]')!

describe('Toast', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('shows the message in a polite status region, with a decorative icon, outside the page content', () => {
    render(<Toast icon={Check} message="Saved" />)
    expect(toast()).toHaveTextContent('Saved')
    expect(toast().querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
    expect(box().parentElement).toBe(document.body)
    expect(box()).toHaveClass('rounded-lg')
    expect(box()).not.toHaveClass('rounded-full')
  })

  it('renders without an icon', () => {
    render(<Toast message="Saved" />)
    expect(toast().querySelector('svg')).toBeNull()
  })

  it('takes its color from the color prop (charcoal by default)', () => {
    const { unmount } = render(<Toast message="A" />)
    expect(box()).toHaveClass('bg-brand-charcoal')
    unmount()
    render(<Toast message="B" color="red" />)
    expect(box()).toHaveClass('bg-brand-red')
  })

  it.each([
    ['success', 'status', 'bg-success', 'lucide-circle-check'],
    ['error', 'alert', 'bg-brand-red', 'lucide-circle-x'],
    ['warning', 'status', 'bg-warning', 'lucide-triangle-alert'],
  ] as const)('a %s toast has its own role, color and icon', (kind, role, colorClass, iconClass) => {
    render(<Toast kind={kind} message="Done" />)
    const element = screen.getByRole(role)
    expect(element).toHaveTextContent('Done')
    expect(box()).toHaveAttribute('data-kind', kind)
    expect(box()).toHaveClass(colorClass)
    expect(element.querySelector('svg')).toHaveClass(iconClass)
  })

  it('lets an explicit icon and color override the kind', () => {
    render(<Toast kind="success" icon={Check} color="light" message="Done" />)
    expect(box()).toHaveClass('bg-white')
    expect(toast().querySelector('svg')).toHaveClass('lucide-check')
  })

  it('stays for 2 seconds, fades, then calls onDone', () => {
    vi.useFakeTimers()
    const onDone = vi.fn()
    render(<Toast message="Saved" onDone={onDone} />)
    act(() => vi.advanceTimersByTime(TOAST_SHOW_MS - 1))
    expect(box()).not.toHaveAttribute('data-leaving')
    act(() => vi.advanceTimersByTime(1))
    expect(box()).toHaveAttribute('data-leaving')
    expect(box()).toHaveClass('opacity-0')
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

  it('has a close button beside the live region that dismisses it at once', () => {
    vi.useFakeTimers()
    const onDone = vi.fn()
    render(<Toast kind="success" message="Order cancelled." closeLabel="Close notification" onDone={onDone} />)
    const close = screen.getByRole('button', { name: 'Close notification' })
    // Only the words are announced: the button is not inside the live region.
    expect(toast()).not.toContainElement(close)
    expect(box()).toContainElement(close)
    fireEvent.click(close)
    expect(box()).toHaveAttribute('data-leaving')
    act(() => vi.advanceTimersByTime(TOAST_FADE_MS))
    expect(onDone).toHaveBeenCalledOnce()
  })

  it('has no close button without a label', () => {
    render(<Toast message="Saved" />)
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('waits while the pointer is on it, then stays for the time it had left', () => {
    vi.useFakeTimers()
    const onDone = vi.fn()
    render(<Toast message="Saved" closeLabel="Close notification" onDone={onDone} />)
    act(() => vi.advanceTimersByTime(1500))
    fireEvent.pointerEnter(box())
    act(() => vi.advanceTimersByTime(10_000))
    expect(box()).not.toHaveAttribute('data-leaving')
    fireEvent.pointerLeave(box())
    act(() => vi.advanceTimersByTime(TOAST_SHOW_MS - 1500 - 1))
    expect(box()).not.toHaveAttribute('data-leaving')
    act(() => vi.advanceTimersByTime(1))
    expect(box()).toHaveAttribute('data-leaving')
    act(() => vi.advanceTimersByTime(TOAST_FADE_MS))
    expect(onDone).toHaveBeenCalledOnce()
  })
})
