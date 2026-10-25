/**
 * test/setup.ts — Runs before every Vitest test file (configured in vite.config.ts).
 *
 * - Adds the jest-dom matchers (toBeInTheDocument, toHaveAttribute, ...).
 * - Unmounts whatever a test rendered, so tests don't leak into each other.
 * - Adds browser APIs that jsdom lacks but Radix UI and TanStack Router call:
 *   ResizeObserver, scrollIntoView, pointer capture, window.scrollTo and matchMedia (no-ops here).
 */
import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

afterEach(() => cleanup())

/** Minimal ResizeObserver: jsdom has none, and Radix only needs the API to exist. */
class ResizeObserverStub {
  /** No-op: nothing is measured in jsdom. */
  observe() {}
  /** No-op. */
  unobserve() {}
  /** No-op. */
  disconnect() {}
}

globalThis.ResizeObserver ??= ResizeObserverStub
Element.prototype.scrollIntoView ??= () => {}
Element.prototype.hasPointerCapture ??= () => false
Element.prototype.setPointerCapture ??= () => {}
Element.prototype.releasePointerCapture ??= () => {}
window.scrollTo = () => {}
// jsdom has no matchMedia. This stub reports "no match" for every query (so, for example, motion is
// not reduced); a test can replace window.matchMedia to simulate a different preference.
window.matchMedia ??= (query: string) =>
  ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }) as MediaQueryList
