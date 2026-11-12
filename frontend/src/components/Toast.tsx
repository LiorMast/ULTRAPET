/**
 * Toast.tsx — A short notification at the top center of the screen, just under the fixed header: a large icon and
 * message on a brand color. It drops in, stays for `duration` (TOAST_SHOW_MS, 2 seconds, by default), fades away in TOAST_FADE_MS, then tells
 * its caller through `onDone` so the caller can unmount it. Screen readers hear the message from a live region
 * (polite; an error interrupts). Pages show toasts through useToast() (src/toast.tsx), which also sets how long each
 * kind stays. It is portalled to <body>, above everything on the page (z-[100], over the header and every dialog), and never takes the pointer or the focus.
 *
 * Three ready kinds (TOAST_KINDS): `kind="success"` (green, check), `kind="error"` (brand red, cross, announced at
 * once as an alert) and `kind="warning"` (amber, triangle); or any icon + color of your own.
 *
 * Usage: keep the toast in state and give each one a new `key`, so showing it again restarts the timer:
 *   {toast && <Toast key={toast.id} kind="success" message={toast.text} onDone={() => setToast(null)} />}
 */
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { cva, type VariantProps } from 'class-variance-authority'
import { CircleCheck, CircleX, TriangleAlert, type LucideIcon } from 'lucide-react'
import { cn } from 'cn'

/** How long the toast stays fully shown, in ms. */
export const TOAST_SHOW_MS = 2000

/** How long the toast takes to fade away, in ms (matches `duration-300` below). */
export const TOAST_FADE_MS = 300

const toastVariants = cva(
  'pointer-events-none fixed inset-x-0 top-20 z-[100] mx-auto flex w-fit max-w-[calc(100%-2rem)] items-center gap-3 px-6 py-4 text-base font-medium shadow-premium transition-opacity duration-300 animate-in fade-in slide-in-from-top-2 sm:top-[6.5rem]',
  {
    variants: {
      color: {
        charcoal: 'bg-brand-charcoal text-white',
        red: 'bg-brand-red text-white',
        light: 'border border-neutral-200 bg-white text-brand-charcoal [&_svg]:text-brand-red',
        success: 'bg-success text-white',
        warning: 'bg-warning text-brand-charcoal',
      },
    },
    defaultVariants: { color: 'charcoal' },
  },
)

/**
 * The toast's colors: `charcoal` (default), `red` (the brand red), `light` (white with a red icon), `success`
 * (green), `warning` (amber, dark text).
 */
export type ToastColor = NonNullable<VariantProps<typeof toastVariants>['color']>

/** The kinds of toast: each presets an icon, a color and how urgently screen readers announce it. */
export type ToastKind = 'success' | 'error' | 'warning'

/** The preset of each kind: an error interrupts (role "alert"), the others wait for a pause (role "status"). */
export const TOAST_KINDS: Record<ToastKind, { icon: LucideIcon; color: ToastColor; role: 'status' | 'alert' }> = {
  success: { icon: CircleCheck, color: 'success', role: 'status' },
  error: { icon: CircleX, color: 'red', role: 'alert' },
  warning: { icon: TriangleAlert, color: 'warning', role: 'status' },
}

/**
 * The toast notification.
 * @param props.kind - 'success', 'error' or 'warning': presets the icon, the color and the role (TOAST_KINDS);
 *   an explicit `icon` or `color` still wins. Without a kind: no icon, charcoal, role "status".
 * @param props.icon - A lucide icon shown before the message (decorative), or none.
 * @param props.message - The text of the notification.
 * @param props.color - The background color (ToastColor; default: the kind's, else 'charcoal').
 * @param props.duration - How long it stays before fading, in ms (default TOAST_SHOW_MS).
 * @param props.onDone - Called once it has faded away; the caller unmounts it then.
 * @param props.className - Extra classes on the toast.
 * @returns The toast, portalled to <body>.
 */
export function Toast({
  kind,
  icon,
  message,
  color,
  duration = TOAST_SHOW_MS,
  onDone,
  className,
}: {
  kind?: ToastKind
  icon?: LucideIcon
  message: string
  color?: ToastColor
  duration?: number
  onDone?: () => void
  className?: string
}) {
  const preset = kind ? TOAST_KINDS[kind] : undefined
  const Icon = icon ?? preset?.icon
  const [leaving, setLeaving] = useState(false)
  // The latest onDone, so a caller's new callback on re-render doesn't restart the timers.
  const doneRef = useRef(onDone)
  useEffect(() => {
    doneRef.current = onDone
  })

  useEffect(() => {
    const fade = window.setTimeout(() => setLeaving(true), duration)
    const done = window.setTimeout(() => doneRef.current?.(), duration + TOAST_FADE_MS)
    return () => {
      window.clearTimeout(fade)
      window.clearTimeout(done)
    }
  }, [duration])

  return createPortal(
    <div
      role={preset?.role ?? 'status'}
      data-slot="toast"
      data-kind={kind}
      data-leaving={leaving || undefined}
      className={cn(toastVariants({ color: color ?? preset?.color }), leaving && 'opacity-0', className)}
    >
      {Icon && <Icon aria-hidden="true" className="size-6 shrink-0" />}
      {message}
    </div>,
    document.body,
  )
}
