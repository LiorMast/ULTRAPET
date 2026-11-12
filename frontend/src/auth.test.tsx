/**
 * auth.test.tsx — Tests for the session provider (src/auth.tsx): on load it asks the server who is signed in
 * (the fake API in test/api.ts) and keeps a copy, shows a saved copy at once until the server answers, and shows
 * the visitor as signed out when an API call finds the sign-in gone.
 */
import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchPrices } from '@/api'
import { AuthProvider, useAuth } from '@/auth'
import { fakeFetch, TEST_USER } from '@/test/api'

/** Browser storage key of the saved copy (as in auth.tsx). */
const SESSION_KEY = 'ultrapet.session'

/**
 * Shows who the provider thinks is signed in.
 * @returns The email, or "signed out".
 */
function Probe() {
  const { user } = useAuth()
  return <p>{user ? user.email : 'signed out'}</p>
}

afterEach(() => {
  localStorage.clear()
  sessionStorage.clear()
})

describe('AuthProvider', () => {
  it('asks the server who is signed in and keeps a copy for this browser session', async () => {
    await fakeFetch('/api/auth/login', { method: 'POST', body: JSON.stringify({ email: TEST_USER.email, password: 'secret' }) })
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    )
    expect(await screen.findByText(TEST_USER.email)).toBeInTheDocument()
    expect(JSON.parse(sessionStorage.getItem(SESSION_KEY)!)).toEqual(TEST_USER)
  })

  it('shows the saved copy at once, then drops it when the server says nobody is signed in', async () => {
    localStorage.setItem(SESSION_KEY, JSON.stringify(TEST_USER))
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    )
    expect(screen.getByText(TEST_USER.email)).toBeInTheDocument()
    expect(await screen.findByText('signed out')).toBeInTheDocument()
    expect(localStorage.getItem(SESSION_KEY)).toBeNull()
  })

  it('shows the visitor as signed out when an API call finds the sign-in gone', async () => {
    render(
      <AuthProvider initialUser={TEST_USER}>
        <Probe />
      </AuthProvider>,
    )
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 }))
    await expect(fetchPrices()).rejects.toMatchObject({ status: 401 })
    expect(await screen.findByText('signed out')).toBeInTheDocument()
  })
})
