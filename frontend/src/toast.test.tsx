/**
 * toast.test.tsx — Tests for the site's toast provider (src/toast.tsx): useToast() shows a success, error or warning
 * toast, a new toast replaces the one on screen, every toast leaves after 2 seconds
 * TOAST_ALERT_MS, and useToast() outside the provider is an error.
 */
import { act, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { TOAST_FADE_MS, TOAST_SHOW_MS } from '@/components/Toast'
import { TOAST_ALERT_MS, ToastProvider, useToast } from '@/toast'

/**
 * Buttons that show each kind of toast.
 * @returns The buttons.
 */
function Buttons() {
  const toast = useToast()
  return (
    <>
      <button onClick={() => toast.success('Saved')}>success</button>
      <button onClick={() => toast.error('Failed')}>error</button>
      <button onClick={() => toast.warning('Careful')}>warning</button>
    </>
  )
}

/**
 * Renders the buttons inside the provider.
 * @returns The render result.
 */
const renderButtons = () =>
  render(
    <ToastProvider>
      <Buttons />
    </ToastProvider>,
  )

/**
 * Clicks one of the buttons.
 * @param name - The button's name (the toast kind).
 */
const press = (name: string) => act(() => screen.getByRole('button', { name }).click())

const toast = () => document.querySelector('[data-slot="toast"]')

describe('ToastProvider', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it.each([
    ['success', 'Saved', 'status'],
    ['error', 'Failed', 'alert'],
    ['warning', 'Careful', 'status'],
  ])('shows a %s toast', (kind, message, role) => {
    renderButtons()
    press(kind)
    expect(screen.getByRole(role)).toHaveTextContent(message)
    expect(toast()).toHaveAttribute('data-kind', kind)
  })

  it('shows one toast at a time: a new one replaces the one on screen', () => {
    renderButtons()
    press('success')
    press('warning')
    expect(document.querySelectorAll('[data-slot="toast"]')).toHaveLength(1)
    expect(toast()).toHaveTextContent('Careful')
  })

  it('removes a success toast after 2 seconds and its fade', () => {
    vi.useFakeTimers()
    renderButtons()
    press('success')
    act(() => vi.advanceTimersByTime(TOAST_SHOW_MS + TOAST_FADE_MS - 1))
    expect(toast()).toBeInTheDocument()
    act(() => vi.advanceTimersByTime(1))
    expect(toast()).toBeNull()
  })

  it.each(['error', 'warning'])('keeps a %s toast long enough to read', (kind) => {
    vi.useFakeTimers()
    renderButtons()
    press(kind)
    act(() => vi.advanceTimersByTime(TOAST_ALERT_MS - 1))
    expect(toast()).not.toHaveAttribute('data-leaving')
    act(() => vi.advanceTimersByTime(1 + TOAST_FADE_MS))
    expect(toast()).toBeNull()
  })

  it('restarts the timer when a toast replaces another', () => {
    vi.useFakeTimers()
    renderButtons()
    press('success')
    act(() => vi.advanceTimersByTime(TOAST_SHOW_MS - 100))
    press('success')
    act(() => vi.advanceTimersByTime(TOAST_SHOW_MS - 1))
    expect(toast()).not.toHaveAttribute('data-leaving')
  })

  it('refuses useToast() outside the provider', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(<Buttons />)).toThrow('useToast must be used inside <ToastProvider>')
  })
})
