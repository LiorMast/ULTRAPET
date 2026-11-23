/**
 * ui/sheet.tsx — A panel that slides in from an edge of the screen (shadcn/ui on Radix Dialog).
 *
 * Used by MobileMenu as the mobile navigation drawer. Radix traps keyboard focus inside the panel,
 * closes it on Escape or a click on the backdrop, stops the page behind it from scrolling, and returns
 * focus to the trigger on close. Every sheet needs a SheetTitle (it may be visually hidden with
 * className="sr-only") so screen readers can announce what opened.
 *
 * Look: a white panel with the premium shadow whose edge facing the page is rounded (rounded-3xl). Those corner
 * classes are physical (rounded-l / rounded-r) on purpose: `side` names a physical screen edge.
 *
 * Motion (Apple's fluid-interface rules): the panel slides in from its own edge and leaves the same way, on
 * the site's spring curve. A panel given `onSwipeClose` can also be swiped away (useSwipeToClose): a left or right
 * drawer sideways, a bottom sheet down by its grabber (the bar drawn at its top) or its header, so its body still
 * scrolls. It follows the finger 1:1, resists when pulled inwards (rubber band), and on release a flick's momentum
 * decides whether it closes or springs back. It can be grabbed again while springing back.
 *
 * Mobile-first: a bottom sheet (the catalog's filters, a card's actions) is the phone's menu: full width, at most the
 * screen below the header tall, padded for the phone's home bar (safe area); side drawers pad for the safe areas too.
 * The close button is 44px on touch screens (ui/button's icon-sm).
 */
import * as React from "react"
import { cn } from "cn"
import { Dialog as SheetPrimitive } from "radix-ui"

import { Button } from "@/components/ui/button"
import { XIcon } from "lucide-react"

/** How far (px) a finger must travel before the swipe counts as horizontal (a drag) or vertical (a scroll). */
const SWIPE_SLOP = 10
/** Scroll-like deceleration rate used to project where a flick would come to rest (Apple's value). */
const DECELERATION = 0.998
/** Only pointer moves from the last this-many ms count towards the release velocity. */
const VELOCITY_WINDOW_MS = 100
/** Duration of the spring back to the open position. */
const SNAP_BACK_MS = 400

/** A swipe in progress: where it started, which way it locked, and recent samples for the velocity. */
type Swipe = {
  pointerId: number
  /** Where the finger started along the closing axis, shifted by the panel's offset at that moment. */
  origin: number
  /** Where it started along the other axis (a move mostly that way is a scroll, not a swipe). */
  cross: number
  axis: "pending" | "drag" | "scroll"
  /** The panel's size along the closing axis. */
  size: number
  offset: number
  samples: { p: number; t: number }[]
}

/**
 * How much further a flick would travel if it decelerated like a scroll view.
 * @param velocity - Release velocity in px/s.
 * @returns The extra distance in px (negative for a flick backwards).
 */
function project(velocity: number) {
  return ((velocity / 1000) * DECELERATION) / (1 - DECELERATION)
}

/**
 * Soft boundary: the further the panel is pulled past its open position, the less it follows.
 * @param overshoot - How far past the boundary the finger is, in px (>= 0).
 * @param dimension - The panel's size along the closing axis in px.
 * @returns How far the panel moves past the boundary, in px.
 */
function rubberband(overshoot: number, dimension: number) {
  const constant = 0.55
  return (overshoot * dimension * constant) / (dimension + constant * overshoot)
}

