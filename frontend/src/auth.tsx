/**
 * auth.tsx — Who is signed in (a business customer or a staff member): the session for the whole site.
 *
 * AuthProvider holds the session and useAuth() gives components `user` (its `kind` tells a customer from a
 * staff member), `signIn` and `signOut`; useSignOut() is the Sign out buttons' action (signs out and confirms it in a
 * toast). Used by LoginForm (signs in), LoginPopover, MobileMenu and the /login
 * page (log out, the admin link for staff), the catalog and product pages (useCustomerPrices: prices and stock
 * statuses only for a signed-in customer) and the /admin layout (the panel only for staff).
 *
 * The sign-in itself lives on the server: JWTs in HttpOnly cookies that scripts cannot read (see src/api.ts
 * and backend/app/auth.py). signIn posts the credentials, signOut asks the server to expire the cookies, and
 * on every page load the provider asks the server who is signed in. Browser storage keeps only a copy of the
 * user ("remember me" → localStorage, else sessionStorage) so the header shows the account at once instead of
 * flickering; the server's answer replaces it. When the API reports the sign-in gone (expired, revoked), the
 * provider shows the visitor as signed out.
 *
 * Manage mode (the staff's management layer on the catalog and product pages, ProductManager.tsx): useManage() tells
 * a page whether to show it (a staff member is signed in and turned the "Manage products" switch on); route loaders
 * read the switch with readManageMode() (the server still answers its extra data only to staff). The switch is kept
 * in localStorage (`ultrapet.manage`), so it survives page loads, and either way of ending the session turns it off,
 * so the next person on the browser starts in the customer view. The staff data it shows is in manage.ts.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import { useRouter } from '@tanstack/react-router'
import { fetchPrices, fetchSession, postSignIn, postSignOut, setSignedOutHandler, type StockStatus, type User } from '@/api'
import { useI18n } from '@/i18n'
import { clearProductAdmin } from '@/manage'
import { useToast } from '@/toast'

/** What signIn receives: the login form's values. */
export type Credentials = { email: string; password: string; remember: boolean }

/**
 * A signed-in customer's prices: `loading` while they arrive, then a map of product id → price in shekels, and the
 * stock status of the tracked products (product id → StockStatus; an untracked product is not in it).
 */
export type CustomerPrices = { status: 'loading' } | { status: 'loaded'; prices: Record<string, number>; stock: Record<string, StockStatus> }

type AuthValue = { user: User | null; signIn: (credentials: Credentials) => Promise<User>; signOut: () => Promise<void> }

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

/** Browser storage key of the manage mode switch ("1" = on). */
const MANAGE_KEY = 'ultrapet.manage'

/**
 * Reads the stored manage mode switch; blocked storage counts as off.
 * @returns Whether manage mode was left on.
 */
function readStoredManage(): boolean {
  try {
    return window.localStorage.getItem(MANAGE_KEY) === '1'
  } catch {
    return false
  }
}

let manageFlag = readStoredManage()
const manageListeners = new Set<() => void>()

/**
 * Whether the manage mode switch is on, for route loaders (outside React). The server still decides: only a staff
 * sign-in gets the inactive products and the staff rows.
 * @returns The switch.
 */
export function readManageMode(): boolean {
  return manageFlag
}

/**
 * Turns manage mode on or off, remembers it in the browser and rerenders the components that follow it (useManage).
 * The cached staff data is dropped, so the next load reads it fresh; the pages reload through useManageReload.
 * @param on - The new state.
 */
export function setManageMode(on: boolean) {
  clearProductAdmin()
  if (manageFlag === on) return
  manageFlag = on
  try {
    if (on) window.localStorage.setItem(MANAGE_KEY, '1')
    else window.localStorage.removeItem(MANAGE_KEY)
  } catch {
    // Storage unavailable: the switch then lasts only for this page load.
  }
  for (const listener of manageListeners) listener()
}

