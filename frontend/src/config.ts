/**
 * config.ts — Site content and settings that are not translations: the main menu, the product
 * categories, the header buttons and external links. Components take their defaults from here,
 * so changing the menu is a data change, not a component change.
 *
 * Labels are functions that pick a string from the current language's dictionary, which keeps this
 * file language-free. Internal links are built with TanStack's `linkOptions`, so a link to a route that
 * doesn't exist is a type error. (Backend phase: categories will come from the API instead.)
 */
import { linkOptions, type LinkOptions, type RegisteredRouter } from '@tanstack/react-router'
import { Bird, Bone, Cat, Dog, Download, Rabbit, Sparkles, type LucideIcon } from 'lucide-react'
import type { Dictionary } from '@/i18n/he'

/** Picks a translated label from the dictionary of the current language. */
export type Label = (t: Dictionary) => string

/** A link to a page of this site. Create it with `linkOptions(...)`, which checks the route exists. */
export type AppLink = LinkOptions<RegisteredRouter, string, string>

/** A dropdown entry: an internal link, or an external URL (`href`) that opens in a new tab. */
export type NavChild = { id: string; label: Label; icon?: LucideIcon; divider?: boolean } & (
  | { link: AppLink }
  | { href: string }
)

/** A top-level menu entry: a link, or a dropdown with `children`. */
export type NavItem = { id: string; label: Label } & ({ link: AppLink } | { children: NavChild[] })

/** The PDF catalog without prices (still hosted on the WordPress site until the backend serves it). */
export const CATALOG_PDF_URL = 'https://www.ultrapet.co.il/wp-content/uploads/2025/03/ultrapetcatalog.pdf'

/** Product categories (from legacy/supabase-export/cms_categories.json), each with a lucide icon. */
export const CATEGORIES = [
  { slug: 'dog-food', label: (t: Dictionary) => t.categories.dogFood, icon: Dog },
  { slug: 'cat-food', label: (t: Dictionary) => t.categories.catFood, icon: Cat },
  { slug: 'wet-food', label: (t: Dictionary) => t.categories.wetFood, icon: Bone },
  { slug: 'litter', label: (t: Dictionary) => t.categories.litter, icon: Sparkles },
  { slug: 'small-animals', label: (t: Dictionary) => t.categories.smallAnimals, icon: Rabbit },
  { slug: 'birds', label: (t: Dictionary) => t.categories.birds, icon: Bird },
]

/** A company figure shown in the home page Stats band: a number with a suffix ("+") and a short label. */
export type Stat = { id: string; value: number; suffix: string; label: Label }

/** The company figures, in display order (from legacy/supabase-export/cms_settings.json). Backend phase: from the API. */
export const STATS: Stat[] = [
  { id: 'retail', value: 350, suffix: '+', label: (t: Dictionary) => t.stats.retail },
  { id: 'partners', value: 15, suffix: '+', label: (t: Dictionary) => t.stats.partners },
  { id: 'products', value: 1000, suffix: '+', label: (t: Dictionary) => t.stats.products },
  { id: 'years', value: 12, suffix: '+', label: (t: Dictionary) => t.stats.years },
]

/** A brand shown on the home page: its URL slug, display name, accent color and optional logo file. */
export type Brand = { slug: string; name: string; accent: string; tagline: Label; logo?: string }

/** Every logo file in src/assets/brands/, keyed by path; a brand's logo is the file named after its slug. */
const brandLogoFiles = import.meta.glob<string>('/src/assets/brands/*.{svg,png,jpg,jpeg,webp}', { eager: true, import: 'default' })

/**
 * Finds a brand's logo file.
 * @param slug - The brand slug, e.g. "ultra-pet".
 * @returns The logo URL, or undefined when no file in src/assets/brands/ is named after the slug.
 */
const brandLogo = (slug: string) => Object.entries(brandLogoFiles).find(([path]) => /\/([^/]+)\.\w+$/.exec(path)?.[1] === slug)?.[1]