/**
 * Swipe-to-close for a panel attached to a screen edge: a left or right drawer is swiped sideways, a bottom sheet (and a
 * dialog shown as one on a phone) down. The panel moves with the CSS `translate` property, which adds to the `transform`
 * of the open/close animations, so a swipe that ends in closing hands over to the exit animation from where the finger
 * let go. Used by SheetContent and DialogContent.
 * @param side - The edge the panel is attached to (the direction it closes towards).
 * @param onClose - Called when a swipe ends in closing (the caller closes the panel); undefined disables swiping.
 * @param options.handle - A selector: a swipe may only start on an element inside a match (e.g. a bottom sheet's grabber
 *   and header, so its scrolling body still scrolls). Default: anywhere on the panel.
 * @param options.enabled - Checked when a finger touches down; false = no swipe this time (e.g. only on phones).
 * @returns `overlay`, the ref to put on the backdrop (it fades along with the swipe), and `handlers`, the
 *   pointer handlers for the panel (empty when swiping is disabled).
 */
export function useSwipeToClose(
  side: "top" | "right" | "bottom" | "left",
  onClose: (() => void) | undefined,
  { handle, enabled }: { handle?: string; enabled?: () => boolean } = {}
) {
  const overlay = React.useRef<HTMLDivElement>(null)
  const swipe = React.useRef<Swipe | null>(null)
  const dragged = React.useRef(false)
  if (!onClose) return { overlay, handlers: {} }
  const vertical = side === "top" || side === "bottom"
  /** +1 when closing moves the panel towards larger x or y (a right drawer, a bottom sheet), -1 otherwise. */
  const closeSign = side === "right" || side === "bottom" ? 1 : -1
  /** A pointer's position along the closing axis. */
  const along = (event: { clientX: number; clientY: number }) => (vertical ? event.clientY : event.clientX)
  /** A pointer's position along the other axis. */
  const across = (event: { clientX: number; clientY: number }) => (vertical ? event.clientX : event.clientY)

  /**
   * Puts the panel `offset` px towards its closing edge and dims the backdrop to match.
   * @param panel - The panel element.
   * @param offset - Distance towards the edge; negative while rubber-banding inwards.
   * @param size - The panel's size along the closing axis.
   */
  const place = (panel: HTMLElement, offset: number, size: number) => {
    panel.style.translate = vertical ? `0 ${offset * closeSign}px` : `${offset * closeSign}px 0`
    if (overlay.current) overlay.current.style.opacity = String(1 - Math.min(Math.max(offset / size, 0), 1))
  }

  /**
   * The panel's current offset towards its closing edge (it may still be springing back).
   * @param panel - The panel element.
   * @returns The offset in px.
   */
  const liveOffset = (panel: HTMLElement) => {
    const [x = "0", y = "0"] = getComputedStyle(panel).translate.split(" ")
    return (parseFloat(vertical ? y : x) || 0) * closeSign
  }

  /**
   * Starts tracking a touch or pen. If the panel is still springing back, it is caught where it is now.
   * @param event - The pointerdown on the panel.
   */
  const handlePointerDown = (event: React.PointerEvent<HTMLElement>) => {
    if (event.pointerType === "mouse" || !event.isPrimary) return
    if (handle && !(event.target as Element).closest(handle)) return
    if (enabled && !enabled()) return
    const panel = event.currentTarget
    const live = liveOffset(panel)
    panel.style.transition = "none"
    if (overlay.current) overlay.current.style.transition = "none"
    const rect = panel.getBoundingClientRect()
    const size = vertical ? rect.height : rect.width
    place(panel, live, size)
    dragged.current = false
    swipe.current = {
      pointerId: event.pointerId,
      origin: along(event) - live * closeSign,
      cross: across(event),
      axis: Math.abs(live) > 1 ? "drag" : "pending",
      size,
      offset: live,
      samples: [{ p: along(event), t: event.timeStamp }],
    }
    if (Math.abs(live) > 1) panel.setPointerCapture(event.pointerId)
  }

  /**
   * Follows the finger 1:1 once the move clearly goes along the closing axis; a move the other way is left to scrolling.
   * @param event - A pointermove on the panel.
   */
  const handlePointerMove = (event: React.PointerEvent<HTMLElement>) => {
    const s = swipe.current
    if (!s || event.pointerId !== s.pointerId || s.axis === "scroll") return
    const d = along(event) - s.origin
    const c = across(event) - s.cross
    if (s.axis === "pending") {
      if (Math.abs(c) > SWIPE_SLOP && Math.abs(c) >= Math.abs(d)) s.axis = "scroll"
      if (Math.abs(d) <= SWIPE_SLOP || s.axis === "scroll") return
      s.axis = "drag"
      s.origin += Math.sign(d) * SWIPE_SLOP // track 1:1 from the end of the slop, without a jump
      event.currentTarget.setPointerCapture(event.pointerId)
    }
    const raw = (along(event) - s.origin) * closeSign
    s.offset = raw >= 0 ? raw : -rubberband(-raw, s.size)
    dragged.current = true
    place(event.currentTarget, s.offset, s.size)
    s.samples.push({ p: along(event), t: event.timeStamp })
    while (s.samples.length > 2 && event.timeStamp - s.samples[0].t > VELOCITY_WINDOW_MS) s.samples.shift()
  }

  /**
   * Ends the swipe: projects the flick's momentum and closes when the panel would come to rest past its
   * middle; otherwise springs back open.
   * @param event - The pointerup or pointercancel.
   */
  const handlePointerEnd = (event: React.PointerEvent<HTMLElement>) => {
    const s = swipe.current
    if (!s || event.pointerId !== s.pointerId) return
    swipe.current = null
    const panel = event.currentTarget
    const first = s.samples[0]
    const last = s.samples[s.samples.length - 1]
    const elapsed = last.t - first.t
    const velocity = elapsed > 0 ? (((last.p - first.p) * closeSign) / elapsed) * 1000 : 0
    if (event.type === "pointerup" && s.axis === "drag" && s.offset + project(velocity) > s.size / 2) {
      // Leave at the finger's pace: faster flicks get a shorter exit, within 150-300ms.
      const remaining = Math.max(s.size - s.offset, 0)
      const ms = Math.round(Math.min(Math.max((remaining / Math.max(velocity, 1)) * 1000, 150), 300))
      panel.style.animationDuration = `${ms}ms`
      if (overlay.current) overlay.current.style.animationDuration = `${ms}ms`
      // onClose may close by clicking a close button inside the panel (DialogContent does): that click must get
      // through handleClickCapture, while the browser's own click at the end of the drag is still swallowed.
      dragged.current = false
      onClose()
      dragged.current = true
      return
    }
    panel.style.transition = `translate ${SNAP_BACK_MS}ms var(--ease-spring)`
    if (overlay.current) overlay.current.style.transition = `opacity ${SNAP_BACK_MS}ms var(--ease-spring)`
    place(panel, 0, s.size)
  }

  /**
   * Swallows the click that some browsers fire at the end of a drag, so a swipe never follows a link.
   * @param event - The click, in the capture phase.
   */
  const handleClickCapture = (event: React.MouseEvent<HTMLElement>) => {
    if (!dragged.current) return
    dragged.current = false
    event.preventDefault()
    event.stopPropagation()
  }

  return {
    overlay,
    handlers: {
      onPointerDown: handlePointerDown,
      onPointerMove: handlePointerMove,
      onPointerUp: handlePointerEnd,
      onPointerCancel: handlePointerEnd,
      onClickCapture: handleClickCapture,
    },
  }
}

