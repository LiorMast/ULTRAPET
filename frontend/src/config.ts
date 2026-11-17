/**
 * config.ts — Site content and settings that are not translations and do not come from the API: the main
 * menu, the home page category cards, the labels of the stats figures, the header buttons, external links,
 * the contact cards (their phone, WhatsApp and email come from the API), the Private Label process's built-in steps and
 * the icons a flow step can have (PRIVATE_LABEL_STEPS, STEP_ICONS), the photos bundled with the site (hero, brand logos, article photos) and the fonts and size steps
 * staff can pick for editable texts (FONTS, SIZE_STEPS). Components take
 * their defaults from here, so changing the menu is a data change, not a component change. Data from the
 * database (catalog, brands, stats values, contact details, FAQ, articles, resellers) comes from src/api.ts.
 *
 * Labels are functions that pick a string from the current language's dictionary, which keeps this
 * file language-free. Internal links are built with TanStack's `linkOptions`, so a link to a route that
 * doesn't exist is a type error.
 */
import { linkOptions, type LinkOptions, type RegisteredRouter } from '@tanstack/react-router'
import { Award, ClipboardList, Factory, FlaskConical, Globe, Handshake, KeyRound, Lightbulb, Package, Palette, SearchCheck, Send, Ship, ShieldCheck, Truck, type LucideIcon } from 'lucide-react'
import type { ContactDetails, FontKey, ProductCategory, SizeStep } from '@/api'
import type { Locale } from '@/i18n'
import type { Dictionary } from '@/i18n/he'

/** Picks a translated label from the dictionary of the current language. */
export type Label = (t: Dictionary) => string

/** A link to a page of this site. Create it with `linkOptions(...)`, which checks the route exists. */
export type AppLink = LinkOptions<RegisteredRouter, string, string>

/** A dropdown entry: an internal link, or an external URL (`href`) that opens in a new tab. */
export type NavChild = { id: string; label: Label; divider?: boolean } & (
  | { link: AppLink }
  | { href: string }
)

/** A plain menu link: an id (the React key), a translated label and an internal link. */
export type NavLink = { id: string; label: Label; link: AppLink }

/**
 * A dropdown entry (Products): `children` open on hover; `link` is where a click on its label goes (the full catalog).
 */
export type NavDropdown = { id: string; label: Label; link: AppLink; children: NavChild[] }

/** A top-level menu entry: a link, or a dropdown with `children`. */
export type NavItem = NavLink | NavDropdown

/**
 * The PDF catalog without prices, in a language: the backend redirects to the current file in its storage (the
 * catalog it generates from the products, backend/app/catalog_pdf.py), so a new build needs no frontend change.
 * @param locale - The page language.
 * @returns The download URL.
 */
export const catalogPdfUrl = (locale: Locale) => `/api/catalog.pdf?lang=${locale}`

/**
 * Finds the file named after a slug among globbed asset files (e.g. "dog-food" -> .../dog-food.jpg).
 * @param files - Asset URLs keyed by path, from `import.meta.glob`.
 * @param slug - The item slug, e.g. "ultra-pet".
 * @returns The file URL, or undefined when no file is named after the slug.
 */
const fileBySlug = (files: Record<string, string>, slug: string) =>
  Object.entries(files).find(([path]) => /\/([^/]+)\.\w+$/.exec(path)?.[1] === slug)?.[1]

/** Every photo in src/assets/categories/, keyed by path; a category's photo is the file named after its slug. */
const categoryPhotoFiles = import.meta.glob<string>('/src/assets/categories/*.{png,jpg,jpeg,webp}', { eager: true, import: 'default' })

/**
 * The photo bundled with the site for a category: the file in src/assets/categories/ named after its slug.
 * @param slug - The category slug, e.g. "cat-litter".
 * @returns The file URL, or undefined when there is none.
 */
export const categoryPhoto = (slug: string) => fileBySlug(categoryPhotoFiles, slug)

/** A product category card: URL slug, label and optional photo (a bundled file; none = a plain white card). */
export type Category = { slug: string; label: Label; image?: string }

/**
 * The placeholder photos of the marketing categories: product photos of the old store, bundled in
 * src/assets/category-cards/ (named after the slug) and resized to an 800px WebP at build time.
 */
