/**
 * router.test.tsx — Tests for the router's loading feedback and page changes (src/router.ts, routes/__root.tsx): a
 * slow navigation keeps the current page, marks <main> busy and runs the progress bar until the data arrives; a failed
 * load shows LoadError, whose "Try again" spins while the loaders run again and asks once however often it is
 * clicked; and a new path cross-fades through a view transition while a change of only the search does not.
 */
import { screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { fakeFetch, holdRequests } from '@/test/api'
import { renderPage } from '@/test/utils'

/** The navigation progress bar (decorative, so found by its classes). */
const progressBar = () => document.querySelector('[aria-hidden="true"].fixed.top-0')

describe('navigation feedback', () => {
  it('keeps the page, marks <main> busy and runs the progress bar while the next page loads', async () => {
    const { router } = await renderPage('/en')
    const held = holdRequests((path) => path === '/api/articles')
    const main = screen.getByRole('main')
    expect(main).not.toHaveAttribute('aria-busy')
    expect(progressBar()).not.toHaveAttribute('data-active')

    void router.navigate({ to: '/articles' })
    await waitFor(() => expect(held.calls).toEqual(['GET /api/articles']))
    await waitFor(() => expect(main).toHaveAttribute('aria-busy', 'true'))
    expect(progressBar()).toHaveAttribute('data-active')
    // The home page is still shown while the articles load.
    expect(document.getElementById('stats')).not.toBeNull()

    held.release()
    expect(await screen.findByRole('heading', { level: 1, name: 'Pet care guides and tips' })).toBeInTheDocument()
    expect(main).not.toHaveAttribute('aria-busy')
    expect(progressBar()).not.toHaveAttribute('data-active')
  })
})

describe('LoadError', () => {
  it('shows "Try again" busy while the loaders run again, asks once, then shows the page', async () => {
    let failing = true
    let answerRetry: () => void = () => {}
    const articleCalls: string[] = []
    vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
      if (String(input) !== '/api/articles') return fakeFetch(input, init)
      articleCalls.push('GET')
      if (failing) return Promise.resolve(new Response('{}', { status: 500 }))
      return new Promise<Response>((resolve) => (answerRetry = () => void fakeFetch(input, init).then(resolve)))
    })
    const { user } = await renderPage('/en/articles')
    expect(await screen.findByRole('heading', { name: "We couldn't load this page" })).toBeInTheDocument()

    failing = false
    const before = articleCalls.length
    const retry = screen.getByRole('button', { name: 'Try again' })
    await user.click(retry)
    expect(retry).toHaveAttribute('aria-busy', 'true')
    await user.click(retry)
    await user.click(retry)
    expect(articleCalls.length - before).toBe(1)

    answerRetry()
    expect(await screen.findByRole('heading', { level: 1, name: 'Pet care guides and tips' })).toBeInTheDocument()
  })
})

describe('view transitions', () => {
  afterEach(() => {
    delete (document as { startViewTransition?: unknown }).startViewTransition
    vi.unstubAllGlobals()
  })

  /**
   * Installs a fake document.startViewTransition that runs the update at once, and a CSS.supports that knows
   * view transition types (as Chrome does).
   * @returns The spy of startViewTransition.
   */
  function fakeViewTransitions() {
    vi.stubGlobal('CSS', { supports: () => true })
    const start = vi.fn((options: (() => unknown) | { update: () => unknown; types?: string[] }) => {
      const update = typeof options === 'function' ? options : options.update
      const done = Promise.resolve(update())
      return { updateCallbackDone: done, finished: done, ready: Promise.resolve(), skipTransition: () => {} }
    })
    Object.assign(document, { startViewTransition: start })
    return start
  }

  it('cross-fades to a new page, but not when only the search changes', async () => {
    const { router } = await renderPage('/en/catalog')
    const start = fakeViewTransitions()

    await router.navigate({ to: '/catalog', search: { q: 'cat' } })
    await waitFor(() => expect(router.state.location.search).toEqual({ q: 'cat' }))
    expect(start).not.toHaveBeenCalled()

    await router.navigate({ to: '/where-to-buy' })
    await waitFor(() => expect(router.state.location.pathname).toBe('/where-to-buy'))
    expect(start).toHaveBeenCalledTimes(1)
    expect(start.mock.calls[0][0]).toMatchObject({ types: ['page'] })
  })

  it('navigates normally where the browser has no view transitions', async () => {
    const { router } = await renderPage('/en')
    await router.navigate({ to: '/where-to-buy' })
    await waitFor(() => expect(router.state.location.pathname).toBe('/where-to-buy'))
    expect(screen.getByRole('main')).toBeInTheDocument()
  })
})
