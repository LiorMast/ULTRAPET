/**
 * useMediaQuery.ts — Hooks that follow a CSS media query in JavaScript, for components whose structure (not only their
 * styles) changes with it: useMediaQuery (any query; PHONE_QUERY = a phone, below Tailwind's md) and useReducedMotion
 * (the visitor's "reduce motion" setting). Used by Hero and Stats (no autoplay, no count-up with reduced motion), and by
 * the components that turn into their phone form below md (Carousel's swipe row, the product gallery's swipe strip,
 * the Where to Buy list/map switch, the catalog's filter sheets, manage mode's action sheet).
 */
import { useSyncExternalStore } from 'react'

/** A phone: narrower than Tailwind's md breakpoint (48rem = 768px), where components take their phone form. */
export const PHONE_QUERY = '(width < 48rem)'

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)'

/**
 * Tracks whether a media query matches, updating live when it changes (a window resized, a setting changed).
 * @param query - The media query, e.g. PHONE_QUERY.
 * @returns true while it matches (false where there is no window).
 */
export function useMediaQuery(query: string) {
  return useSyncExternalStore(
    (notify) => {
      const list = window.matchMedia(query)
      list.addEventListener('change', notify)
      return () => list.removeEventListener('change', notify)
    },
    () => window.matchMedia(query).matches,
    () => false,
  )
}

/**
 * Tracks the visitor's "reduce motion" system setting, updating live when it changes.
 * @returns true when the visitor asked for reduced motion.
 */
export function useReducedMotion() {
  return useMediaQuery(REDUCED_MOTION_QUERY)
}