/** The brands, in display order (from legacy/supabase-export/cms_brands.json). Backend phase: from the API. */
export const BRANDS: Brand[] = [
  { slug: 'ultra-pet', name: 'Ultra Pet', accent: '#BE1E24', tagline: (t: Dictionary) => t.brands.taglines.ultraPet },
  { slug: 'internutri', name: 'Internutri', accent: '#1C4E80', tagline: (t: Dictionary) => t.brands.taglines.internutri },
  { slug: 'greenheart', name: 'Greenheart Premiums', accent: '#2D6A4F', tagline: (t: Dictionary) => t.brands.taglines.greenheart },
  { slug: 'paw', name: 'Paw', accent: '#C97D30', tagline: (t: Dictionary) => t.brands.taglines.paw },
  { slug: 'jr-farm', name: 'JR Farm', accent: '#4A7C42', tagline: (t: Dictionary) => t.brands.taglines.jrFarm },
  { slug: 'ultra-clean', name: 'Ultra Clean', accent: '#4A4A6A', tagline: (t: Dictionary) => t.brands.taglines.ultraClean },
].map((brand) => ({ ...brand, logo: brandLogo(brand.slug) }))

/**
 * The main menu, in display order. An item has either `link` (an internal page or #section),
 * or `children` (a dropdown). A child has `link` or `href` (external URL, opens in a new tab), and
 * `divider: true` draws a separator line above it.
 */
export const MAIN_NAV: NavItem[] = [
  { id: 'brands', label: (t: Dictionary) => t.nav.brands, link: linkOptions({ to: '/', hash: 'brands' }) },
  {
    id: 'products',
    label: (t: Dictionary) => t.nav.products,
    children: [
      ...CATEGORIES.map((category) => ({
        id: category.slug,
        label: category.label,
        icon: category.icon,
        link: linkOptions({ to: '/categories/$slug', params: { slug: category.slug } }),
      })),
      {
        id: 'all-categories',
        label: (t: Dictionary) => t.nav.allCategories,
        divider: true,
        link: linkOptions({ to: '/', hash: 'categories' }),
      },
      { id: 'catalog', label: (t: Dictionary) => t.nav.catalog, icon: Download, href: CATALOG_PDF_URL },
    ],
  },
  { id: 'private-label', label: (t: Dictionary) => t.nav.privateLabel, link: linkOptions({ to: '/', hash: 'private-label' }) },
  { id: 'where-to-buy', label: (t: Dictionary) => t.nav.whereToBuy, link: linkOptions({ to: '/where-to-buy' }) },
  { id: 'about', label: (t: Dictionary) => t.nav.about, link: linkOptions({ to: '/', hash: 'about' }) },
  { id: 'contact', label: (t: Dictionary) => t.nav.contact, link: linkOptions({ to: '/', hash: 'contact' }) },
]

/** One hero photo: the default file plus a ready-made `srcset` (WebP at 960w and 1920w). */
export type HeroImage = { src: string; srcSet: string }

/**
 * The hero photos: every .jpg/.jpeg/.png/.webp file in src/assets/hero/, in filename order (name them
 * 01-..., 02-... to control the order). vite-imagetools resizes each one into WebP files at 960w and
 * 1920w and returns the `srcset` string; the largest file doubles as the plain `src`.
 */
const heroFiles = import.meta.glob<string>('/src/assets/hero/*.{jpg,jpeg,png,webp}', {
  eager: true,
  import: 'default',
  query: { w: '960;1920', format: 'webp', as: 'srcset' },
})
export const HERO_IMAGES: HeroImage[] = Object.entries(heroFiles)
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([, srcSet]) => ({ srcSet, src: srcSet.split(',').pop()!.trim().split(' ')[0] }))

/** Links of the hero: its two call-to-action buttons and the scroll-down arrow (to the next section). */
export const HERO_LINKS = {
  brands: { label: (t: Dictionary) => t.hero.ctaBrands, link: linkOptions({ to: '/', hash: 'brands' }) },
  business: { label: (t: Dictionary) => t.hero.ctaBusiness, link: linkOptions({ to: '/', hash: 'business' }) },
  scrollDown: linkOptions({ to: '/', hash: 'stats' }),
}

/** The header's main call to action: "Business Account" → the business-customers section. */
export const HEADER_CTA = {
  label: (t: Dictionary) => t.nav.businessCta,
  link: linkOptions({ to: '/', hash: 'business' }),
}

/** The header's login link (the B2B customer portal). */
export const HEADER_LOGIN = {
  label: (t: Dictionary) => t.nav.login,
  link: linkOptions({ to: '/login' }),
}
