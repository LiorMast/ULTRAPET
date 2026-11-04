/**
 * config.ts — Site content and settings that are not translations and do not come from the API: the main
 * menu, the home page category cards, the labels of the stats figures, the header buttons, external links,
 * contact facts, the photos bundled with the site (hero, brand logos, article photos) and the fonts and size steps
 * staff can pick for editable texts (FONTS, SIZE_STEPS). Components take
 * their defaults from here, so changing the menu is a data change, not a component change. Data from the
 * database (catalog, brands, stats values, articles, resellers) comes from src/api.ts.
 *
 * Labels are functions that pick a string from the current language's dictionary, which keeps this
 * file language-free. Internal links are built with TanStack's `linkOptions`, so a link to a route that
 * doesn't exist is a type error.
 */
import { linkOptions, type LinkOptions, type RegisteredRouter } from '@tanstack/react-router'
import { BadgeCheck, Bird, Bone, Boxes, Cat, Dog, Clock, Handshake, Heart, Mail, MessageCircle, Package, Phone, PawPrint, Rabbit, Sparkles, Tag, Truck, type LucideIcon } from 'lucide-react'
import type { FontKey, ProductCategory, SizeStep } from '@/api'
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

/** A top-level menu entry: a link, or a dropdown with `children`. */
export type NavItem = { id: string; label: Label } & ({ link: AppLink } | { children: NavChild[] })

/** The PDF catalog without prices (still hosted on the WordPress site until the backend serves it). */
export const CATALOG_PDF_URL = 'https://www.ultrapet.co.il/wp-content/uploads/2025/03/ultrapetcatalog.pdf'

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

/** A product category card: URL slug, label, fallback icon and optional photo (a file in src/assets/categories/, else a placeholder URL). */
export type Category = { slug: string; label: Label; icon: LucideIcon; image?: string }

/**
 * The home page's marketing categories (from legacy/supabase-export/cms_categories.json; the catalog's 15
 * store categories come from the API). Until real photos are dropped into src/assets/categories/, each card
 * shows a placeholder: a product photo from the WordPress store.
 */
export const CATEGORIES: Category[] = [
  { slug: 'dog-food', label: (t: Dictionary) => t.categories.dogFood, icon: Dog, placeholder: 'https://www.ultrapet.co.il/wp-content/uploads/2026/05/45f8dcaa-598f-4d57-91c3-e59a834a5d80.png' },
  { slug: 'cat-food', label: (t: Dictionary) => t.categories.catFood, icon: Cat, placeholder: 'https://www.ultrapet.co.il/wp-content/uploads/2024/03/easy-cat-3d-sakoyla_-1-463x1024-1.png' },
  { slug: 'wet-food', label: (t: Dictionary) => t.categories.wetFood, icon: Bone, placeholder: 'https://www.ultrapet.co.il/wp-content/uploads/2025/01/Ultrapet-52.-Web.jpg' },
  { slug: 'litter', label: (t: Dictionary) => t.categories.litter, icon: Sparkles, placeholder: 'https://www.ultrapet.co.il/wp-content/uploads/2024/03/71gTdjfLT0L._AC_SL1500_-2.jpg' },
  { slug: 'small-animals', label: (t: Dictionary) => t.categories.smallAnimals, icon: Rabbit, placeholder: 'https://www.ultrapet.co.il/wp-content/uploads/2025/10/01850.jpg' },
  { slug: 'birds', label: (t: Dictionary) => t.categories.birds, icon: Bird, placeholder: 'https://www.ultrapet.co.il/wp-content/uploads/2025/10/08460.jpg' },
].map(({ placeholder, ...category }) => ({ ...category, image: fileBySlug(categoryPhotoFiles, category.slug) ?? placeholder }))

/** The label of each home page figure, by the figure's id (the values come from the API, see fetchStats). */
export const STAT_LABELS: Record<string, Label> = {
  retail: (t: Dictionary) => t.stats.retail,
  partners: (t: Dictionary) => t.stats.partners,
  products: (t: Dictionary) => t.stats.products,
  years: (t: Dictionary) => t.stats.years,
}

/** An item of the About section (a vision pillar or an offering): icon, title and description. */
export type AboutItem = { id: string; icon: LucideIcon; title: Label; text: Label }

