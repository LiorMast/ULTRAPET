/**
 * PasswordInput.tsx — A password input with an eye button that shows and hides what was typed. Any form can use it:
 * it passes every <input> prop through (id, value, onChange, autoComplete, aria-*, ...) and takes the form's own
 * input look (`inputClassName`). Used by LoginForm (the sign-in password) and by GeneratedPasswordInput, which
 * adds its "Generate" button through `extra` (the admin's customer form, through RecordDialog).
 *
 * The buttons sit inside the input at its end edge (the right in English, the left in Hebrew); a password is
 * always typed left to right. The visibility can be left to the component or controlled by the caller
 * (`visible` + `onVisibleChange`, e.g. to show a password the caller just generated).
 */
import { useState, type ComponentProps, type ReactNode } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { cn } from 'cn'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/i18n'

/** The props of PasswordInput: an <input>'s props (its `type` is the component's) plus the ones below. */
export type PasswordInputProps = Omit<ComponentProps<'input'>, 'type' | 'className'> & {
  inputClassName?: string
  className?: string
  visible?: boolean
  onVisibleChange?: (visible: boolean) => void
  extra?: ReactNode
}

/**
 * The password input with its show/hide button.
 * @param props.inputClassName - The input's look (the form's input class, e.g. RecordDialog's INPUT_CLASS); its
 *   top margin moves to the wrapper, so the buttons stay centred on the input.
 * @param props.className - Extra classes of the wrapper.
 * @param props.visible - Shows the password as text (controlled); omit to let the component keep it.
 * @param props.onVisibleChange - Called with the new visibility when the eye button is pressed.
 * @param props.extra - More buttons for the same end-side group, before the eye (e.g. "Generate").
 * @param props.disabled - Disables the input and its buttons.
 * @returns The wrapper with the input and its buttons.
 */
export function PasswordInput({ inputClassName, className, visible: visibleProp, onVisibleChange, extra, disabled, ...input }: PasswordInputProps) {
  const { t, dir } = useI18n()
  const [visibleState, setVisibleState] = useState(false)
  const visible = visibleProp ?? visibleState

  /** Eye button handler: shows a hidden password or hides a shown one. */
  const handleToggle = () => {
    setVisibleState(!visible)
    onVisibleChange?.(!visible)
  }

  return (
    <span className={cn('relative mt-2 block', className)}>
      <input
        {...input}
        type={visible ? 'text' : 'password'}
        dir="ltr"
        disabled={disabled}
        // A shown password is still not something to spell-check or autocorrect.
        spellCheck={false}
        autoCapitalize="off"
        // The buttons sit at the page's end, but the input is always LTR, so its own "end" is the right even on a
        // Hebrew page: the room for the buttons goes on the input's start side there.
        className={cn(inputClassName, 'mt-0', dir === 'rtl' ? (extra ? 'ps-20' : 'ps-12') : extra ? 'pe-20' : 'pe-12')}
      />
      <span className="absolute inset-y-0 end-0 flex items-center gap-0.5 pe-1.5">
        {extra}
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          disabled={disabled}
          aria-pressed={visible}
          // A toggle keeps one name; aria-pressed says whether the password is shown.
          aria-label={t.passwordField.show}
          title={t.passwordField.show}
          onClick={handleToggle}
        >
          {visible ? <EyeOff aria-hidden /> : <Eye aria-hidden />}
        </Button>
      </span>
    </span>
  )
}