/**
 * Subscribes a component to the manage mode switch (useSyncExternalStore).
 * @param listener - Called after every change.
 * @returns The unsubscribe function.
 */
function subscribeManage(listener: () => void) {
  manageListeners.add(listener)
  return () => {
    manageListeners.delete(listener)
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
      setManageMode(false)
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
   * Signs a customer or a staff member in on the server.
   * @param credentials - Email, password and "remember me".
   * @returns The signed-in user; rejects with ApiError 401 "invalid_credentials" for a wrong email or password.
   */
  const signIn = useCallback(async (credentials: Credentials) => {
    const signedIn = await postSignIn({ ...credentials, email: credentials.email.trim() })
    writeSession(signedIn, credentials.remember)
    setUser(signedIn)
    return signedIn
  }, [])

  /**
   * Signs the user out: forgets the user at once and asks the server to expire the cookies.
   * @returns Resolves when the server answered (or could not be reached), so callers can reload data after it.
   */
  const signOut = useCallback(async () => {
    writeSession(null)
    setManageMode(false)
    setUser(null)
    await postSignOut().catch(() => undefined)
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

/**
 * The action of every Sign out button (header, mobile menu, /login): confirms in a toast, then signs out. The toast
 * comes first, so a warning that signing out causes (an in-place edit's unsaved changes dropped) replaces it.
 * @returns A function that signs the user out.
 */
export function useSignOut(): () => void {
  const { signOut } = useAuth()
  const toast = useToast()
  const { t } = useI18n()
  return useCallback(() => {
    toast.success(t.login.signedOut)
    void signOut()
  }, [signOut, toast, t])
}

/**
 * Loads the signed-in business customer's prices and the stock statuses (staff and visitors have none). Used by the
 * pages that show products (the catalog, a product page); reloads when another customer signs in.
 * @returns undefined when no customer is signed in, `loading` until the prices arrive, then the prices and statuses.
 */
export function useCustomerPrices(): CustomerPrices | undefined {
  const { user: signedIn } = useAuth()
  const user = signedIn?.kind === 'business' ? signedIn : null
  const [loaded, setLoaded] = useState<{ email: string; prices: Record<string, number>; stock: Record<string, StockStatus> } | null>(null)

  useEffect(() => {
    if (!user) return
    let cancelled = false
    fetchPrices().then(
      ({ prices, stock }) => {
        if (!cancelled) setLoaded({ email: user.email, prices, stock })
      },
      // A lost sign-in signs the visitor out (api.ts); other failures leave the prices loading.
      () => undefined,
    )
    return () => {
      cancelled = true
    }
  }, [user])

  // Prices belong to the customer they were loaded for; anything else is still loading (or signed out).
  if (!user) return undefined
  return loaded?.email === user.email ? { status: 'loaded', prices: loaded.prices, stock: loaded.stock } : { status: 'loading' }
}

/**
 * The staff's manage mode for a page.
 * @returns `available` (a staff member is signed in: show the "Manage products" switch), `on` (show the management
 *   layer: available and the switch is on) and `setOn` (setManageMode).
 */
export function useManage(): { available: boolean; on: boolean; setOn: (on: boolean) => void } {
  const { user } = useAuth()
  const flag = useSyncExternalStore(subscribeManage, readManageMode, () => false)
  const available = user?.kind === 'staff'
  return { available, on: available && flag, setOn: setManageMode }
}

/**
 * Reloads the page's route data when manage mode turns on or off (the switch, or a staff member signing in or out),
 * since the loaders then ask for other data (the inactive products, the staff rows). Used by the pages that show
 * products: the catalog, a product page, a brand page.
 */
export function useManageReload() {
  const { on } = useManage()
  const router = useRouter()
  const shown = useRef(on)
  useEffect(() => {
    if (shown.current === on) return
    shown.current = on
    void router.invalidate()
  }, [on, router])
}
