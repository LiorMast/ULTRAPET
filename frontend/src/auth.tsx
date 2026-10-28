/**
 * auth.tsx — Who is signed in: the business-customer session for the whole site.
 *
 * AuthProvider holds the session and useAuth() gives components `user`, `signIn` and `signOut`. Used by
 * LoginForm (signs in), LoginPopover and the /login page (show the account, sign out) and the catalog
 * (shows prices only to a signed-in customer).
 *
 * STUB until the B2B portal (Phase 4): any valid email and password signs in, nothing is checked against a
 * server. The session lives in localStorage with "remember me" (survives a browser restart) and in
 * sessionStorage without it. The real sign-in call replaces the body of `signIn`; the interface stays.
 */
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'

/** A signed-in business customer. */
export type User = { email: string }

/** What signIn receives: the login form's values. */
export type Credentials = { email: string; password: string; remember: boolean }

type AuthValue = { user: User | null; signIn: (credentials: Credentials) => Promise<User>; signOut: () => void }

/** Browser storage key of the stub session. */
const SESSION_KEY = 'ultrapet.session'

/**
 * Reads the saved session, from either storage. Storage can be blocked (private mode, tests), so every
 * access is guarded.
 * @returns The saved user, or null when there is none.
 */
function readSession(): User | null {
  for (const storage of ['localStorage', 'sessionStorage'] as const) {
    try {
      const saved = window[storage].getItem(SESSION_KEY)
      if (saved) return JSON.parse(saved) as User
    } catch {
      // Storage unavailable or corrupt: treat as signed out.
    }
  }
  return null
}

/**
 * Saves or clears the session in browser storage.
 * @param user - The user to save, or null to clear both storages.
 * @param remember - true = localStorage (kept after the browser closes), false = sessionStorage.
 */
function writeSession(user: User | null, remember = false) {
  for (const storage of ['localStorage', 'sessionStorage'] as const) {
    try {
      window[storage].removeItem(SESSION_KEY)
      if (user && (storage === 'localStorage') === remember) window[storage].setItem(SESSION_KEY, JSON.stringify(user))
    } catch {
      // Storage unavailable: the session then lasts only for this page load.
    }
  }
}

const AuthContext = createContext<AuthValue | null>(null)

/**
 * Provides the session to the app.
 * @param props.initialUser - Start signed in as this user (tests); by default the saved session is used.
 * @param props.children - The app.
 * @returns The provider wrapping the children.
 */
export function AuthProvider({ initialUser, children }: { initialUser?: User | null; children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => (initialUser !== undefined ? initialUser : readSession()))

  /**
   * Signs a customer in (stub: accepts any credentials the form has validated).
   * @param credentials - Email, password and "remember me".
   * @returns The signed-in user.
   */
  const signIn = useCallback(async ({ email, remember }: Credentials) => {
    const signedIn = { email: email.trim() }
    writeSession(signedIn, remember)
    setUser(signedIn)
    return signedIn
  }, [])

  /** Signs the customer out and forgets the saved session. */
  const signOut = useCallback(() => {
    writeSession(null)
    setUser(null)
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
