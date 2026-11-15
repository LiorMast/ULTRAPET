/**
 * Toast.tsx — A short notification at the top center of the screen, just under the fixed header: a compact squircle box
 * on a brand color with the kind's icon, the message in bold and a close button (X) at the end. It drops in 8px, stays
 * for `duration` (TOAST_SHOW_MS, 2 seconds, by default; the timer pauses while the pointer is on it or its close button
 * has the focus), fades away while rising back in TOAST_FADE_MS, then tells its caller through `onDone` so the caller
 * can unmount it; the close button starts that fade at once. Screen readers hear the message from a live region
 * (polite; an error interrupts), which holds only the icon and the words (the close button sits beside it). Pages show
 * toasts through useToast() (src/toast.tsx), which also sets how long each kind stays and names the close button. It
 * is portalled to <body>, above everything on the page (z-[100], over the header and every dialog), and never moves the
 * focus.
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
import { CircleCheck, CircleX, TriangleAlert, X, type LucideIcon } from 'lucide-react'
import { cn } from 'cn'

/** How long the toast stays fully shown, in ms. */
export const TOAST_SHOW_MS = 2000

/** How long the toast takes to fade away, in ms (matches `duration-300` below). */
export const TOAST_FADE_MS = 300

const toastVariants = cva(
  'fixed inset-x-0 top-20 z-[100] mx-auto flex w-fit min-w-[min(22rem,calc(100vw-2rem))] max-w-[calc(100%-2rem)] items-center gap-3 rounded-lg py-2 ps-4 pe-2 text-sm font-semibold shadow-premium-sm transition-[opacity,translate] duration-300 animate-in fade-in slide-in-from-top-2 sm:top-[6.5rem]',
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
 * @param props.duration - How long it stays before fading, in ms (default TOAST_SHOW_MS); paused while hovered.
 * @param props.closeLabel - The close button's accessible name (translated, e.g. "Close notification"); omitted = no
 *   close button.
 * @param props.onDone - Called once it has faded away; the caller unmounts it then.
 * @param props.className - Extra classes on the toast's box.
 * @returns The toast, portalled to <body>.
 */
export function Toast({
  kind,
  icon,
  message,
  color,
  duration = TOAST_SHOW_MS,
  closeLabel,
  onDone,
  className,
}: {
  kind?: ToastKind
  icon?: LucideIcon
  message: string
  color?: ToastColor
  duration?: number
  closeLabel?: string
  onDone?: () => void
  className?: string
}) {
  const preset = kind ? TOAST_KINDS[kind] : undefined
  const Icon = icon ?? preset?.icon
  const [leaving, setLeaving] = useState(false)
  const [paused, setPaused] = useState(false)
  // How long it still has to stay; a pause keeps what is left.
  const remaining = useRef(duration)
  // Set once it was closed by hand: the countdown must not run (and call onDone) again after that.
  const closed = useRef(false)
  const closeTimer = useRef<number | undefined>(undefined)
  // The latest onDone, so a caller's new callback on re-render doesn't restart the timers.
  const doneRef = useRef(onDone)
  useEffect(() => {
    doneRef.current = onDone
  })

  // Counts down while shown and not paused: the fade starts when the time is up, onDone follows the fade (both set
  // here, so they keep their times). A pause clears them and stores the time left.
  useEffect(() => {
    if (paused || closed.current) return
    const started = Date.now()
    const fade = window.setTimeout(() => setLeaving(true), remaining.current)
    const done = window.setTimeout(() => doneRef.current?.(), remaining.current + TOAST_FADE_MS)
    return () => {
      window.clearTimeout(fade)
      window.clearTimeout(done)
      remaining.current = Math.max(0, remaining.current - (Date.now() - started))
    }
  }, [paused])
  useEffect(() => () => window.clearTimeout(closeTimer.current), [])

  /** The close button: fades out at once, then tells the caller. */
  const close = () => {
    if (closed.current) return
    closed.current = true
    setLeaving(true)
    closeTimer.current = window.setTimeout(() => doneRef.current?.(), TOAST_FADE_MS)
  }

  /**
   * Pauses or resumes the countdown (pointer on the toast, focus on its close button); ignored once it is fading.
   * @param next - True to pause.
   */
  const pause = (next: boolean) => {
    if (!leaving) setPaused(next)
  }

  return createPortal(
    <div
      data-slot="toast-box"
      data-kind={kind}
      data-leaving={leaving || undefined}
      onPointerEnter={() => pause(true)}
      onPointerLeave={() => pause(false)}
      onFocus={() => pause(true)}
      onBlur={() => pause(false)}
      className={cn(toastVariants({ color: color ?? preset?.color }), leaving && '-translate-y-2 opacity-0', className)}
    >
      <div role={preset?.role ?? 'status'} data-slot="toast" data-kind={kind} className="flex min-w-0 flex-1 items-center gap-3 py-1">
        {Icon && <Icon aria-hidden="true" className="size-5 shrink-0" />}
        {message}
      </div>
      {closeLabel && (
        <button
          type="button"
          aria-label={closeLabel}
          onClick={close}
          className="flex size-8 shrink-0 items-center justify-center rounded-md opacity-80 outline-none transition-[opacity,background-color] duration-150 hover:bg-current/15 hover:opacity-100 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-current"
        >
          <X aria-hidden="true" className="size-4" />
        </button>
      )}
    </div>,
    document.body,
  )
}