const categoryCardFiles = import.meta.glob<string>('/src/assets/category-cards/*.{png,jpg,jpeg,webp}', {
  eager: true,
  import: 'default',
  query: { w: '800', format: 'webp' },
})

/**
 * The marketing categories of legacy (from legacy/supabase-export/cms_categories.json), now only the article pages'
 * related categories and the /categories/$slug placeholder; the catalog's 15 store categories come from the API.
 * Each card shows the photo in src/assets/categories/ named after its slug, else its placeholder in
 * src/assets/category-cards/, else a plain white card.
 */
export const CATEGORIES: Category[] = [
  { slug: 'dog-food', label: (t: Dictionary) => t.categories.dogFood },
  { slug: 'cat-food', label: (t: Dictionary) => t.categories.catFood },
  { slug: 'wet-food', label: (t: Dictionary) => t.categories.wetFood },
  { slug: 'litter', label: (t: Dictionary) => t.categories.litter },
  { slug: 'small-animals', label: (t: Dictionary) => t.categories.smallAnimals },
  { slug: 'birds', label: (t: Dictionary) => t.categories.birds },
].map((category) => ({ ...category, image: fileBySlug(categoryPhotoFiles, category.slug) ?? fileBySlug(categoryCardFiles, category.slug) }))

/** The label of each home page figure, by the figure's id (the values come from the API, see fetchStats). */
export const STAT_LABELS: Record<string, Label> = {
  retail: (t: Dictionary) => t.stats.retail,
  partners: (t: Dictionary) => t.stats.partners,
  products: (t: Dictionary) => t.stats.products,
  years: (t: Dictionary) => t.stats.years,
}

/** An item of the About section (a vision pillar or an offering): title and description. */
export type AboutItem = { id: string; title: Label; text: Label }

/** Who the Business Customers section says Ultra Pet supplies. */
export const BUSINESS_AUDIENCES: AboutItem[] = [
  { id: 'stores', title: (t: Dictionary) => t.business.audiences.stores.title, text: (t: Dictionary) => t.business.audiences.stores.text },
  { id: 'chains', title: (t: Dictionary) => t.business.audiences.chains.title, text: (t: Dictionary) => t.business.audiences.chains.text },
  { id: 'distributors', title: (t: Dictionary) => t.business.audiences.distributors.title, text: (t: Dictionary) => t.business.audiences.distributors.text },
  { id: 'wholesalers', title: (t: Dictionary) => t.business.audiences.wholesalers.title, text: (t: Dictionary) => t.business.audiences.wholesalers.text },
]

/** The trust indicators of the Business Customers section. */
export const BUSINESS_TRUST: { id: string; label: Label }[] = [
  { id: 'retail', label: (t: Dictionary) => t.business.trust.retail },
  { id: 'partners', label: (t: Dictionary) => t.business.trust.partners },
  { id: 'quality', label: (t: Dictionary) => t.business.trust.quality },
  { id: 'logistics', label: (t: Dictionary) => t.business.trust.logistics },
]

/** How a business account is opened (the Business Customers section's flowchart): send a request, review, account. */
export const BUSINESS_STEPS: (AboutItem & { icon: LucideIcon })[] = [
  { id: 'request', icon: Send, title: (t: Dictionary) => t.business.steps.request.title, text: (t: Dictionary) => t.business.steps.request.text },
  { id: 'review', icon: SearchCheck, title: (t: Dictionary) => t.business.steps.review.title, text: (t: Dictionary) => t.business.steps.review.text },
  { id: 'open', icon: KeyRound, title: (t: Dictionary) => t.business.steps.open.title, text: (t: Dictionary) => t.business.steps.open.text },
]

/** The three vision-and-mission pillars of the About section. */
export const ABOUT_PILLARS: AboutItem[] = [
  { id: 'expertise', title: (t: Dictionary) => t.about.pillars.expertise.title, text: (t: Dictionary) => t.about.pillars.expertise.text },
  { id: 'service', title: (t: Dictionary) => t.about.pillars.service.title, text: (t: Dictionary) => t.about.pillars.service.text },
  { id: 'care', title: (t: Dictionary) => t.about.pillars.care.title, text: (t: Dictionary) => t.about.pillars.care.text },
]

