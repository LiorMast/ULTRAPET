/**
 * LoginForm.tsx — The customer login form (email, password, "remember me"). Used by LoginPopover (the
 * header's login popover) and by the /login page, so both stay identical.
 *
 * The B2B portal does not exist yet (Phase 4), so a valid submit does not sign anyone in: it shows a
 * "portal coming soon" note. The `onSubmit` prop is where the real sign-in call will plug in.
 */
import { useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/i18n'

/** The values the form submits. */
export type LoginValues = { email: string; password: string; remember: boolean }

const INPUT_CLASS =
  'mt-2 block w-full border border-neutral-300 bg-neutral-50 px-4 py-3 text-sm text-brand-charcoal transition-colors focus:border-brand-red focus:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-red/40 aria-[invalid=true]:border-brand-red'
const LABEL_CLASS = 'block font-heading text-2xs font-semibold uppercase tracking-widest text-brand-charcoal-muted'

/**
 * The login form.
 * @param props.onSubmit - Called with the values after they pass validation; defaults to showing the "coming soon" note.
 * @param props.idPrefix - Prefix for the field ids, so two forms on one page never clash; defaults to "login".
 * @returns The form element.
 */
export function LoginForm({ onSubmit, idPrefix = 'login' }: { onSubmit?: (values: LoginValues) => void; idPrefix?: string }) {
  const { t } = useI18n()
  const [values, setValues] = useState<LoginValues>({ email: '', password: '', remember: false })
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({})
  const [submitted, setSubmitted] = useState(false)

  /**
   * Submit handler: validates, then calls `onSubmit` or shows the "coming soon" note.
   * @param event - The form submit event.
   */
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const found: { email?: string; password?: string } = {}
    if (!values.email.trim()) found.email = t.login.errorRequired
    else if (!/^\S+@\S+\.\S+$/.test(values.email.trim())) found.email = t.login.errorEmail
    if (!values.password) found.password = t.login.errorRequired
    setErrors(found)
    setSubmitted(false)
    if (Object.keys(found).length > 0) return
    if (onSubmit) onSubmit(values)
    else setSubmitted(true)
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      <div>
        <label htmlFor={`${idPrefix}-email`} className={LABEL_CLASS}>{t.login.email}</label>
        <input
          id={`${idPrefix}-email`}
          type="email"
          dir="auto"
          autoComplete="email"
          value={values.email}
          onChange={(e) => setValues((v) => ({ ...v, email: e.target.value }))}
          aria-required
          aria-invalid={!!errors.email}
          aria-describedby={errors.email ? `${idPrefix}-email-error` : undefined}
          className={INPUT_CLASS}
        />
        {errors.email && <p id={`${idPrefix}-email-error`} className="mt-1 text-xs font-medium text-brand-red-dark">{errors.email}</p>}
      </div>
      <div>
        <label htmlFor={`${idPrefix}-password`} className={LABEL_CLASS}>{t.login.password}</label>
        <input
          id={`${idPrefix}-password`}
          type="password"
          autoComplete="current-password"
          value={values.password}
          onChange={(e) => setValues((v) => ({ ...v, password: e.target.value }))}
          aria-required
          aria-invalid={!!errors.password}
          aria-describedby={errors.password ? `${idPrefix}-password-error` : undefined}
          className={INPUT_CLASS}
        />
        {errors.password && <p id={`${idPrefix}-password-error`} className="mt-1 text-xs font-medium text-brand-red-dark">{errors.password}</p>}
      </div>
      <label htmlFor={`${idPrefix}-remember`} className="flex cursor-pointer items-center gap-3 text-sm text-brand-charcoal">
        <input
          id={`${idPrefix}-remember`}
          type="checkbox"
          checked={values.remember}
          onChange={(e) => setValues((v) => ({ ...v, remember: e.target.checked }))}
          className="size-4 accent-brand-red focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-red"
        />
        {t.login.remember}
      </label>
      <Button type="submit" className="w-full">{t.login.submit}</Button>
      {submitted && <p role="status" className="text-xs text-brand-charcoal-muted">{t.login.comingSoon}</p>}
    </form>
  )
}
