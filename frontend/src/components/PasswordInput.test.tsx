/**
 * PasswordInput.test.tsx — Tests for the password input with its show/hide button (PasswordInput): on its own (the
 * toggle by mouse and keyboard, its fixed name and aria-pressed, the input props passed through, a controlled
 * visibility, disabled, Hebrew) and on the real login form (LoginForm, through the /login page).
 */
import { useState } from 'react'
import { screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { PasswordInput } from '@/components/PasswordInput'
import { renderComponent, renderPage } from '@/test/utils'

/**
 * A labelled PasswordInput that keeps its own value, as a form would.
 * @param props.onVisibleChange - Spy for the visibility changes.
 * @param props.visible - A controlled visibility, if any.
 * @param props.disabled - Disables it.
 * @returns The label and the input.
 */
function Field({ onVisibleChange, visible, disabled }: { onVisibleChange?: (visible: boolean) => void; visible?: boolean; disabled?: boolean }) {
  const [value, setValue] = useState('')
  return (
    <>
      <label htmlFor="pw">Password</label>
      <PasswordInput id="pw" value={value} onChange={(e) => setValue(e.target.value)} autoComplete="new-password" aria-describedby="pw-hint" visible={visible} onVisibleChange={onVisibleChange} disabled={disabled} />
      <p id="pw-hint">Hint</p>
    </>
  )
}

describe('PasswordInput', () => {
  it('hides the password until the eye button shows it', async () => {
    const onVisibleChange = vi.fn()
    const { user } = renderComponent(<Field onVisibleChange={onVisibleChange} />, 'en')
    const input = await screen.findByLabelText('Password')
    expect(input).toHaveAttribute('type', 'password')
    expect(input).toHaveClass('pe-12')
    await user.type(input, 'Secret pass 1')
    expect(input).toHaveValue('Secret pass 1')

    const eye = screen.getByRole('button', { name: 'Show password' })
    expect(eye).toHaveAttribute('aria-pressed', 'false')
    expect(eye).toHaveAttribute('type', 'button')
    await user.click(eye)
    expect(input).toHaveAttribute('type', 'text')
    expect(input).toHaveValue('Secret pass 1')
    // A toggle keeps its name; the pressed state tells whether it is shown.
    expect(screen.getByRole('button', { name: 'Show password' })).toHaveAttribute('aria-pressed', 'true')
    expect(onVisibleChange).toHaveBeenLastCalledWith(true)

    eye.focus()
    await user.keyboard('{Enter}')
    expect(input).toHaveAttribute('type', 'password')
    await user.keyboard(' ')
    expect(input).toHaveAttribute('type', 'text')
    expect(onVisibleChange.mock.calls).toEqual([[true], [false], [true]])
  })

  it('passes the input props through and types left to right', async () => {
    renderComponent(<Field />, 'he')
    const input = await screen.findByLabelText('Password')
    expect(input).toHaveAttribute('id', 'pw')
    expect(input).toHaveAttribute('autocomplete', 'new-password')
    expect(input).toHaveAttribute('aria-describedby', 'pw-hint')
    expect(input).toHaveAttribute('dir', 'ltr')
    expect(input).toHaveAttribute('spellcheck', 'false')
    // On a Hebrew page the buttons sit on the left, the LTR input's start side: the text keeps clear of them there.
    expect(input).toHaveClass('ps-12')
    expect(input).not.toHaveClass('pe-12')
    expect(screen.getByRole('button', { name: 'הצגת הסיסמה' })).toBeInTheDocument()
  })

  it('follows a controlled visibility', async () => {
    const onVisibleChange = vi.fn()
    const { user } = renderComponent(<Field visible onVisibleChange={onVisibleChange} />, 'en')
    expect(await screen.findByLabelText('Password')).toHaveAttribute('type', 'text')
    await user.click(screen.getByRole('button', { name: 'Show password' }))
    expect(onVisibleChange).toHaveBeenCalledWith(false)
    // The caller did not change `visible`, so it stays shown.
    expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'text')
  })

  it('disables the button with the input', async () => {
    renderComponent(<Field disabled />, 'en')
    expect(await screen.findByLabelText('Password')).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Show password' })).toBeDisabled()
  })

  it('shows the password on the login form', async () => {
    const { user } = await renderPage('/en/login')
    const input = screen.getByLabelText('Password')
    expect(input).toHaveAttribute('autocomplete', 'current-password')
    await user.type(input, 'secret')
    await user.click(screen.getByRole('button', { name: 'Show password' }))
    expect(input).toHaveAttribute('type', 'text')
    expect(input).toHaveValue('secret')
  })
})
