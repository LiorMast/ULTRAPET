/**
 * api.test.ts — Tests for the API layer (src/api.ts): the catalog query string, the CSRF header on unsafe
 * methods only, one shared refresh and a retry when the access token expired, the signed-out handler when the
 * sign-in is gone (but not for a wrong password), the staff refresh route, error codes and fields, and an API
 * 404 becoming the router's not-found.
 */
import { isNotFound } from '@tanstack/react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError, fetchPrices, fetchProducts, fetchStaffRows, postSignIn, postSignOut, rethrowNotFound, setSignedOutHandler, updateStaffRow } from '@/api'

/**
 * Builds a JSON answer.
 * @param status - The HTTP status.
 * @param body - The JSON body, if any.
 * @returns The response.
 */
const reply = (status: number, body?: unknown) => new Response(body === undefined ? null : JSON.stringify(body), { status })

/** The prices answer used by the refresh tests. */
const PRICES = { currency: 'ILS', prices: { 'product-1': 12.5 } }

/**
 * The headers of one recorded fetch call.
 * @param call - The spy's call arguments.
 * @returns The headers object passed to fetch.
 */
const headersOf = (call: Parameters<typeof fetch>) => call[1]?.headers as Record<string, string>

afterEach(() => {
  for (const name of ['csrf_access_token', 'csrf_refresh_token']) document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT`
  setSignedOutHandler(null)
})

describe('api', () => {
  it('builds the products query from the catalog state', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    await fetchProducts({ category: 'birds', q: 'seed mix', page: 2 })
    await fetchProducts({ page: 1 })
    expect(fetchSpy.mock.calls.map(([url]) => url)).toEqual(['/api/products?category=birds&q=seed+mix&page=2', '/api/products'])
  })

  it('sends the CSRF cookie as a header on POST, never on GET', async () => {
    document.cookie = 'csrf_access_token=abc-123'
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(reply(204)).mockResolvedValueOnce(reply(200, PRICES))
    await postSignOut()
    await fetchPrices()
    expect(headersOf(fetchSpy.mock.calls[0])['X-CSRF-TOKEN']).toBe('abc-123')
    expect(headersOf(fetchSpy.mock.calls[1])['X-CSRF-TOKEN']).toBeUndefined()
  })

  it('refreshes an expired sign-in once for calls that fail together, then retries them', async () => {
    document.cookie = 'csrf_refresh_token=refresh-1'
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(reply(401, { error: 'token_expired' }))
      .mockResolvedValueOnce(reply(401, { error: 'token_expired' }))
      .mockResolvedValueOnce(reply(204))
      .mockImplementation(async () => reply(200, PRICES))
    const signedOut = vi.fn()
    setSignedOutHandler(signedOut)

    const [first, second] = await Promise.all([fetchPrices(), fetchPrices()])
    expect([first, second]).toEqual([PRICES, PRICES])
    const refreshes = fetchSpy.mock.calls.filter(([url]) => url === '/api/auth/refresh')
    expect(refreshes).toHaveLength(1)
    expect(headersOf(refreshes[0])['X-CSRF-TOKEN']).toBe('refresh-1')
    expect(fetchSpy).toHaveBeenCalledTimes(5)
    expect(signedOut).not.toHaveBeenCalled()
  })

  it('refreshes an expired staff sign-in at the staff route', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(reply(401, { error: 'token_expired' }))
      .mockResolvedValueOnce(reply(204))
      .mockResolvedValueOnce(reply(200, []))
    await expect(fetchStaffRows('brands')).resolves.toEqual([])
    expect(fetchSpy.mock.calls.map(([url]) => url)).toEqual(['/api/staff/brands', '/api/staff/auth/refresh', '/api/staff/brands'])
  })

  it('keeps the field and constraint of a refused change', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(reply(409, { error: 'duplicate', constraint: 'brands_slug_key' }))
    await expect(updateStaffRow('brands', 'id-1', { slug: 'paw' })).rejects.toMatchObject({
      status: 409,
      code: 'duplicate',
      constraint: 'brands_slug_key',
    })
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(reply(400, { error: 'required', field: 'name' }))
    await expect(updateStaffRow('brands', 'id-1', { name: null })).rejects.toMatchObject({ code: 'required', field: 'name' })
  })

  it('tells the signed-out handler when the refresh fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(reply(401, { error: 'token_expired' })).mockResolvedValueOnce(reply(401, { error: 'token_expired' }))
    const signedOut = vi.fn()
    setSignedOutHandler(signedOut)
    await expect(fetchPrices()).rejects.toMatchObject({ status: 401, code: 'token_expired' })
    expect(signedOut).toHaveBeenCalledOnce()
  })

  it('does not treat a wrong password as a lost sign-in', async () => {
    const signedOut = vi.fn()
    setSignedOutHandler(signedOut)
    const error = await postSignIn({ email: 'a@b.co', password: 'wrong-password', remember: false }).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ status: 401, code: 'invalid_credentials' })
    expect(signedOut).not.toHaveBeenCalled()
  })

  it("turns an API 404 into the router's not-found and rethrows other errors", () => {
    /**
     * Runs rethrowNotFound and catches what it throws.
     * @param error - The error to pass in.
     * @returns What rethrowNotFound threw.
     */
    const thrown = (error: unknown) => {
      try {
        rethrowNotFound(error)
      } catch (caught) {
        return caught
      }
    }
    expect(isNotFound(thrown(new ApiError(404, { error: 'not_found' })))).toBe(true)
    const serverError = new ApiError(500)
    expect(thrown(serverError)).toBe(serverError)
  })
})
