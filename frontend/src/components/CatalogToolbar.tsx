/**
 * CatalogToolbar.tsx — The catalog's sort and filter controls, under the category chips: a brand filter (several
 * brands at once, each with its number of matches), a price range (signed-in business customers only, since the
 * prices are theirs), a sort menu (the price sorts for customers only), and a row of the active filters, each
 * removable, plus "Clear all". Every control writes the URL state (CatalogSearch: brand, min, max, sort) and goes
 * back to page 1; the route reloads the results from the server. Used by Catalog; reusable for any list whose page
 * answers a ProductPage.
 *
 * Mobile-first: on a phone (below md) the menus become bottom sheets (Offcanvas side="bottom"), like a phone app's:
 * "Filters (n)" opens the brands as 48px checkbox rows and, for customers, the price range, with "Show N products" to
 * go back to the results; Sort opens its choices as radio rows (a choice applies and closes the sheet).
 */
import { useRef, useState, type ComponentProps, type FormEvent, type ReactNode, type Ref } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { cva } from 'class-variance-authority'
import { ArrowUpDown, ChevronDown, SlidersHorizontal, X } from 'lucide-react'
import { cn } from 'cn'
import { CATALOG_SORTS, type Brand, type CatalogSearch, type CatalogSort, type ProductPage } from '@/api'
import { formatPrice } from '@/components/CatalogCard'
import { Offcanvas } from '@/components/Offcanvas'
import { PHONE_QUERY, useMediaQuery } from '@/components/useMediaQuery'
import { textLinkVariants } from '@/components/TextLink'
import { Button } from '@/components/ui/button'
import { CHECKBOX_CLASS, inputVariants, LABEL_CLASS } from '@/components/ui/input'
import { Slider } from '@/components/ui/slider'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useI18n } from '@/i18n'

/**
 * The catalog's chip look, shared by the toolbar buttons and the category chips (Catalog.tsx): a squircle, filled charcoal
 * when `active` (it holds a value / is the current filter); `size` md (44px, the toolbar, as tall as its inputs) or sm
 * (40px, the category row).
 */
export const chipVariants = cva(
  'inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-lg border px-4 text-sm font-medium outline-none transition-[color,background-color,border-color,scale] duration-300 active:scale-[0.97] active:duration-100 focus-visible:ring-2 focus-visible:ring-brand-red focus-visible:ring-offset-2 data-[state=open]:border-brand-charcoal',
  {
    variants: {
      active: {
        true: 'border-brand-charcoal bg-brand-charcoal text-white',
        false: 'border-neutral-200 bg-white text-brand-charcoal hover:border-brand-red hover:text-brand-red-dark',
      },
      size: { md: 'h-11', sm: 'h-10 pointer-coarse:h-11' },
    },
    defaultVariants: { active: false, size: 'md' },
  },
)

/** The look of the menu panels and their entries (square, roomy, like the language menu). */
const MENU = 'w-auto min-w-60'
const MENU_ITEM = 'py-2.5 ps-3.5 pe-10 font-medium text-brand-charcoal'

/** A row of a phone's filter or sort sheet: a 48px choice (a checkbox or a radio and its label). */
const SHEET_ROW = 'flex min-h-12 cursor-pointer items-center gap-3 rounded-lg px-2 text-base text-brand-charcoal has-checked:font-semibold has-disabled:cursor-not-allowed has-disabled:opacity-50'

/** The look of the price inputs (the shared field, compact). */
const INPUT = inputVariants({ size: 'compact' })

/** The URL state the toolbar changes; any change goes back to page 1. */
type Changes = Pick<CatalogSearch, 'brand' | 'min' | 'max' | 'sort'>

/**
 * A toolbar button that opens a menu or a popover: label, optional icon, and a chevron.
 * @param props.label - The visible text (also its accessible name).
 * @param props.icon - An icon before the label.
 * @param props.active - Whether the control holds a value (filled look).
 * @param props.ref - The button element (to give it the focus back).
 * @param props.className - Extra classes, merged with the trigger look (e.g. "ms-auto").
 * @param props - Other button props (Radix's trigger props come through `asChild`).
 * @returns The button.
 */
function ToolbarTrigger({
  label,
  icon,
  active = false,
  ref,
  className,
  ...props
}: { label: string; icon?: ReactNode; active?: boolean; ref?: Ref<HTMLButtonElement> } & ComponentProps<'button'>) {
  return (
    <button ref={ref} type="button" {...props} className={cn(chipVariants({ active }), className)}>
      {icon}
      {label}
      <ChevronDown aria-hidden="true" className="size-4" />
    </button>
  )
}

/**
 * One active filter, shown as a small squircle chip with a remove button (its X).
 * @param props.label - What the filter is (e.g. the brand name).
 * @param props.onRemove - Removes the filter.
 * @returns The chip.
 */