/** What Ultra Pet offers, shown in the About section. */
export const ABOUT_OFFERS: AboutItem[] = [
  { id: 'food', title: (t: Dictionary) => t.about.offers.food.title, text: (t: Dictionary) => t.about.offers.food.text },
  { id: 'litter', title: (t: Dictionary) => t.about.offers.litter.title, text: (t: Dictionary) => t.about.offers.litter.text },
  { id: 'accessories', title: (t: Dictionary) => t.about.offers.accessories.title, text: (t: Dictionary) => t.about.offers.accessories.text },
  { id: 'private-label', title: (t: Dictionary) => t.about.offers.privateLabel.title, text: (t: Dictionary) => t.about.offers.privateLabel.text },
  { id: 'logistics', title: (t: Dictionary) => t.about.offers.logistics.title, text: (t: Dictionary) => t.about.offers.logistics.text },
]

/** The Ultra Pet advantages listed in the About section's dark panel. */
export const ABOUT_ADVANTAGES: { id: string; label: Label }[] = [
  { id: 'import', label: (t: Dictionary) => t.about.advantages.import },
  { id: 'prices', label: (t: Dictionary) => t.about.advantages.prices },
  { id: 'support', label: (t: Dictionary) => t.about.advantages.support },
]

/**
 * The icons staff can give a step of an editable flow (the Private Label process), by the key stored with the step
 * (FlowStep.icon); their names are t.privateLabel.icons.
 */
export const STEP_ICONS = {
  lightbulb: Lightbulb,
  palette: Palette,
  flask: FlaskConical,
  factory: Factory,
  ship: Ship,
  truck: Truck,
  shield: ShieldCheck,
  clipboard: ClipboardList,
  package: Package,
  globe: Globe,
  award: Award,
  handshake: Handshake,
} satisfies Record<string, LucideIcon>

/** A key of STEP_ICONS. */
export type StepIconKey = keyof typeof STEP_ICONS

/** The icon of a step whose stored icon is unknown, and of a step staff add. */
export const DEFAULT_STEP_ICON: StepIconKey = 'package'

/** The built-in steps of the Private Label process, in order; their texts are t.privateLabel.steps.<id>. */
export const PRIVATE_LABEL_STEPS: { id: keyof Dictionary['privateLabel']['steps']; icon: StepIconKey }[] = [
  { id: 'idea', icon: 'lightbulb' },
  { id: 'design', icon: 'palette' },
  { id: 'development', icon: 'flask' },
  { id: 'production', icon: 'factory' },
  { id: 'shipping', icon: 'ship' },
]

/** Every logo file in src/assets/brands/, keyed by path; a brand's logo is the file named after its slug. */
const brandLogoFiles = import.meta.glob<string>('/src/assets/brands/*.{svg,png,jpg,jpeg,webp}', { eager: true, import: 'default' })

/**
 * Finds a brand's bundled logo file (used when the API gives the brand no logoUrl).
 * @param slug - The brand slug, e.g. "ultra-pet".
 * @returns The logo URL, or undefined when no file in src/assets/brands/ is named after the slug.
 */
export const brandLogo = (slug: string) => fileBySlug(brandLogoFiles, slug)

/**
 * The main menu, in display order. An item has either `link` (an internal page or #section),
 * or `children` (a dropdown). A child has `link` or `href` (external URL, opens in a new tab), and
 * `divider: true` draws a separator line above it. The Products dropdown lists the catalog categories from
 * the database (same order as the live site), each linking to the catalog filtered by that category.
 * @param categories - The catalog categories from the API (fetchCategories), in display order.
 * @param locale - The page language, used to pick each category's name.
 * @returns The menu items.
 */
