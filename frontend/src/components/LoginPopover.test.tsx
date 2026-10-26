/**
 * LoginPopover.test.tsx — Tests for the header login popover and its LoginForm: opening, fields, validation,
 * remember-me, the "coming soon" note, Escape, and the /login page showing the same form.
 */
import { fireEvent, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { LoginForm } from '@/components/LoginForm'
import { renderComponent, renderPage } from '@/test/utils'

describe('Login popover', () => {
  it('opens from the header button with email, password and remember me (English)', async () => {
    await renderPage('/en')
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Login' }))
    const dialog = await screen.findByRole('dialog', { name: 'Business customer login' })
    expect(within(dialog).getByLabelText('Email')).toHaveAttribute('type', 'email')
    expect(within(dialog).getByLabelText('Password')).toHaveAttribute('type', 'password')
    expect(within(dialog).getByRole('checkbox', { name: 'Remember me' })).not.toBeChecked()
    expect(within(dialog).getByRole('link', { name: 'Open a business account' })).toHaveAttribute('href', '/en#business')
  })

  it('uses Hebrew texts and closes with Escape', async () => {
    await renderPage('/')
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'התחברות' }))
    const dialog = await screen.findByRole('dialog', { name: 'כניסה ללקוחות עסקיים' })
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

  it('shows the coming-soon note when no onSubmit is given', async () => {
    renderComponent(<LoginForm />, 'en')
    fireEvent.change(await screen.findByLabelText('Email'), { target: { value: 'a@b.co' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'secret' } })
    fireEvent.click(screen.getByRole('button', { name: 'Log in' }))
    expect(screen.getByRole('status')).toHaveTextContent('opens soon')
  })

  it('shows the same form on the /login page', async () => {
    await renderPage('/en/login')
    expect(screen.getByRole('heading', { level: 1, name: 'Business customer login' })).toBeInTheDocument()
    expect(screen.getByLabelText('Password')).toBeInTheDocument()
  })
})