function FilterPill({ label, onRemove }: { label: string; onRemove: () => void }) {
  const { t } = useI18n()
  return (
    <li>
      <button
        type="button"
        onClick={onRemove}
        aria-label={t.catalog.removeFilter.replace('{name}', label)}
        className="inline-flex min-h-9 items-center gap-2 rounded-lg border pointer-coarse:min-h-11 border-neutral-200 bg-neutral-50 ps-3.5 pe-3 text-sm text-brand-charcoal outline-none transition-[color,border-color,scale] duration-300 hover:border-brand-red hover:text-brand-red-dark active:scale-[0.97] active:duration-100 focus-visible:ring-2 focus-visible:ring-brand-red focus-visible:ring-offset-2 starting:scale-95 starting:opacity-0"
      >
        {label}
        <X aria-hidden="true" className="size-3.5" />
      </button>
    </li>
  )
}

/**
 * The price range form inside the price popover: a two-headed slider over the customers' price bounds, the maximum and
 * minimum inputs (in the slider's order, the same values, for exact amounts), Apply and Clear.
 * @param props.range - The applied range (null = none).
 * @param props.bounds - The customer's cheapest and dearest price among the matches (the inputs' placeholders).
 * @param props.onApply - Applies a range (undefined ends = open).
 * @returns The form.
 */
function PriceRangeForm({
  range,
  bounds,
  onApply,
}: {
  range: ProductPage['priceRange']
  bounds: ProductPage['priceBounds']
  onApply: (min: number | undefined, max: number | undefined) => void
}) {
  const { t, locale } = useI18n()
  const [min, setMin] = useState(range?.min?.toString() ?? '')
  const [max, setMax] = useState(range?.max?.toString() ?? '')

  /**
   * Reads one input: an amount of 0 or more, or undefined when empty or not a number.
   * @param value - The input's text.
   * @returns The amount.
   */
  const read = (value: string) => {
    const amount = value.trim() ? Number(value) : NaN
    return Number.isFinite(amount) && amount >= 0 ? amount : undefined
  }

  const floor = bounds ? Math.floor(bounds.min) : 0
  const ceil = bounds ? Math.ceil(bounds.max) : 0
  // The heads' places: the typed amount, or the bound while the input is empty, kept inside the bounds.
  const clamp = (amount: number) => Math.min(ceil, Math.max(floor, amount))
  const low = clamp(read(min) ?? floor)
  const high = Math.max(low, clamp(read(max) ?? ceil))

  /**
   * A head moved: writes its two places into the inputs.
   * @param values - The new [low, high] places.
   */
  const handleSlide = ([nextLow, nextHigh]: number[]) => {
    setMin(String(nextLow))
    setMax(String(nextHigh))
  }

  /**
   * Submit: applies the typed range.
   * @param event - The form submit event.
   */
  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    onApply(read(min), read(max))
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <p className="font-heading text-sm font-bold text-brand-charcoal">{t.catalog.priceRangeTitle}</p>
      {bounds && ceil > floor && (
        <Slider
          heads={2}
          min={floor}
          max={ceil}
          step={1}
          inverted
          sticky
          marks={[bounds.min, bounds.max].map((amount) => ({ value: clamp(Math.round(amount)), label: formatPrice(locale, amount, { whole: true }) }))}
          value={[low, high]}
          onValueChange={handleSlide}
          thumbLabels={[t.catalog.priceMin, t.catalog.priceMax]}
          thumbValueText={(amount) => formatPrice(locale, amount, { whole: true })}
          className="px-2.5"
        />
      )}
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1.5 text-xs font-medium text-brand-charcoal-muted">
          {t.catalog.priceMax}
          <input
            type="number"
            inputMode="decimal"
            min={0}
            step="any"
            value={max}
            onChange={(e) => setMax(e.target.value)}
            placeholder={bounds ? String(Math.ceil(bounds.max)) : undefined}
            className={INPUT}
          />
        </label>
        <label className="flex flex-col gap-1.5 text-xs font-medium text-brand-charcoal-muted">
          {t.catalog.priceMin}
          <input
            type="number"
            inputMode="decimal"
            min={0}
            step="any"
            value={min}
            onChange={(e) => setMin(e.target.value)}
            placeholder={bounds ? String(Math.floor(bounds.min)) : undefined}
            className={INPUT}
          />
        </label>
      </div>
      <div className="flex gap-3">
        <Button type="submit" size="sm" className="flex-1">
          {t.catalog.apply}
        </Button>
        <Button type="button" size="sm" variant="outline" className="flex-1" onClick={() => onApply(undefined, undefined)}>
          {t.catalog.clear}
        </Button>
      </div>
    </form>
  )
}