export const mainNav = (categories: ProductCategory[], locale: Locale): NavItem[] => [
  { id: 'brands', label: (t: Dictionary) => t.nav.brands, link: linkOptions({ to: '/', hash: 'brands' }) },
  {
    id: 'products',
    label: (t: Dictionary) => t.nav.products,
    link: linkOptions({ to: '/catalog' }),
    children: [
      { id: 'full-catalog', label: (t: Dictionary) => t.nav.fullCatalog, link: linkOptions({ to: '/catalog' }) },
      ...categories.map((category, i) => ({
        id: category.slug,
        divider: i === 0,
        label: () => localized(category.name, locale),
        link: linkOptions({ to: '/catalog', search: { category: category.slug } }),
      })),
      { id: 'catalog', label: (t: Dictionary) => t.nav.catalog, href: catalogPdfUrl(locale) },
    ],
  },
  { id: 'private-label', label: (t: Dictionary) => t.nav.privateLabel, link: linkOptions({ to: '/private-label' }) },
  { id: 'where-to-buy', label: (t: Dictionary) => t.nav.whereToBuy, link: linkOptions({ to: '/where-to-buy' }) },
  { id: 'articles', label: (t: Dictionary) => t.nav.articles, link: linkOptions({ to: '/articles' }) },
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

/**
 * Turns a vite-imagetools `srcset` string into an image whose plain `src` is the largest file.
 * @param srcSet - E.g. "/a-960.webp 960w, /a-1920.webp 1920w".
 * @returns The `src` + `srcSet` pair.
 */
const srcSetImage = (srcSet: string): HeroImage => ({ srcSet, src: srcSet.split(',').pop()!.trim().split(' ')[0] })

export const HERO_IMAGES: HeroImage[] = Object.entries(heroFiles)
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([, srcSet]) => srcSetImage(srcSet))

/** Links of the hero: its two call-to-action buttons and the scroll-down arrow (to the next section). */
export const HERO_LINKS = {
  brands: { label: (t: Dictionary) => t.hero.ctaBrands, link: linkOptions({ to: '/', hash: 'brands' }) },
  business: { label: (t: Dictionary) => t.hero.ctaBusiness, link: linkOptions({ to: '/', hash: 'business' }) },
  scrollDown: linkOptions({ to: '/', hash: 'stats' }),
}

/**
 * A font staff can pick for an editable text (the hero editor). `family` is the CSS font-family (undefined for
 * "default": the text keeps the site's own font token); `hebrew` = it has Hebrew letters, so it is offered on
 * Hebrew texts too; `load` downloads its self-hosted files (Vite splits each into its own CSS chunk) and is
 * undefined for the fonts every page already loads (src/index.css).
 */
export type FontOption = { name: string; family?: string; hebrew: boolean; load?: () => Promise<unknown> }

/** The fonts of the editable texts, in menu order ("default" is labelled from the dictionary, not `name`). */
export const FONTS: Record<FontKey, FontOption> = {
  default: { name: '', hebrew: true },
  heebo: { name: 'Heebo', family: '"Heebo Variable", Arial, sans-serif', hebrew: true },
  rubik: { name: 'Rubik', family: '"Rubik Variable", Arial, sans-serif', hebrew: true, load: () => import('@fontsource-variable/rubik/index.css') },
  assistant: { name: 'Assistant', family: '"Assistant Variable", Arial, sans-serif', hebrew: true, load: () => import('@fontsource-variable/assistant/index.css') },
  'frank-ruhl-libre': {
    name: 'Frank Ruhl Libre',
    family: '"Frank Ruhl Libre Variable", Georgia, serif',
    hebrew: true,
    load: () => import('@fontsource-variable/frank-ruhl-libre/index.css'),
  },
  inter: { name: 'Inter', family: '"Inter Variable", system-ui, sans-serif', hebrew: false },
  montserrat: { name: 'Montserrat', family: '"Montserrat Variable", system-ui, sans-serif', hebrew: false, load: () => import('@fontsource-variable/montserrat/index.css') },
}

/** The size steps of the editable texts, smallest first. */
export const SIZE_STEPS: SizeStep[] = ['sm', 'md', 'lg', 'xl']

/**
 * The fonts that can be picked for a text in one language: Hebrew texts only get fonts with Hebrew letters.
 * @param locale - The text's language.
 * @returns The font keys, in menu order.
 */
export const fontsFor = (locale: Locale) => (Object.keys(FONTS) as FontKey[]).filter((key) => locale !== 'he' || FONTS[key].hebrew)

/** The header's main call to action: "Business Account" → the business-customers section. */
export const HEADER_CTA = {
  label: (t: Dictionary) => t.nav.businessCta,
  link: linkOptions({ to: '/', hash: 'business' }),
}

/**
 * The pages of the staff panel, in menu order: the panel's own menu (routes/admin.tsx) and the header's admin
 * drawer (SubNavDrawer, opened by the Admin panel button) both list these. A new admin page = one entry here.
 */