/**
 * Root of a sheet; holds the open/closed state.
 * @param props - Radix Dialog.Root props (open, onOpenChange, ...).
 * @returns The sheet root.
 */
function Sheet({ ...props }: React.ComponentProps<typeof SheetPrimitive.Root>) {
  return <SheetPrimitive.Root data-slot="sheet" {...props} />
}

/**
 * The button that opens the sheet; it gets aria-expanded automatically.
 * @param props - Radix Dialog.Trigger props; `asChild` renders your own element instead of a button.
 * @returns The trigger.
 */
function SheetTrigger({
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Trigger>) {
  return <SheetPrimitive.Trigger data-slot="sheet-trigger" {...props} />
}

/**
 * An element that closes the sheet when activated.
 * @param props - Radix Dialog.Close props; `asChild` renders your own element instead of a button.
 * @returns The close control.
 */
function SheetClose({
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Close>) {
  return <SheetPrimitive.Close data-slot="sheet-close" {...props} />
}

/**
 * Renders the sheet at the end of <body>, above the page.
 * @param props - Radix Dialog.Portal props.
 * @returns The portal.
 */
function SheetPortal({
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Portal>) {
  return <SheetPrimitive.Portal data-slot="sheet-portal" {...props} />
}

/**
 * The dimmed backdrop behind the panel; clicking it closes the sheet.
 * @param props.className - Extra classes, merged over the defaults.
 * @param props - Other Radix Dialog.Overlay props.
 * @returns The backdrop.
 */
function SheetOverlay({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Overlay>) {
  return (
    <SheetPrimitive.Overlay
      data-slot="sheet-overlay"
      className={cn(
        "fixed inset-0 z-50 bg-black/50 ease-spring supports-backdrop-filter:backdrop-blur-xs reduced-transparency:backdrop-blur-none data-open:animate-in data-open:fade-in-0 data-open:duration-450 data-closed:animate-out data-closed:fade-out-0 data-closed:duration-300",
        className
      )}
      {...props}
    />
  )
}

/**
 * The sliding panel, with its backdrop.
 * @param props.side - The screen edge it slides in from: "top", "right" (default), "bottom" or "left". Choose it from the text direction (e.g. "left" for Hebrew).
 * @param props.showCloseButton - Show the built-in X button in the corner (default true).
 * @param props.onSwipeClose - Enables swipe-to-close and is called when a swipe ends in closing (close the sheet in it):
 *   a "left" or "right" panel anywhere on it, a "bottom" one by its grabber or a SheetHeader (it then shows the
 *   grabber). Without it the panel can't be swiped.
 * @param props.className - Extra classes (width, padding ...), merged over the defaults.
 * @param props.children - The panel's content.
 * @param props - Other Radix Dialog.Content props (aria-describedby, onOpenAutoFocus, ...).
 * @returns The panel inside a portal.
 */
function SheetContent({
  className,
  children,
  side = "right",
  showCloseButton = true,
  onSwipeClose,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Content> & {
  side?: "top" | "right" | "bottom" | "left"
  showCloseButton?: boolean
  onSwipeClose?: () => void
}) {
  const vertical = side === "top" || side === "bottom"
  const { overlay, handlers: swipeHandlers } = useSwipeToClose(side, onSwipeClose, vertical ? { handle: SHEET_HANDLE } : {})
  return (
    <SheetPortal>
      <SheetOverlay ref={overlay} />
      <SheetPrimitive.Content
        data-slot="sheet-content"
        data-side={side}
        className={cn(
          // A side drawer's width is a plain class (w-3/4, sm:max-w-sm), so a caller's own width class replaces it.
          "fixed z-50 flex flex-col gap-4 overflow-hidden overscroll-contain bg-popover bg-clip-padding text-sm text-popover-foreground shadow-premium ease-spring w-3/4 sm:max-w-sm data-[side=right]:rounded-l-3xl data-[side=left]:rounded-r-3xl data-[side=top]:rounded-b-3xl data-[side=bottom]:rounded-t-3xl data-[side=bottom]:inset-x-0 data-[side=bottom]:bottom-0 data-[side=bottom]:h-auto data-[side=bottom]:max-h-[calc(100dvh-var(--header-h))] data-[side=bottom]:w-auto data-[side=bottom]:max-w-none data-[side=bottom]:border-t data-[side=bottom]:pb-[env(safe-area-inset-bottom)] data-[side=left]:inset-y-0 data-[side=left]:left-0 data-[side=left]:h-full data-[side=left]:border-e data-[side=right]:inset-y-0 data-[side=right]:right-0 data-[side=right]:h-full data-[side=right]:border-s data-[side=left]:pt-[env(safe-area-inset-top)] data-[side=left]:pb-[env(safe-area-inset-bottom)] data-[side=right]:pt-[env(safe-area-inset-top)] data-[side=right]:pb-[env(safe-area-inset-bottom)] data-[side=top]:inset-x-0 data-[side=top]:top-0 data-[side=top]:h-auto data-[side=top]:w-auto data-[side=top]:max-w-none data-[side=top]:border-b data-open:animate-in data-open:duration-450 data-[side=bottom]:data-open:slide-in-from-bottom data-[side=left]:data-open:slide-in-from-left data-[side=right]:data-open:slide-in-from-right data-[side=top]:data-open:slide-in-from-top data-closed:animate-out data-closed:duration-300 data-[side=bottom]:data-closed:slide-out-to-bottom data-[side=left]:data-closed:slide-out-to-left data-[side=right]:data-closed:slide-out-to-right data-[side=top]:data-closed:slide-out-to-top motion-reduce:data-open:fade-in-0 motion-reduce:data-closed:fade-out-0",
          onSwipeClose && !vertical && "touch-pan-y",
          onSwipeClose && vertical && "[&_[data-slot=sheet-header]]:touch-none",
          className
        )}
        {...swipeHandlers}
        {...props}
      >
        {onSwipeClose && side === "bottom" && <SheetGrabber />}
        {children}
        {showCloseButton && (
          <SheetPrimitive.Close data-slot="sheet-close" asChild>
            <Button
              variant="ghost"
              className="absolute top-3 end-3"
              size="icon-sm"
            >
              <XIcon
              />
              <span className="sr-only">Close</span>
            </Button>
          </SheetPrimitive.Close>
        )}
      </SheetPrimitive.Content>
    </SheetPortal>
  )
}

/** Where a bottom sheet's swipe may start: its grabber or its header (its body scrolls instead). */
const SHEET_HANDLE = '[data-slot="sheet-grabber"], [data-slot="sheet-header"]'

/**
 * The grabber of a bottom sheet that can be swiped down: a short bar at the top centre that shows the sheet can be
 * dragged (decorative: the close button and Escape close it too).
 * @returns The grabber.
 */
function SheetGrabber() {
  return (
    <div data-slot="sheet-grabber" aria-hidden="true" className="-mb-4 flex h-6 shrink-0 touch-none justify-center pt-2">
      <span className="h-1.5 w-10 rounded-full bg-neutral-300 [corner-shape:round]" />
    </div>
  )
}

/**
 * Layout container for the top of the panel.
 * @param props - <div> props.
 * @returns The header container.
 */
function SheetHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-header"
      className={cn("flex flex-col gap-1.5 p-4", className)}
      {...props}
    />
  )
}

/**
 * Layout container pushed to the bottom of the panel.
 * @param props - <div> props.
 * @returns The footer container.
 */
function SheetFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-footer"
      className={cn("mt-auto flex flex-col gap-2 p-4", className)}
      {...props}
    />
  )
}

/**
 * The sheet's accessible title (required by Radix; may be visually hidden).
 * @param props - Radix Dialog.Title props.
 * @returns The title.
 */
function SheetTitle({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Title>) {
  return (
    <SheetPrimitive.Title
      data-slot="sheet-title"
      className={cn("font-heading font-medium text-foreground", className)}
      {...props}
    />
  )
}

/**
 * Optional longer description, announced after the title.
 * @param props - Radix Dialog.Description props.
 * @returns The description.
 */
function SheetDescription({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Description>) {
  return (
    <SheetPrimitive.Description
      data-slot="sheet-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

export {
  Sheet,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
}
