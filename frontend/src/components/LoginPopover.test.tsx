/**
 * LoginPopover.test.tsx — Tests for the header login popover and its LoginForm: opening, fields, validation,
 * remember-me, signing in and out from the header through the API (the fake in test/api.ts; the login button
 * turns into Log out, staff also get an Admin panel button), the "wrong email or password" and "try again"
 * alerts, Escape, and the /login page showing the same form (and the account panel once signed in).
 */
import { fireEvent, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { LoginForm } from '@/components/LoginForm'
import { TEST_STAFF, TEST_USER, WRONG_PASSWORD } from '@/test/api'
import { renderComponent, renderPage } from '@/test/utils'

describe('Login popover', () => {
  it('opens from the header button with email, password and remember me (English)', async () => {
    await renderPage('/en')
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Login' }))
    const dialog = await screen.findByRole('dialog', { name: 'Sign in to Ultra Pet' })
    expect(within(dialog).getByLabelText('Email')).toHaveAttribute('type', 'email')
    expect(within(dialog).getByLabelText('Password')).toHaveAttribute('type', 'password')
    expect(within(dialog).getByRole('checkbox', { name: 'Remember me' })).not.toBeChecked()
    expect(within(dialog).getByRole('link', { name: 'Open a business account' })).toHaveAttribute('href', '/en#business')
  })

  it('uses Hebrew texts and closes with Escape', async () => {
    await renderPage('/')
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'התחברות' }))
    const dialog = await screen.findByRole('dialog', { name: 'כניסה לאולטרה פט' })
    expect(within(dialog).getByLabelText('סיסמה')).toBeInTheDocument()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('shows validation errors for empty and malformed input', async () => {
    renderComponent(<LoginForm />, 'en')
    fireEvent.change(await screen.findByLabelText('Email'), { target: { value: 'nope' } })
    fireEvent.click(screen.getByRole('button', { name: 'Log in' }))
    expect(screen.getByText('Invalid email address')).toBeInTheDocument()
    expect(screen.getByText('Required field')).toBeInTheDocument()
    expect(screen.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true')
  })

  it('passes the values (with remember me) to onSubmit', async () => {
    const onSubmit = vi.fn()
    renderComponent(<LoginForm onSubmit={onSubmit} />, 'en')
    fireEvent.change(await screen.findByLabelText('Email'), { target: { value: 'a@b.co' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'secret' } })
    fireEvent.click(screen.getByRole('checkbox', { name: 'Remember me' }))
    fireEvent.click(screen.getByRole('button', { name: 'Log in' }))
    expect(onSubmit).toHaveBeenCalledWith({ email: 'a@b.co', password: 'secret', remember: true })
  })

  it('signs in and confirms it when no onSubmit is given', async () => {
    renderComponent(<LoginForm />, 'en')
    fireEvent.change(await screen.findByLabelText('Email'), { target: { value: 'a@b.co' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'secret' } })
    fireEvent.click(screen.getByRole('button', { name: 'Log in' }))
    expect(await screen.findByRole('status')).toHaveTextContent('You are signed in.')
  })

  it('shows "wrong email or password" when the server refuses the sign-in', async () => {
    renderComponent(<LoginForm />, 'en')
    fireEvent.change(await screen.findByLabelText('Email'), { target: { value: 'a@b.co' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: WRONG_PASSWORD } })
    fireEvent.click(screen.getByRole('button', { name: 'Log in' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Wrong email or password.')
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('asks to try again when the server cannot be reached (Hebrew)', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'))
    renderComponent(<LoginForm />)
    fireEvent.change(await screen.findByLabelText('דוא"ל'), { target: { value: 'a@b.co' } })
    fireEvent.change(screen.getByLabelText('סיסמה'), { target: { value: 'secret' } })
    fireEvent.click(screen.getByRole('button', { name: 'התחברות' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('ההתחברות נכשלה. נסו שוב בעוד רגע.')
  })

  it('signs in from the header, then the login button becomes Log out', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    const { user } = await renderPage('/en')
    await user.click(screen.getByRole('button', { name: 'Login' }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByLabelText('Email'), 'shop@example.com')
    await user.type(within(dialog).getByLabelText('Password'), 'secret')
    await user.click(within(dialog).getByRole('button', { name: 'Log in' }))
    expect(fetchSpy).toHaveBeenCalledWith('/api/auth/login', expect.objectContaining({ method: 'POST', body: JSON.stringify({ email: 'shop@example.com', password: 'secret', remember: false }) }))

    const logout = await within(screen.getByRole('banner')).findByRole('button', { name: 'Sign out' })
    expect(within(screen.getByRole('banner')).queryByRole('button', { name: 'Login' })).not.toBeInTheDocument()
    expect(within(screen.getByRole('banner')).queryByRole('link', { name: 'Admin panel' })).not.toBeInTheDocument()

    await user.click(logout)
    expect(await within(screen.getByRole('banner')).findByRole('button', { name: 'Login' })).toBeInTheDocument()
    expect(fetchSpy).toHaveBeenCalledWith('/api/auth/logout', expect.objectContaining({ method: 'POST' }))
  })

  it('shows staff an Admin panel button next to Log out', async () => {
    const { user } = await renderPage('/en')
    await user.click(screen.getByRole('button', { name: 'Login' }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByLabelText('Email'), TEST_STAFF.email)
    await user.type(within(dialog).getByLabelText('Password'), 'secret')
    await user.click(within(dialog).getByRole('button', { name: 'Log in' }))
    const header = within(screen.getByRole('banner'))
    expect(await header.findByRole('link', { name: 'Admin panel' })).toHaveAttribute('href', '/en/admin')
    expect(header.getByRole('button', { name: 'Sign out' })).toBeInTheDocument()
  })

  it('shows the same form on the /login page', async () => {
    await renderPage('/en/login')
    expect(screen.getByRole('heading', { level: 1, name: 'Sign in to Ultra Pet' })).toBeInTheDocument()
    expect(screen.getByLabelText('Password')).toBeInTheDocument()
  })

  it('shows the account panel on the /login page when signed in', async () => {
    await renderPage('/login', { user: TEST_USER })
    expect(screen.getByRole('heading', { level: 1, name: 'החשבון שלי' })).toBeInTheDocument()
    expect(within(screen.getByRole('main')).getByRole('button', { name: 'התנתקות' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'לוח ניהול' })).not.toBeInTheDocument()
  })

  it('offers staff the admin panel on the /login page', async () => {
    await renderPage('/en/login', { staff: TEST_STAFF })
    expect(within(screen.getByRole('main')).getByRole('link', { name: 'Admin panel' })).toHaveAttribute('href', '/en/admin')
  })
})
