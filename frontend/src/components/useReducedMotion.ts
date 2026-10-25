/**
 * useReducedMotion.ts — Hook that reports the visitor's "reduce motion" system setting.
 * Used by Hero (no autoplay) and Stats (no count-up animation).
 */
import { useSyncExternalStore } from 'react'

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)'

/**
 * Tracks the visitor's "reduce motion" system setting, updating live when it changes.
 * @returns true when the visitor asked for reduced motion.
 */
export function useReducedMotion() {
  return useSyncExternalStore(
    (notify) => {
      const query = window.matchMedia(REDUCED_MOTION_QUERY)
      query.addEventListener('change', notify)
      return () => query.removeEventListener('change', notify)
    },
    () => window.matchMedia(REDUCED_MOTION_QUERY).matches,
    () => false,
  )
}
