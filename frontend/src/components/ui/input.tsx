/**
 * ui/input.tsx — The one look of every form field on the site (text inputs, selects, textareas, date/time inputs,
 * PasswordInput and SearchableField through their `inputClassName`).
 *
 * A soft rounded field (rounded-lg) on a light grey fill that turns white with a red border and a faint red halo
 * when focused, and red-bordered when `aria-invalid`. Sizes: `default` (a form field under its label), `compact`
 * (44px, toolbars: the catalog's price range), `search` (48px pill with room for the magnifier icon at the start:
 * the catalog and Where to Buy searches). It is a class (not a component) because native <select>, <textarea> and the
 * password / searchable fields all wear it. Used by LoginForm, Contact, RecordDialog and every admin dialog,
 * CatalogToolbar, Catalog and WhereToBuy.
 */
import { cva } from "class-variance-authority"

/** The field's look, by size (see the header). */
export const inputVariants = cva(
  "block w-full rounded-lg border border-neutral-300 bg-neutral-50 text-sm text-brand-charcoal transition-[color,background-color,border-color,box-shadow] duration-150 placeholder:text-brand-charcoal-muted hover:border-neutral-400 focus:border-brand-red focus:bg-white focus:outline-none focus:ring-4 focus:ring-brand-red/15 disabled:cursor-not-allowed disabled:text-brand-charcoal-muted aria-[invalid=true]:border-brand-red",
  {
    variants: {
      size: {
        default: "px-4 py-3",
        compact: "h-11 px-3",
        search: "h-12 rounded-full ps-12 pe-4",
      },
    },
    defaultVariants: { size: "default" },
  }
)

/** A form field under its label (the label's spacing included). */
export const INPUT_CLASS = `mt-2 ${inputVariants()}`

/** A form field's label (also a fieldset's legend and a dialog's small section heading): sentence case, semibold. */
export const LABEL_CLASS = "block text-sm font-semibold text-brand-charcoal"
