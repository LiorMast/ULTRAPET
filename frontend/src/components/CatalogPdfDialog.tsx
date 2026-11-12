/**
 * CatalogPdfDialog.tsx — The "PDF catalog" dialog of the staff panel's products page: the layout of the downloadable
 * PDF catalog the server generates from the products (backend/app/catalog_pdf.py) and a button that builds it now.
 * Staff set the products per page with a slider (1-12, 3 like the old printed catalog), switch the category title
 * pages, the brand / item code / barcode lines and the automatic rebuild after every change, see the last build
 * (when, products, pages) and open the Hebrew and English files. "Generate now" saves the options and starts a
 * build on the server; while it builds the dialog asks for the state every few seconds and confirms the end in a toast.
 *
 * The dialog fetches nothing itself: the page passes `load` and `onGenerate` (fetchCatalogPdf / generateCatalogPdf).
 * CatalogPdfButton is the button that opens it.
 */
import { useEffect, useId, useLayoutEffect, useRef, useState, type FormEvent } from 'react'
import { Download, FileText } from 'lucide-react'
import { cn } from 'cn'
import { ApiError, type CatalogPdfOptions, type CatalogPdfState } from '@/api'
import { errorMessage, LABEL_CLASS } from '@/components/RecordDialog'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { ENABLED_LOCALES, LOCALES, useI18n } from '@/i18n'
import { useToast } from '@/toast'

/** The range of the products-per-page slider (the server's MIN_PER_PAGE / MAX_PER_PAGE). */
const MIN_PER_PAGE = 1
const MAX_PER_PAGE = 12

/** How often the dialog asks for the state while a build runs, in milliseconds. */
export const CATALOG_PDF_POLL_MS = 2000

/** The on/off options, in the order the dialog lists them. */
const SWITCHES = ['categoryPages', 'showBrand', 'showSku', 'showBarcode', 'autoRebuild'] as const satisfies readonly (keyof CatalogPdfOptions)[]

/**
 * The grid a page's products are laid out in, by the server's rule (catalog_pdf.grid).
 * @param perPage - Products on a page, 1-12.
 * @returns The columns and rows: one row up to 4 products, two up to 8, three above.
 */
export function catalogPdfGrid(perPage: number): { columns: number; rows: number } {
  const rows = perPage <= 4 ? 1 : perPage <= 8 ? 2 : 3
  return { columns: Math.ceil(perPage / rows), rows }
}

/**
 * The handlers of the dialog.
 * `load` reads the state (called when the dialog opens and while a build runs); `onGenerate` saves the options and
 * starts a build, resolving with the new state or rejecting with an ApiError the dialog shows.
 */
type CatalogPdfHandlers = {
  load: (signal: AbortSignal) => Promise<CatalogPdfState>
  onGenerate: (options: CatalogPdfOptions) => Promise<CatalogPdfState>
}

/**
 * The button that opens the PDF catalog dialog.
 * @param props.load - Reads the catalog's state (see CatalogPdfHandlers).
 * @param props.onGenerate - Saves the options and starts a build.
 * @param props.className - Extra classes on the button.
 * @returns The button, and the dialog while it is open.
 */
export function CatalogPdfButton({ className, ...handlers }: CatalogPdfHandlers & { className?: string }) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button type="button" variant="outline" size="sm" className={className} onClick={() => setOpen(true)}>
        <FileText aria-hidden />
        {t.admin.catalogPdf.button}
      </Button>
      {open && <CatalogPdfDialog {...handlers} onClose={() => setOpen(false)} />}
    </>
  )
}

/**
 * The PDF catalog dialog.
 * @param props.load - Reads the catalog's state (see CatalogPdfHandlers).
 * @param props.onGenerate - Saves the options and starts a build.
 * @param props.onClose - Closes the dialog.
 * @returns The dialog.
 */
