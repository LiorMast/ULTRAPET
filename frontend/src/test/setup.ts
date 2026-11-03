/**
 * test/setup.ts — Runs before every Vitest test file (configured in vite.config.ts).
 *
 * - Adds the jest-dom matchers (toBeInTheDocument, toHaveAttribute, ...).
 * - Answers the site's API calls with the fake backend in test/api.ts (fetch), built from the stub fixtures.
 * - Unmounts whatever a test rendered, restores mocked functions and signs the fake API out, so tests don't
 *   leak into each other.
 * - Adds browser APIs that jsdom lacks but Radix UI and TanStack Router call:
 *   ResizeObserver, scrollIntoView, pointer capture, window.scrollTo and matchMedia (no-ops here).
 * - Keeps the event properties that user-event sets (relatedTarget, ...) redefinable, as they are in browsers,
 *   because DataTables (DataTable.tsx) redefines them on the events it handles.
 */
import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'
import { fakeFetch, resetFakeApi } from '@/test/api'

globalThis.fetch = fakeFetch

// user-event adds properties to its events with Object.defineProperty, which makes them non-configurable;
// in a browser they live on the event's prototype, and DataTables redefines them on the event itself. Defining
// them configurable keeps DataTables' event handlers working under user-event.
// `Event` is kept here because jsdom removes its globals while the test environment is torn down.
const defineProperty = Object.defineProperty
const DomEvent = Event
Object.defineProperty = <T,>(target: T, key: PropertyKey, descriptor: PropertyDescriptor & ThisType<unknown>): T =>
  defineProperty(target, key, target instanceof DomEvent && descriptor.configurable === undefined ? { ...descriptor, configurable: true } : descriptor)

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  resetFakeApi()
})

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