/** The three vision-and-mission pillars of the About section. */
export const ABOUT_PILLARS: AboutItem[] = [
  { id: 'expertise', icon: BadgeCheck, title: (t: Dictionary) => t.about.pillars.expertise.title, text: (t: Dictionary) => t.about.pillars.expertise.text },
  { id: 'service', icon: Handshake, title: (t: Dictionary) => t.about.pillars.service.title, text: (t: Dictionary) => t.about.pillars.service.text },
  { id: 'care', icon: Heart, title: (t: Dictionary) => t.about.pillars.care.title, text: (t: Dictionary) => t.about.pillars.care.text },
]

/** What Ultra Pet offers, shown in the About section. */
export const ABOUT_OFFERS: AboutItem[] = [
  { id: 'food', icon: Bone, title: (t: Dictionary) => t.about.offers.food.title, text: (t: Dictionary) => t.about.offers.food.text },
  { id: 'litter', icon: Sparkles, title: (t: Dictionary) => t.about.offers.litter.title, text: (t: Dictionary) => t.about.offers.litter.text },
  { id: 'accessories', icon: PawPrint, title: (t: Dictionary) => t.about.offers.accessories.title, text: (t: Dictionary) => t.about.offers.accessories.text },
  { id: 'private-label', icon: Tag, title: (t: Dictionary) => t.about.offers.privateLabel.title, text: (t: Dictionary) => t.about.offers.privateLabel.text },
  { id: 'logistics', icon: Boxes, title: (t: Dictionary) => t.about.offers.logistics.title, text: (t: Dictionary) => t.about.offers.logistics.text },
]

/** The Ultra Pet advantages listed in the About section's dark panel. */
export const ABOUT_ADVANTAGES: { id: string; icon: LucideIcon; label: Label }[] = [
  { id: 'import', icon: Truck, label: (t: Dictionary) => t.about.advantages.import },
  { id: 'prices', icon: Tag, label: (t: Dictionary) => t.about.advantages.prices },
  { id: 'support', icon: Package, label: (t: Dictionary) => t.about.advantages.support },
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
    children: [
      { id: 'full-catalog', label: (t: Dictionary) => t.nav.fullCatalog, link: linkOptions({ to: '/catalog' }) },
      ...categories.map((category, i) => ({
        id: category.slug,
        divider: i === 0,
        label: () => localized(category.name, locale),
        link: linkOptions({ to: '/catalog', search: { category: category.slug } }),
      })),
      { id: 'catalog', label: (t: Dictionary) => t.nav.catalog, href: CATALOG_PDF_URL },
    ],
  },
  { id: 'private-label', label: (t: Dictionary) => t.nav.privateLabel, link: linkOptions({ to: '/', hash: 'private-label' }) },
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
  montserrat: { name: 'Montserrat', family: '"Montserrat Variable", system-ui, sans-serif', hebrew: false },
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

/** The header's login link (the B2B customer portal). */
export const HEADER_LOGIN = {
  label: (t: Dictionary) => t.nav.login,
  link: linkOptions({ to: '/login' }),
}

/** Real contact facts (from the live site; the email is unconfirmed by the owner). Backend phase: from the CMS. */
export const CONTACT = {
  phone: '1700-55-99-92',
  whatsapp: '972522142410',
  whatsappDisplay: '+972 52-214-2410',
  email: 'office@ultrapet.co.il',
}

/** A contact card: icon, label, value, a sub-line and an optional link (no link = plain text, e.g. hours). */
export type ContactMethod = { id: string; icon: LucideIcon; label: Label; value: Label; sub: Label; href?: string }

/** The contact cards of the Contact section, in display order. */
export const CONTACT_METHODS: ContactMethod[] = [
  { id: 'phone', icon: Phone, label: (t: Dictionary) => t.contact.methods.phone.label, value: () => CONTACT.phone, sub: (t: Dictionary) => t.contact.methods.phone.sub, href: `tel:${CONTACT.phone.replaceAll('-', '')}` },
  { id: 'whatsapp', icon: MessageCircle, label: (t: Dictionary) => t.contact.methods.whatsapp.label, value: () => CONTACT.whatsappDisplay, sub: (t: Dictionary) => t.contact.methods.whatsapp.sub, href: `https://wa.me/${CONTACT.whatsapp}` },
  { id: 'email', icon: Mail, label: (t: Dictionary) => t.contact.methods.email.label, value: () => CONTACT.email, sub: (t: Dictionary) => t.contact.methods.email.sub, href: `mailto:${CONTACT.email}` },
  { id: 'hours', icon: Clock, label: (t: Dictionary) => t.contact.methods.hours.label, value: (t: Dictionary) => t.contact.methods.hours.value, sub: (t: Dictionary) => t.contact.methods.hours.sub },
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
