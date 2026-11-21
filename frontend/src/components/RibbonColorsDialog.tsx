/**
 * RibbonColorsDialog.tsx — The "Ribbon colors" button and dialog of the staff panel's discounts page: the color of
 * each kind of discount ribbon (DiscountType: a general discount, a customer's own discount) that signed-in customers
 * see on the catalog cards and the product page (DiscountRibbons). Staff pick any color (a color picker and a
 * "#RRGGBB" field per kind), see a live preview (the text color is chosen automatically, readableTextColor) and can
 * reset to the defaults (DISCOUNT_RIBBON_DEFAULTS). Saved as the setting `discount_ribbon_colors`, which
 * GET /api/prices answers as `ribbonColors`.
 *
 * The dialog fetches nothing itself: the page passes `load` and `onSave` (fetchSetting / saveSetting).
 */
import { useEffect, useId, useLayoutEffect, useRef, useState, type FormEvent } from 'react'
import { Palette } from 'lucide-react'
import { cn } from 'cn'
import { ApiError, type DiscountType, type RibbonColors } from '@/api'
import { DiscountRibbon } from '@/components/DiscountRibbon'
import { errorMessage } from '@/components/RecordDialog'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { LABEL_CLASS, inputVariants } from '@/components/ui/input'
import { DISCOUNT_RIBBON_DEFAULTS, DISCOUNT_TYPES } from '@/config'
import { useI18n } from '@/i18n'
import { useToast } from '@/toast'

/** A color code the ribbons accept: "#" and six hex digits. */
const HEX_COLOR = /^#[0-9a-f]{6}$/i

/**
 * The handlers of the dialog: `load` reads the stored setting (undefined = never saved); `onSave` stores the colors,
 * rejecting with an ApiError the dialog shows.
 */
type RibbonColorsHandlers = {
  load: (signal: AbortSignal) => Promise<unknown>
  onSave: (colors: RibbonColors) => Promise<unknown>
}

/**
 * The ribbon colors of a stored setting, each kind's default where it holds no valid color (like the server's
 * ribbon_colors).
 * @param stored - The setting's value (anything: it is JSON staff could have written).
 * @returns A color per kind, "#rrggbb".
 */
export function ribbonColorsOf(stored: unknown): RibbonColors {
  const values = typeof stored === 'object' && stored !== null ? (stored as Record<string, unknown>) : {}
  return Object.fromEntries(
    DISCOUNT_TYPES.map((type) => {
      const value = values[type]
      return [type, typeof value === 'string' && HEX_COLOR.test(value) ? value : DISCOUNT_RIBBON_DEFAULTS[type]]
    }),
  ) as RibbonColors
}

/**
 * A typed color code made whole: trimmed, a missing "#" added, upper case.
 * @param text - What staff typed.
 * @returns The normalized code (maybe still invalid).
 */
function normalizeHex(text: string): string {
  const trimmed = text.trim()
  return (trimmed.startsWith('#') ? trimmed : `#${trimmed}`).toUpperCase()
}

/**
 * The button that opens the ribbon colors dialog.
 * @param props.load - Reads the stored setting (see RibbonColorsHandlers).
 * @param props.onSave - Stores the colors.
 * @param props.className - Extra classes on the button.
 * @returns The button, and the dialog while it is open (closing it puts the focus back on the button).
 */
export function RibbonColorsButton({ className, ...handlers }: RibbonColorsHandlers & { className?: string }) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const button = useRef<HTMLButtonElement>(null)

  /**
   * Puts the focus back on the button when the dialog closes (it has no Radix DialogTrigger to return to).
   * @param event - Radix's close-autofocus event; its default (focusing nothing) is prevented.
   */
  const handleCloseFocus = (event: Event) => {
    event.preventDefault()
    button.current?.focus()
  }

  return (
    <>
      <Button ref={button} type="button" variant="outline" size="sm" className={className} onClick={() => setOpen(true)}>
        <Palette aria-hidden />
        {t.admin.ribbonColors.button}
      </Button>
      {open && <RibbonColorsDialog {...handlers} onClose={() => setOpen(false)} onCloseAutoFocus={handleCloseFocus} />}
    </>
  )
}

/**
 * The ribbon colors dialog.
 * @param props.load - Reads the stored setting (see RibbonColorsHandlers).
 * @param props.onSave - Stores the colors.
 * @param props.onClose - Closes the dialog.
 * @param props.onCloseAutoFocus - Where the focus goes when it closes (passed to DialogContent); without it, Radix's default.
 * @returns The dialog.
 */
