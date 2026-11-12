/**
 * GeneratedPasswordInput.tsx — PasswordInput plus a "Generate" button that fills in a random password and shows it,
 * so staff can copy it and give it to the customer. Used by RecordDialog for a `password` column (the customers
 * page: only staff open customer accounts and set their passwords).
 *
 * generatePassword makes the password with the browser's cryptographic random numbers (crypto.getRandomValues),
 * without look-alike characters (0/O, 1/l/I), with at least one lowercase letter, one capital and one digit. It is
 * never shorter than MIN_PASSWORD_LENGTH, the server's minimum (backend/app/staff/routes.py).
 */
import { useState } from 'react'
import { WandSparkles } from 'lucide-react'
import { PasswordInput, type PasswordInputProps } from '@/components/PasswordInput'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/i18n'

/** The shortest password the server accepts (MIN_PASSWORD_LENGTH in backend/app/staff/routes.py). */
export const MIN_PASSWORD_LENGTH = 8

/** The characters of a generated password: letters and digits that cannot be mistaken for one another. */
const LOWER = 'abcdefghijkmnopqrstuvwxyz'
const UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
const DIGITS = '23456789'
const ALPHABET = LOWER + UPPER + DIGITS

/**
 * Picks a random index without modulo bias (rejection sampling over random bytes).
 * @param size - How many choices there are (at most 256).
 * @returns An index from 0 to size - 1.
 */
function randomIndex(size: number): number {
  const limit = 256 - (256 % size)
  const byte = new Uint8Array(1)
  do crypto.getRandomValues(byte)
  while (byte[0] >= limit)
  return byte[0] % size
}

/**
 * Makes a random password.
 * @param length - How many characters; default 12, at least MIN_PASSWORD_LENGTH.
 * @returns The password: letters and digits, at least one lowercase letter, one capital and one digit.
 * @throws RangeError for a length under MIN_PASSWORD_LENGTH.
 */
export function generatePassword(length = 12): string {
  if (!Number.isInteger(length) || length < MIN_PASSWORD_LENGTH) throw new RangeError(`A password has at least ${MIN_PASSWORD_LENGTH} characters`)
  for (;;) {
    const password = Array.from({ length }, () => ALPHABET[randomIndex(ALPHABET.length)]).join('')
    if ([LOWER, UPPER, DIGITS].every((set) => [...password].some((char) => set.includes(char)))) return password
  }
}

/** The props of GeneratedPasswordInput: PasswordInput's (its `extra` is the Generate button) plus `onGenerate`. */
export type GeneratedPasswordInputProps = Omit<PasswordInputProps, 'extra'> & { onGenerate: (password: string) => void; length?: number }

/**
 * The password input with its Generate and show/hide buttons.
 * @param props.onGenerate - Called with a new random password when Generate is pressed (the caller puts it in the
 *   input's value); the password is then shown.
 * @param props.length - The generated passwords' length (default 12).
 * @param props.visible - Shows the password as text (controlled); omit to let the component keep it.
 * @param props.onVisibleChange - Called with the new visibility (the eye button, or Generate showing the password).
 * @returns The input with its buttons and a live region that announces a new password.
 */
export function GeneratedPasswordInput({ onGenerate, length, visible: visibleProp, onVisibleChange, ...props }: GeneratedPasswordInputProps) {
  const { t } = useI18n()
  const [visibleState, setVisibleState] = useState(false)
  const [status, setStatus] = useState('')
  const visible = visibleProp ?? visibleState

  /**
   * Changes the visibility, here and for a caller that controls it.
   * @param next - Shown (true) or hidden.
   */
  const changeVisible = (next: boolean) => {
    setVisibleState(next)
    onVisibleChange?.(next)
  }

  /** Generate handler: hands a new password to the caller, shows it and announces it. */
  const handleGenerate = () => {
    onGenerate(generatePassword(length))
    changeVisible(true)
    // Cleared first, so a second password in a row is announced again.
    setStatus('')
    requestAnimationFrame(() => setStatus(t.passwordField.generated))
  }

  return (
    <>
      <PasswordInput
        {...props}
        visible={visible}
        onVisibleChange={changeVisible}
        extra={
          <Button type="button" variant="ghost" size="icon-sm" disabled={props.disabled} aria-label={t.passwordField.generate} title={t.passwordField.generate} onClick={handleGenerate}>
            <WandSparkles aria-hidden />
          </Button>
        }
      />
      <span role="status" className="sr-only">
        {status}
      </span>
    </>
  )
}
