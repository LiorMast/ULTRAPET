/**
 * auth.tsx — Who is signed in: the business-customer session for the whole site.
 *
 * AuthProvider holds the session and useAuth() gives components `user`, `signIn` and `signOut`. Used by
 * LoginForm (signs in), LoginPopover and the /login page (show the account, sign out) and the catalog
 * (shows prices only to a signed-in customer).
 *
 * The sign-in itself lives on the server: JWTs in HttpOnly cookies that scripts cannot read (see src/api.ts
 * and backend/app/auth.py). signIn posts the credentials, signOut asks the server to expire the cookies, and
 * on every page load the provider asks the server who is signed in. Browser storage keeps only a copy of the
 * user ("remember me" → localStorage, else sessionStorage) so the header shows the account at once instead of
 * flickering; the server's answer replaces it. When the API reports the sign-in gone (expired, revoked), the
 * provider shows the visitor as signed out.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { fetchSession, postSignIn, postSignOut, setSignedOutHandler, type User } from '@/api'

/** What signIn receives: the login form's values. */
export type Credentials = { email: string; password: string; remember: boolean }

type AuthValue = { user: User | null; signIn: (credentials: Credentials) => Promise<User>; signOut: () => void }

/** Browser storage key of the saved copy of the user. */
const SESSION_KEY = 'ultrapet.session'

/**
 * Reads the saved copy of the user, from either storage. Storage can be blocked (private mode, tests), so
 * every access is guarded.
 * @returns The saved user and whether it was remembered (localStorage), or null when there is none.
 */
function readSession(): { user: User; remember: boolean } | null {
  for (const storage of ['localStorage', 'sessionStorage'] as const) {
    try {
      const saved = window[storage].getItem(SESSION_KEY)
      if (saved) return { user: JSON.parse(saved) as User, remember: storage === 'localStorage' }
    } catch {
      // Storage unavailable or corrupt: treat as signed out.
    }
  }
  return null
}

/**
 * Saves or clears the copy of the user in browser storage.
 * @param user - The user to save, or null to clear both storages.
 * @param remember - true = localStorage (kept after the browser closes), false = sessionStorage.
 */
function writeSession(user: User | null, remember = false) {
  for (const storage of ['localStorage', 'sessionStorage'] as const) {
    try {
      window[storage].removeItem(SESSION_KEY)
      if (user && (storage === 'localStorage') === remember) window[storage].setItem(SESSION_KEY, JSON.stringify(user))
    } catch {
      // Storage unavailable: the copy then lasts only for this page load.
    }
  }
}

const AuthContext = createContext<AuthValue | null>(null)

/**
 * Provides the session to the app.
 * @param props.initialUser - Start as this user and skip asking the server (tests); by default the saved copy
 *   is shown and the server is asked.
 * @param props.children - The app.
 * @returns The provider wrapping the children.
 */
export function AuthProvider({ initialUser, children }: { initialUser?: User | null; children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => (initialUser !== undefined ? initialUser : (readSession()?.user ?? null)))

  useEffect(() => {
    setSignedOutHandler(() => {
      writeSession(null)
      setUser(null)
    })
    return () => setSignedOutHandler(null)
  }, [])

  useEffect(() => {
    if (initialUser !== undefined) return
    let cancelled = false
    fetchSession().then(
      (current) => {
        if (cancelled) return
        writeSession(current, readSession()?.remember)
        setUser(current)
      },
      // Network or server error: keep the saved copy until the next page load.
      () => undefined,
    )
    return () => {
      cancelled = true
    }
  }, [initialUser])

  /**
   * Signs a customer in on the server.
   * @param credentials - Email, password and "remember me".
   * @returns The signed-in user; rejects with ApiError 401 "invalid_credentials" for a wrong email or password.
   */
  const signIn = useCallback(async (credentials: Credentials) => {
    const signedIn = await postSignIn({ ...credentials, email: credentials.email.trim() })
    writeSession(signedIn, credentials.remember)
    setUser(signedIn)
    return signedIn
  }, [])

  /** Signs the customer out: forgets the user at once and asks the server to expire the cookies. */
  const signOut = useCallback(() => {
    writeSession(null)
    setUser(null)
    postSignOut().catch(() => undefined)
  }, [])

  const value = useMemo(() => ({ user, signIn, signOut }), [user, signIn, signOut])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

/**
 * Gives a component the session.
 * @returns `user` (null when signed out), `signIn(credentials)` and `signOut()`.
 */
export function useAuth(): AuthValue {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth must be used inside <AuthProvider>')
  return value
}
