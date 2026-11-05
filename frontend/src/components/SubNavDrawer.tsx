/**
 * SubNavDrawer.tsx — A second menu bar that slides down out of the header: a row of links under the main
 * row, opened and closed by a toggle button elsewhere in the header. The Navbar uses it for the staff panel's
 * pages (ADMIN_NAV), toggled by the Admin panel button (LoginPopover).
 *
 * useSubNavDrawer() holds the open state and returns the props for both halves: `trigger` for the toggle
 * button (aria-expanded, aria-controls, data-state) and `drawer` for <SubNavDrawer>. The drawer is a disclosure
 * (WAI-ARIA APG "disclosure navigation"), not a dialog: non-modal like the header dropdowns, the page stays
 * usable. It closes when the toggle is pressed again, on Escape (from the toggle or a link) and when a link is
 * chosen; focus then returns to the toggle.
 *
 * Motion: the bar grows and shrinks with a grid-template-rows transition (0fr ↔ 1fr, so it animates to the
 * links' own height) on --ease-spring, while the links fade and settle into place. Transitions, unlike
 * keyframe animations, can be interrupted: pressing the button again mid-way reverses from where the bar is.
 * The exit is quicker than the entrance. Reduced motion keeps the fade and drops the movement (index.css).
 * While closed the bar is `inert`: its links can't be focused, clicked or read by screen readers.
 */
import { useCallback, useId, useRef, useState, type KeyboardEvent, type RefObject } from 'react'
import { Link } from '@tanstack/react-router'
import { cn } from 'cn'
import { NAV_TEXT, Underline } from '@/components/NavText'
import type { NavLink } from '@/config'
import { useI18n } from '@/i18n'

/** The props useSubNavDrawer gives the toggle button (spread them on a <button>). */
export type DrawerTriggerProps = {
  ref: RefObject<HTMLButtonElement | null>
  'aria-expanded': boolean
  'aria-controls': string
  'data-state': 'open' | 'closed'
  onClick: () => void
  onKeyDown: (event: KeyboardEvent<HTMLElement>) => void
}

/** The props useSubNavDrawer gives <SubNavDrawer>. */
type DrawerProps = { id: string; open: boolean; onClose: () => void }

/**
 * The open state of a SubNavDrawer and the props that wire its toggle button to it.
 * @param owner - Who may open the drawer (e.g. the signed-in staff member's email), or null when nobody may
 *   (the drawer is then closed). When the owner changes (sign out, another sign-in), the drawer starts closed.
 * @returns `open`, `trigger` (spread on the toggle button) and `drawer` (spread on <SubNavDrawer>).
 */
export function useSubNavDrawer(owner: string | null): { open: boolean; trigger: DrawerTriggerProps; drawer: DrawerProps } {
  const id = useId()
  const triggerRef = useRef<HTMLButtonElement>(null)
  // Whose drawer is open: tying the state to the owner closes it for the next user without an effect.
  const [openFor, setOpenFor] = useState<string | null>(null)
  const open = owner !== null && openFor === owner

  /**
   * Closes the drawer. When the focus is inside it (a link was chosen, or Escape was pressed there), the focus
   * goes back to the toggle button instead of being lost in the hidden bar.
   */
  const close = useCallback(() => {
    if (document.getElementById(id)?.contains(document.activeElement)) triggerRef.current?.focus()
    setOpenFor(null)
  }, [id])

  /**
   * Opens a closed drawer and closes an open one (the toggle button's click).
   */
  const toggle = () => setOpenFor(open ? null : owner)

  /**
   * Closes the drawer on Escape (the toggle button's key handler).
   * @param event - The keydown event.
   */
  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === 'Escape' && open) close()
  }

  return {
    open,
    trigger: {
      ref: triggerRef,
      'aria-expanded': open,
      'aria-controls': id,
      'data-state': open ? 'open' : 'closed',
      onClick: toggle,
      onKeyDown: handleKeyDown,
    },
    drawer: { id, open, onClose: close },
  }
}

/**
 * The sliding bar of links under the header's main row. Render it inside the <header>, after the main row.
 * @param props.id - The element id the toggle's aria-controls points to (from useSubNavDrawer).
 * @param props.open - Whether the bar is shown.
 * @param props.onClose - Closes the bar (Escape inside it, or a link chosen).
 * @param props.items - The links, in order (e.g. ADMIN_NAV from src/config.ts).
 * @param props.label - The accessible name of the <nav> (e.g. "Admin panel", the toggle's own label).
 * @param props.className - Extra classes for the outer element (e.g. "hidden xl:grid" to show it only where
 *   its toggle is shown).
 * @returns The drawer: a <nav> inside an element that grows to the links' height.
 */
export function SubNavDrawer({
  id,
  open,
  onClose,
  items,
  label,
  className,
}: DrawerProps & { items: NavLink[]; label: string; className?: string }) {
  const { t } = useI18n()
  return (
    <div
      id={id}
      data-state={open ? 'open' : 'closed'}
      inert={!open}
      className={cn(
        'group/drawer grid grid-rows-[0fr] transition-[grid-template-rows] duration-300 data-[state=open]:grid-rows-[1fr] data-[state=open]:duration-500',
        className,
      )}
    >
      <div className="min-h-0 overflow-hidden">
        <nav
          aria-label={label}
          onKeyDown={(event) => {
            if (event.key === 'Escape') onClose()
          }}
          className="mx-auto max-w-screen-2xl -translate-y-3 px-6 opacity-0 transition-[opacity,translate] duration-200 group-data-[state=open]/drawer:translate-y-0 group-data-[state=open]/drawer:opacity-100 group-data-[state=open]/drawer:delay-75 group-data-[state=open]/drawer:duration-500 lg:px-10 xl:px-6 2xl:px-10"
        >
          <ul className="mt-4 flex flex-wrap items-center justify-end gap-x-8 gap-y-3 border-t border-neutral-150 pt-4 pb-1">
            {items.map((item) => (
              <li key={item.id}>
                <Link {...item.link} onClick={onClose} className={NAV_TEXT}>
                  {item.label(t)}
                  <Underline />
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </div>
  )
}
