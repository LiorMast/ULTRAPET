/**
 * toast.tsx — The site's one toast at a time: ToastProvider shows the latest Toast (components/Toast.tsx) and
 * useToast() gives any component `success`, `error` and `warning` to show one. A new toast replaces the one on
 * screen and restarts its timer. Used for confirmations that have no place of their own on the page: saves and
 * deletions in the admin tables, discount dialogs and in-place editors, signing in and out, and a draft dropped on
 * sign-out. Mounted by main.tsx and the test helpers (src/test/utils.tsx), inside LocaleProvider.
 *
 * Success toasts stay for TOAST_SHOW_MS (half a second); errors and warnings stay for TOAST_ALERT_MS, long enough
 * to read (WCAG 2.2.1, enough time).
 */
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react'
import { Toast, TOAST_SHOW_MS, type ToastKind } from '@/components/Toast'

/** How long an error or a warning toast stays, in ms: a message that matters must be readable. */
export const TOAST_ALERT_MS = 5000

/** How long each kind of toast stays before it fades, in ms. */
const DURATIONS: Record<ToastKind, number> = { success: TOAST_SHOW_MS, error: TOAST_ALERT_MS, warning: TOAST_ALERT_MS }

type ToastValue = Record<ToastKind, (message: string) => void>

const ToastContext = createContext<ToastValue | null>(null)

/**
 * Provides useToast() and renders the toast that is showing.
 * @param props.children - The app.
 * @returns The children and the current toast, if any.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<{ id: number; kind: ToastKind; message: string } | null>(null)
  const nextId = useRef(0)

  /**
   * Shows a toast, replacing the one on screen.
   * @param kind - success, error or warning.
   * @param message - The text.
   */
  const show = useCallback((kind: ToastKind, message: string) => {
    nextId.current += 1
    setToast({ id: nextId.current, kind, message })
  }, [])

  const value = useMemo<ToastValue>(
    () => ({
      success: (message) => show('success', message),
      error: (message) => show('error', message),
      warning: (message) => show('warning', message),
    }),
    [show],
  )

  return (
    <ToastContext.Provider value={value}>
      {children}
      {toast && (
        <Toast
          key={toast.id}
          kind={toast.kind}
          message={toast.message}
          duration={DURATIONS[toast.kind]}
          onDone={() => setToast((current) => (current?.id === toast.id ? null : current))}
        />
      )}
    </ToastContext.Provider>
  )
}

/**
 * Shows toasts.
 * @returns `success(message)`, `error(message)` and `warning(message)`; each replaces the toast on screen.
 */
export function useToast(): ToastValue {
  const value = useContext(ToastContext)
  if (!value) throw new Error('useToast must be used inside <ToastProvider>')
  return value
}