export const ADMIN_NAV: NavLink[] = [
  { id: 'requests', label: (t: Dictionary) => t.admin.navRequests, link: linkOptions({ to: '/admin/requests' }) },
  { id: 'products', label: (t: Dictionary) => t.admin.navProducts, link: linkOptions({ to: '/admin/products' }) },
  { id: 'categories', label: (t: Dictionary) => t.admin.navCategories, link: linkOptions({ to: '/admin/categories' }) },
  { id: 'discounts', label: (t: Dictionary) => t.admin.navDiscounts, link: linkOptions({ to: '/admin/discounts' }) },
  { id: 'customers', label: (t: Dictionary) => t.admin.navCustomers, link: linkOptions({ to: '/admin/customers' }) },
  { id: 'brands', label: (t: Dictionary) => t.admin.navBrands, link: linkOptions({ to: '/admin/brands' }) },
]

/** The smallest order a business customer can place, in shekels (shown in the cart; checked at checkout). */
export const MIN_ORDER_AMOUNT = 2000

/** The header's login link (the B2B customer portal). */
export const HEADER_LOGIN = {
  label: (t: Dictionary) => t.nav.login,
  link: linkOptions({ to: '/login' }),
}

/** The header's "My account" link of a signed-in business customer (their profile: details, orders, discounts). */
export const HEADER_ACCOUNT = {
  label: (t: Dictionary) => t.login.account,
  link: linkOptions({ to: '/account' }),
}

/**
 * The link that opens a WhatsApp chat with a number.
 * @param number - The number as shown, international (e.g. "+972 52-214-2410"); only its digits are used.
 * @returns The wa.me URL.
 */
export const whatsappUrl = (number: string) => `https://wa.me/${number.replace(/\D/g, '')}`

/**
 * A contact card: label, sub-line and its value: one of the contact details staff edit (`detail`, from the API,
 * with the link `href` builds from it) or a dictionary text (`value`; no link, e.g. the opening hours).
 */
export type ContactMethod = { id: string; label: Label; sub: Label } & (
  | { detail: keyof ContactDetails; href: (value: string) => string }
  | { detail?: undefined; value: Label }
)

/** The contact cards of the Contact section, in display order (the details come from fetchContact). */
export const CONTACT_METHODS: ContactMethod[] = [
  { id: 'phone', label: (t: Dictionary) => t.contact.methods.phone.label, sub: (t: Dictionary) => t.contact.methods.phone.sub, detail: 'phone', href: (phone) => `tel:${phone.replace(/[^\d+]/g, '')}` },
  { id: 'whatsapp', label: (t: Dictionary) => t.contact.methods.whatsapp.label, sub: (t: Dictionary) => t.contact.methods.whatsapp.sub, detail: 'whatsapp', href: whatsappUrl },
  { id: 'email', label: (t: Dictionary) => t.contact.methods.email.label, sub: (t: Dictionary) => t.contact.methods.email.sub, detail: 'email', href: (email) => `mailto:${email}` },
  { id: 'hours', label: (t: Dictionary) => t.contact.methods.hours.label, sub: (t: Dictionary) => t.contact.methods.hours.sub, value: (t: Dictionary) => t.contact.methods.hours.value },
]

/** Text in every language that has it; Hebrew is always present and is the fallback. */
export type Localized<T> = { he: T } & Partial<Record<Locale, T>>

/**
 * Picks the text of one language from a localized field (e.g. an article title).
 * @param field - The localized value.
 * @param locale - The page language.
 * @returns The value in that language, or the Hebrew one when it has no translation.
 */
export const localized = <T,>(field: Localized<T>, locale: Locale): T => field[locale] ?? field.he

/** Every photo in src/assets/articles/ (named after the article slug), as WebP at 640w and 1280w. */
const articleImageFiles = import.meta.glob<string>('/src/assets/articles/*.{jpg,jpeg,png,webp}', {
  eager: true,
  import: 'default',
  query: { w: '640;1280', format: 'webp', as: 'srcset' },
})

/**
 * Finds an article's bundled photo (src/assets/articles/<slug>.*, resized to WebP at 640w and 1280w).
 * @param slug - The article slug.
 * @returns The photo's `src` + `srcSet`, or undefined when the article has no photo file.
 */
export function articleImage(slug: string): HeroImage | undefined {
  const srcSet = fileBySlug(articleImageFiles, slug)
  return srcSet ? srcSetImage(srcSet) : undefined
}
