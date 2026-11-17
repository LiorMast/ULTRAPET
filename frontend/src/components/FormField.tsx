/**
 * FormField.tsx — One labelled field of a public form: the label (with " *" when required), the input or textarea in
 * the site's one field look (ui/input: INPUT_CLASS, LABEL_CLASS) and its inline error, tied together for assistive
 * technology (aria-invalid, aria-describedby, aria-required). The error is a `role="alert"` line right under the
 * field, never a toast. Used by the Contact form (Contact.tsx) and the request for a business account
 * (BusinessCustomers.tsx); the admin forms have their own (RecordDialog).
 */
import type { InputHTMLAttributes, TextareaHTMLAttributes } from 'react'
import { cn } from 'cn'
import { INPUT_CLASS, LABEL_CLASS } from '@/components/ui/input'

/** The props every field takes (the rest go to the <input> or <textarea>). */
type FieldProps = { id: string; label: string; required?: boolean; error?: string; className?: string }

/**
 * A labelled input, or a textarea with `multiline`.
 * @param props.id - The control's id (the error's id is `<id>-error`).
 * @param props.label - The visible label.
 * @param props.required - Marks the label with " *" and the control aria-required (validation is the form's job).
 * @param props.error - The error to show under the field; empty or omitted = valid.
 * @param props.multiline - true = a <textarea> (pass `rows`), else an <input> (pass `type`, `autoComplete`, ...).
 * @param props.className - Extra classes for the wrapper.
 * @param props - Every other attribute of the control (name, value, onChange, placeholder, dir, ...).
 * @returns The field.
 */
export function FormField({
  id,
  label,
  required = false,
  error,
  className,
  multiline,
  ...control
}: FieldProps &
  (({ multiline?: false } & InputHTMLAttributes<HTMLInputElement>) | ({ multiline: true } & TextareaHTMLAttributes<HTMLTextAreaElement>))) {
  const errorId = `${id}-error`
  const aria = { id, 'aria-required': required, 'aria-invalid': !!error, 'aria-describedby': error ? errorId : undefined, className: INPUT_CLASS }
  return (
    <div className={cn(className)}>
      <label htmlFor={id} className={LABEL_CLASS}>
        {label}
        {required && ' *'}
      </label>
      {multiline ? (
        <textarea {...(control as TextareaHTMLAttributes<HTMLTextAreaElement>)} {...aria} />
      ) : (
        <input {...(control as InputHTMLAttributes<HTMLInputElement>)} {...aria} />
      )}
      {error && (
        <p id={errorId} role="alert" className="mt-1 text-xs font-medium text-brand-red-dark">
          {error}
        </p>
      )}
    </div>
  )
}