export function RibbonColorsDialog({
  load,
  onSave,
  onClose,
  onCloseAutoFocus,
}: RibbonColorsHandlers & { onClose: () => void; onCloseAutoFocus?: (event: Event) => void }) {
  const { t } = useI18n()
  const s = t.admin.ribbonColors
  const id = useId()
  const toast = useToast()
  // The typed codes per kind (null until loaded); a code may be invalid while staff type.
  const [colors, setColors] = useState<RibbonColors | null>(null)
  const [loadFailed, setLoadFailed] = useState(false)
  const [invalid, setInvalid] = useState<DiscountType[]>([])
  const [formError, setFormError] = useState('')
  const [pending, setPending] = useState(false)

  // The latest `load`, so the caller's inline function never reloads the colors on a rerender.
  const loader = useRef(load)
  useLayoutEffect(() => {
    loader.current = load
  })
  useEffect(() => {
    const controller = new AbortController()
    loader.current(controller.signal).then(
      (stored) => setColors(ribbonColorsOf(stored)),
      () => {
        if (!controller.signal.aborted) setLoadFailed(true)
      },
    )
    return () => controller.abort()
  }, [])

  /**
   * Changes one kind's color and clears its error.
   * @param type - The kind of discount.
   * @param value - The new code (typed or picked).
   */
  const setColor = (type: DiscountType, value: string) => {
    setColors((current) => current && { ...current, [type]: value })
    setInvalid((current) => current.filter((other) => other !== type))
  }

  /**
   * Checks the codes and saves them; an invalid code gets its message and the focus.
   * @param event - The form's submit event.
   */
  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (!colors || pending) return
    const normalized = Object.fromEntries(DISCOUNT_TYPES.map((type) => [type, normalizeHex(colors[type])])) as RibbonColors
    setColors(normalized)
    const wrong = DISCOUNT_TYPES.filter((type) => !HEX_COLOR.test(normalized[type]))
    setInvalid(wrong)
    setFormError('')
    if (wrong.length > 0) {
      document.getElementById(`${id}-${wrong[0]}`)?.focus()
      return
    }
    setPending(true)
    try {
      await onSave(normalized)
      toast.success(s.saved)
      onClose()
    } catch (error) {
      setFormError(errorMessage(error instanceof ApiError ? error.code : undefined, t))
      setPending(false)
    }
  }

  return (
    <Dialog open onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent closeLabel={t.admin.close} onCloseAutoFocus={onCloseAutoFocus}>
        <DialogHeader>
          <DialogTitle>{s.title}</DialogTitle>
          <DialogDescription>{s.description}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} noValidate className="flex min-h-0 flex-col">
          <div className="min-h-0 space-y-6 overflow-y-auto px-6 py-5">
            {colors === null ? (
              <p role={loadFailed ? 'alert' : 'status'} className={cn('text-sm', loadFailed ? 'font-medium text-brand-red-dark' : 'text-brand-charcoal-muted')}>
                {loadFailed ? s.loadFailed : s.loading}
              </p>
            ) : (
              <>
                {DISCOUNT_TYPES.map((type) => {
                  const value = colors[type]
                  const valid = HEX_COLOR.test(normalizeHex(value))
                  const errorId = `${id}-${type}-error`
                  return (
                    <fieldset key={type}>
                      <legend className={LABEL_CLASS}>{s.types[type]}</legend>
                      <div className="mt-2 flex flex-wrap items-center gap-3">
                        <input
                          type="color"
                          aria-label={`${s.pick}: ${s.types[type]}`}
                          value={valid ? normalizeHex(value).toLowerCase() : DISCOUNT_RIBBON_DEFAULTS[type].toLowerCase()}
                          onChange={(event) => setColor(type, event.target.value.toUpperCase())}
                          className="h-11 w-14 shrink-0 cursor-pointer rounded-lg border border-neutral-300 bg-neutral-50 p-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-red"
                        />
                        <label htmlFor={`${id}-${type}`} className="sr-only">
                          {`${s.hex}: ${s.types[type]}`}
                        </label>
                        <input
                          id={`${id}-${type}`}
                          dir="ltr"
                          value={value}
                          onChange={(event) => setColor(type, event.target.value)}
                          spellCheck={false}
                          autoComplete="off"
                          maxLength={7}
                          aria-invalid={invalid.includes(type)}
                          aria-describedby={invalid.includes(type) ? errorId : undefined}
                          className={cn(inputVariants({ size: 'compact' }), 'w-32 font-mono uppercase')}
                        />
                        <span className="flex items-center gap-2 text-xs text-brand-charcoal-muted">
                          {s.preview}:
                          <DiscountRibbon kind="discount" customColor={valid ? normalizeHex(value) : DISCOUNT_RIBBON_DEFAULTS[type]} message={t.catalog.discountTypes[type]} />
                        </span>
                      </div>
                      {invalid.includes(type) && (
                        <p id={errorId} role="alert" className="mt-2 text-sm font-medium text-brand-red-dark">
                          {s.invalid}
                        </p>
                      )}
                    </fieldset>
                  )
                })}
                {formError && (
                  <p role="alert" className="text-sm font-medium text-brand-red-dark">
                    {formError}
                  </p>
                )}
              </>
            )}
          </div>
          <DialogFooter>
            {colors !== null && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="sm:me-auto"
                onClick={() => {
                  setColors({ ...DISCOUNT_RIBBON_DEFAULTS })
                  setInvalid([])
                }}
              >
                {s.reset}
              </Button>
            )}
            <Button type="button" variant="outline" size="sm" onClick={onClose}>
              {t.admin.cancel}
            </Button>
            {colors !== null && (
              <Button type="submit" size="sm" loading={pending}>
                {t.admin.save}
              </Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