export function CatalogPdfDialog({ load, onGenerate, onClose }: CatalogPdfHandlers & { onClose: () => void }) {
  const { t, locale } = useI18n()
  const s = t.admin.catalogPdf
  const id = useId()
  const toast = useToast()
  const [state, setState] = useState<CatalogPdfState | null>(null)
  const [options, setOptions] = useState<CatalogPdfOptions | null>(null)
  const [loadFailed, setLoadFailed] = useState(false)
  const [formError, setFormError] = useState('')
  const [pending, setPending] = useState(false)
  // True from "Generate now" until that build ends, so only a build this dialog asked for is confirmed in a toast.
  const asked = useRef(false)

  // The latest `load`, so the caller's inline function never reloads the state on a rerender.
  const loader = useRef(load)
  useLayoutEffect(() => {
    loader.current = load
  })
  useEffect(() => {
    const controller = new AbortController()
    loader.current(controller.signal).then(
      (loaded) => {
        setState(loaded)
        setOptions(loaded.options)
      },
      () => {
        if (!controller.signal.aborted) setLoadFailed(true)
      },
    )
    return () => controller.abort()
  }, [])

  // While a build runs, ask again every few seconds; a failed request just waits for the next one.
  const building = state?.status.state === 'building'
  useEffect(() => {
    if (!building) return
    const controller = new AbortController()
    const timer = setInterval(() => {
      loader.current(controller.signal).then(setState, () => {})
    }, CATALOG_PDF_POLL_MS)
    return () => {
      clearInterval(timer)
      controller.abort()
    }
  }, [building])

  // The build this dialog asked for ended: confirm it (a failure shows in the status line).
  const buildState = state?.status.state
  useEffect(() => {
    if (!asked.current || buildState === 'building' || buildState === undefined) return
    asked.current = false
    if (buildState === 'ready') toast.success(s.ready)
  }, [buildState, toast, s.ready])

  /**
   * Saves the options and starts a build.
   * @param event - The form's submit event.
   */
  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (!options) return
    setFormError('')
    setPending(true)
    try {
      asked.current = true
      setState(await onGenerate(options))
    } catch (error) {
      asked.current = false
      setFormError(errorMessage(error instanceof ApiError ? error.code : undefined, t))
    } finally {
      setPending(false)
    }
  }

  const status = state?.status
  const grid = options ? catalogPdfGrid(options.perPage) : null
  const perPageText = options && grid ? s.perPageValue.replace('{n}', String(options.perPage)).replace('{columns}', String(grid.columns)).replace('{rows}', String(grid.rows)) : ''
  const builtAt = status?.builtAt ? new Date(status.builtAt).toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Jerusalem' }) : ''
  const lastBuild =
    status?.builtAt && status.products !== undefined && status.pages !== undefined
      ? s.lastBuild.replace('{date}', builtAt).replace('{products}', status.products.toLocaleString(locale)).replace('{pages}', status.pages.toLocaleString(locale))
      : ''
  const files = ENABLED_LOCALES.filter((language) => state?.urls[language])

  return (
    <Dialog open onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent closeLabel={t.admin.close}>
        <DialogHeader>
          <DialogTitle>{s.title}</DialogTitle>
          <DialogDescription>{s.description}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} noValidate className="flex min-h-0 flex-col">
          <div className="min-h-0 space-y-6 overflow-y-auto px-6 py-5">
            {state === null || options === null ? (
              <p role={loadFailed ? 'alert' : 'status'} className={cn('text-sm', loadFailed ? 'font-medium text-brand-red-dark' : 'text-brand-charcoal-muted')}>
                {loadFailed ? s.loadFailed : s.loading}
              </p>
            ) : (
              <>
                <div>
                  <div className="flex items-baseline justify-between gap-4">
                    <span id={`${id}-per-page`} className={LABEL_CLASS}>
                      {s.perPage}
                    </span>
                    <span className="text-sm font-semibold tabular-nums text-brand-charcoal">{perPageText}</span>
                  </div>
                  <Slider
                    className="mt-3"
                    aria-labelledby={`${id}-per-page`}
                    aria-valuetext={perPageText}
                    min={MIN_PER_PAGE}
                    max={MAX_PER_PAGE}
                    step={1}
                    value={[options.perPage]}
                    onValueChange={([perPage]) => setOptions({ ...options, perPage })}
                  />
                  <p className="mt-2 text-xs text-brand-charcoal-muted">{s.perPageHint}</p>
                </div>

                <ul className="space-y-3">
                  {SWITCHES.map((key) => (
                    <li key={key} className="flex items-center gap-3">
                      <Switch id={`${id}-${key}`} checked={options[key]} onCheckedChange={(checked) => setOptions({ ...options, [key]: checked })} />
                      <label htmlFor={`${id}-${key}`} className="cursor-pointer text-sm font-medium text-brand-charcoal">
                        {s.options[key]}
                      </label>
                    </li>
                  ))}
                </ul>

                <section aria-labelledby={`${id}-status`}>
                  <h3 id={`${id}-status`} className={LABEL_CLASS}>
                    {s.status}
                  </h3>
                  <p role="status" className="mt-2 text-sm text-brand-charcoal">
                    {status?.state === 'building' ? s.building : status?.state === 'none' ? s.none : lastBuild}
                  </p>
                  {status?.state === 'failed' && (
                    <p role="alert" className="mt-1 text-sm font-medium text-brand-red-dark">
                      {s.failed}
                    </p>
                  )}
                  {files.length > 0 && (
                    <ul className="mt-3 flex flex-wrap gap-x-6 gap-y-2">
                      {files.map((language) => (
                        <li key={language}>
                          <a
                            href={state.urls[language]}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 text-sm font-semibold text-brand-red-dark hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-red"
                          >
                            <Download aria-hidden className="size-4" />
                            {s.file.replace('{language}', LOCALES[language].nativeName)}
                          </a>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
                {formError && (
                  <p role="alert" className="text-sm font-medium text-brand-red-dark">
                    {formError}
                  </p>
                )}
              </>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" size="sm" onClick={onClose}>
              {t.admin.close}
            </Button>
            {state !== null && (
              <Button type="submit" size="sm" disabled={pending || building}>
                {building ? s.generating : s.generate}
              </Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
