/**
 * GeneratedPasswordInput.test.tsx — Tests for the random password generator (generatePassword: length, character
 * classes, no look-alikes, randomness, the minimum length) and for the input with its Generate button
 * (GeneratedPasswordInput: fills the field, shows it, announces it, keeps the eye toggle, Hebrew).
 */
import { useState } from 'react'
import { screen, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { GeneratedPasswordInput, generatePassword, MIN_PASSWORD_LENGTH } from '@/components/GeneratedPasswordInput'
import { renderComponent } from '@/test/utils'

/**
 * A labelled GeneratedPasswordInput that keeps its own value, as a form would.
 * @returns The label and the input.
 */
function Field() {
  const [value, setValue] = useState('')
  return (
    <>
      <label htmlFor="pw">Password</label>
      <GeneratedPasswordInput id="pw" value={value} onChange={(e) => setValue(e.target.value)} onGenerate={setValue} />
    </>
  )
}

describe('generatePassword', () => {
  it('makes 12 characters by default, with a lowercase letter, a capital and a digit', () => {
    for (let i = 0; i < 50; i++) {
      const password = generatePassword()
      expect(password).toHaveLength(12)
      expect(password).toMatch(/[a-z]/)
      expect(password).toMatch(/[A-Z]/)
      expect(password).toMatch(/[0-9]/)
      // Letters and digits only, without the look-alikes 0/O and 1/l/I.
      expect(password).toMatch(/^[a-km-zA-HJ-NP-Z2-9]+$/)
    }
  })

  it('makes other lengths, never under the minimum', () => {
    expect(MIN_PASSWORD_LENGTH).toBe(8)
    expect(generatePassword(8)).toHaveLength(8)
    expect(generatePassword(20)).toHaveLength(20)
    expect(() => generatePassword(7)).toThrow(RangeError)
    expect(() => generatePassword(9.5)).toThrow(RangeError)
  })

  it('makes a different password every time', () => {
    const passwords = new Set(Array.from({ length: 100 }, () => generatePassword()))
    expect(passwords.size).toBe(100)
  })
})

describe('GeneratedPasswordInput', () => {
  it('fills the field with a new password, shows it and announces it', async () => {
    const { user } = renderComponent(<Field />, 'en')
    const input = await screen.findByLabelText('Password')
    expect(input).toHaveAttribute('type', 'password')
    const generate = screen.getByRole('button', { name: 'Generate a random password' })
    expect(generate).toHaveAttribute('type', 'button')

    await user.click(generate)
    const first = (input as HTMLInputElement).value
    expect(first).toMatch(/^[a-zA-Z0-9]{12}$/)
    expect(input).toHaveAttribute('type', 'text')
    expect(screen.getByRole('button', { name: 'Show password' })).toHaveAttribute('aria-pressed', 'true')
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('A new password was generated and is shown in the field.'))

    await user.click(generate)
    expect(input).not.toHaveValue(first)

    // The eye still hides it, and the field can still be typed in.
    await user.click(screen.getByRole('button', { name: 'Show password' }))
    expect(input).toHaveAttribute('type', 'password')
    await user.clear(input)
    await user.type(input, 'typed-pass')
    expect(input).toHaveValue('typed-pass')
  })

  it('reads in Hebrew', async () => {
    renderComponent(<Field />, 'he')
    expect(await screen.findByRole('button', { name: 'יצירת סיסמה אקראית' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'הצגת הסיסמה' })).toBeInTheDocument()
  })
})