/**
 * The catalog's sort and filter toolbar.
 * @param props.results - The current page of results: the applied brands, sort and price range, and the counts.
 * @param props.brands - The active brands, in display order (the brand filter's entries).
 * @param props.canUsePrices - Whether the visitor is a signed-in business customer (price range and price sorts).
 * @param props.className - Extra classes, e.g. spacing.
 * @returns The toolbar (a labelled group) and the active filters.
 */
export function CatalogToolbar({ results, brands, canUsePrices, className }: { results: ProductPage; brands: Brand[]; canUsePrices: boolean; className?: string }) {
  const { t, locale } = useI18n()
  const navigate = useNavigate()
  const [priceOpen, setPriceOpen] = useState(false)
  const phone = useMediaQuery(PHONE_QUERY)
  // The phone's open bottom sheet, if any.
  const [sheet, setSheet] = useState<'filters' | 'sort' | null>(null)
  const brandTrigger = useRef<HTMLButtonElement>(null)
  const { brands: applied, sort, priceRange, priceBounds, brandCounts } = results
  const sorts = CATALOG_SORTS.filter((s) => canUsePrices || !s.startsWith('price'))
  const brandName = new Map(brands.map((b) => [b.slug, b.name]))

  /**
   * Writes toolbar changes into the URL (a new history entry, the scroll kept) and goes back to page 1.
   * @param changes - The URL state to change (undefined removes a key).
   */
  const update = (changes: Changes) => {
    navigate({ to: '.', search: (prev: CatalogSearch) => ({ ...prev, ...changes, page: undefined }), resetScroll: false })
  }

  /**
   * Turns one brand on or off.
   * @param slug - The brand.
   * @param on - Whether to filter by it.
   */
  const toggleBrand = (slug: string, on: boolean) => {
    const next = on ? brands.map((b) => b.slug).filter((s) => s === slug || applied.includes(s)) : applied.filter((s) => s !== slug)
    update({ brand: next.length ? next.join(',') : undefined })
  }

  /**
   * Removes an active filter from its chip and gives the focus to the brand button (the chip is gone).
   * @param changes - The URL state that removes the filter.
   */
  const removeFilter = (changes: Changes) => {
    update(changes)
    brandTrigger.current?.focus()
  }

  /**
   * Applies the price range from the popover and closes it.
   * @param min - The lowest price (undefined = open).
   * @param max - The highest price (undefined = open).
   */
  const applyPrice = (min: number | undefined, max: number | undefined) => {
    setPriceOpen(false)
    update({ min, max })
  }

  const priceText =
    priceRange &&
    (priceRange.min !== null && priceRange.max !== null
      ? `${formatPrice(locale, priceRange.min)} – ${formatPrice(locale, priceRange.max)}`
      : priceRange.min !== null
        ? t.catalog.priceFrom.replace('{price}', formatPrice(locale, priceRange.min))
        : t.catalog.priceUpTo.replace('{price}', formatPrice(locale, priceRange.max ?? 0)))

  const sortLabel = `${t.catalog.sortLabel}: ${t.catalog.sorts[sort ?? 'default']}`
  const filterCount = applied.length + (priceRange ? 1 : 0)

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <div role="group" aria-label={t.catalog.toolbarLabel} className="flex flex-wrap items-center gap-2">
        {phone ? (
          <>
            <Offcanvas
              side="bottom"
              title={t.catalog.filters}
              open={sheet === 'filters'}
              onOpenChange={(open) => setSheet(open ? 'filters' : null)}
              trigger={
                <ToolbarTrigger
                  ref={brandTrigger}
                  label={filterCount ? t.catalog.filtersSelected.replace('{n}', String(filterCount)) : t.catalog.filters}
                  icon={<SlidersHorizontal aria-hidden="true" className="size-4" />}
                  active={filterCount > 0}
                />
              }
              footer={
                <Button className="w-full" onClick={() => setSheet(null)}>
                  {t.catalog.showResults.replace('{n}', String(results.total))}
                </Button>
              }
            >
              <fieldset>
                <legend className={LABEL_CLASS}>{t.catalog.brandLabel}</legend>
                <ul className="-mx-2 mt-2">
                  {brands.map((brand) => {
                    const checked = applied.includes(brand.slug)
                    const count = brandCounts[brand.slug] ?? 0
                    return (
                      <li key={brand.slug}>
                        <label className={SHEET_ROW}>
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={!checked && count === 0}
                            onChange={(e) => toggleBrand(brand.slug, e.target.checked)}
                            className={CHECKBOX_CLASS}
                          />
                          <span className="flex-1">{brand.name}</span>
                          <span aria-hidden="true" className="text-sm font-normal text-brand-charcoal-muted">
                            {count}
                          </span>
                        </label>
                      </li>
                    )
                  })}
                </ul>
              </fieldset>
              {canUsePrices && (
                <div className="mt-6 border-t border-neutral-150 pt-6">
                  <PriceRangeForm range={priceRange} bounds={priceBounds} onApply={(min, max) => update({ min, max })} />
                </div>
              )}
            </Offcanvas>
            <Offcanvas
              side="bottom"
              title={t.catalog.sortLabel}
              open={sheet === 'sort'}
              onOpenChange={(open) => setSheet(open ? 'sort' : null)}
              trigger={<ToolbarTrigger label={sortLabel} icon={<ArrowUpDown aria-hidden="true" className="size-4" />} className="ms-auto" />}
            >
              <fieldset>
                <legend className="sr-only">{t.catalog.sortLabel}</legend>
                <ul className="-mx-2">
                  {(['default', ...sorts] as const).map((value) => (
                    <li key={value}>
                      <label className={SHEET_ROW}>
                        <input
                          type="radio"
                          name="catalog-sort"
                          checked={(sort ?? 'default') === value}
                          onChange={() => {
                            update({ sort: value === 'default' ? undefined : (value as CatalogSort) })
                            setSheet(null)
                          }}
                          className={CHECKBOX_CLASS}
                        />
                        {t.catalog.sorts[value]}
                      </label>
                    </li>
                  ))}
                </ul>
              </fieldset>
            </Offcanvas>
          </>
        ) : (
          <>
            <DropdownMenu modal={false}>
              <DropdownMenuTrigger asChild>
                <ToolbarTrigger
                  ref={brandTrigger}
                  label={applied.length ? t.catalog.brandsSelected.replace('{n}', String(applied.length)) : t.catalog.brandLabel}
                  active={applied.length > 0}
                />
              </DropdownMenuTrigger>
              <DropdownMenuContent className={MENU}>
                {brands.map((brand) => {
                  const checked = applied.includes(brand.slug)
                  const count = brandCounts[brand.slug] ?? 0
                  return (
                    <DropdownMenuCheckboxItem
                      key={brand.slug}
                      checked={checked}
                      disabled={!checked && count === 0}
                      // Stay open, so several brands can be picked in a row.
                      onSelect={(e) => e.preventDefault()}
                      onCheckedChange={(on) => toggleBrand(brand.slug, on === true)}
                      className={MENU_ITEM}
                    >
                      <span className="flex-1">{brand.name}</span>
                      <span aria-hidden="true" className="text-xs text-brand-charcoal-muted">
                        {count}
                      </span>
                    </DropdownMenuCheckboxItem>
                  )
                })}
              </DropdownMenuContent>
            </DropdownMenu>

            {canUsePrices && (
              <Popover open={priceOpen} onOpenChange={setPriceOpen}>
                <PopoverTrigger asChild>
                  <ToolbarTrigger label={priceText ?? t.catalog.priceFilterLabel} active={!!priceRange} />
                </PopoverTrigger>
                <PopoverContent align="start" sideOffset={4}>
                  <PriceRangeForm range={priceRange} bounds={priceBounds} onApply={applyPrice} />
                </PopoverContent>
              </Popover>
            )}

            <DropdownMenu modal={false}>
              <DropdownMenuTrigger asChild>
                <ToolbarTrigger label={sortLabel} icon={<ArrowUpDown aria-hidden="true" className="size-4" />} className="ms-auto" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className={MENU}>
                <DropdownMenuRadioGroup value={sort ?? 'default'} onValueChange={(value) => update({ sort: value === 'default' ? undefined : (value as CatalogSort) })}>
                  {(['default', ...sorts] as const).map((value) => (
                    <DropdownMenuRadioItem key={value} value={value} className={MENU_ITEM}>
                      {t.catalog.sorts[value]}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        )}
      </div>

      {(applied.length > 0 || priceText) && (
        <div className="flex flex-wrap items-center gap-2">
          <ul aria-label={t.catalog.activeFilters} className="flex flex-wrap gap-2">
            {applied.map((slug) => (
              <FilterPill
                key={slug}
                label={brandName.get(slug) ?? slug}
                onRemove={() => {
                  const rest = applied.filter((s) => s !== slug)
                  removeFilter({ brand: rest.length ? rest.join(',') : undefined })
                }}
              />
            ))}
            {priceText && <FilterPill label={priceText} onRemove={() => removeFilter({ min: undefined, max: undefined })} />}
          </ul>
          <button
            type="button"
            onClick={() => removeFilter({ brand: undefined, min: undefined, max: undefined })}
            className={cn(textLinkVariants(), 'mx-2')}
          >
            {t.catalog.clearAll}
          </button>
        </div>
      )}
    </div>
  )
}
