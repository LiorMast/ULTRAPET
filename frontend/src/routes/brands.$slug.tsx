/**
 * routes/brands.$slug.tsx — A brand's page, e.g. /brands/jr-farm. Unknown or hidden brands show "not found". The
 * loader fetches the brand, its first products (the catalog API filtered by the brand), the categories (to name the
 * ones the brand's products are in) and the other brands.
 *
 * The page follows the product page (routes/products.$slug.tsx): breadcrumbs (home > brands > brand); the brand's
 * logo where the product page has its gallery, beside the tagline, name, description and details (its number of
 * products, its categories as links into the filtered catalog) and the calls to action ("View all N products" =
 * /catalog?brand=<slug>, "Become a business customer"); then the brand's products as catalog cards (a signed-in
 * customer's prices and "Add to cart", "log in to see the price" for everyone else) and the other brands.
 *
 * SEO: its `head` sets the brand's title, a description from its text (else its tagline), the canonical and hreflang
 * links, og:image (the logo), and Brand + BreadcrumbList JSON-LD.
 */
import type { ReactNode } from 'react'
import { createFileRoute, Link, linkOptions } from '@tanstack/react-router'
import { ArrowRight } from 'lucide-react'
import { fetchBrand, fetchBrands, fetchCategories, fetchProducts, rethrowNotFound, type Brand } from '@/api'
import { useCustomerPrices } from '@/auth'
import { BrandCard } from '@/components/BrandCard'
import { Breadcrumbs } from '@/components/Breadcrumbs'
import { Carousel } from '@/components/Carousel'
import { CatalogCard, priceFor, stockFor } from '@/components/CatalogCard'
import { Button } from '@/components/ui/button'
import { brandLogo, HERO_LINKS, localized, type AppLink } from '@/config'
import { dictionaryFor, localizePath, useI18n } from '@/i18n'
import { absoluteUrl, breadcrumbJsonLd, metaDescription, pageHead } from '@/seo'

/** How many of the brand's products the page shows (the rest are one click away in the filtered catalog). */
const PRODUCTS_SHOWN = 8

/** How many brand cards one page of the "More brands" carousel holds on a wide screen (as on the home page). */
const BRANDS_PER_PAGE = 3

export const Route = createFileRoute('/brands/$slug')({
  loader: async ({ params, context, abortController }) => {
    const { signal } = abortController
    const [brand, products, categories, brands] = await Promise.all([
      fetchBrand(params.slug, signal).catch(rethrowNotFound),
      fetchProducts({ brand: params.slug }, context.locale, signal, PRODUCTS_SHOWN),
      fetchCategories(signal),
      fetchBrands(signal),
    ])
    return { brand, products, categories, brands }
  },
  head: ({ match, loaderData }) => {
    if (!loaderData) return {}
    const { brand } = loaderData
    const { locale } = match.context
    const t = dictionaryFor(locale)
    const path = `/brands/${brand.slug}`
    const description = brand.description ? localized(brand.description, locale) : undefined
    const tagline = brand.tagline ? localized(brand.tagline, locale) : undefined
    const logo = logoOf(brand)
    return pageHead({
      locale,
      path,
      title: brand.name,
      description: metaDescription((description ?? tagline ?? '').replace(/\s+/g, ' ').trim()),
      image: logo,
      jsonLd: [
        {
          '@context': 'https://schema.org',
          '@type': 'Brand',
          name: brand.name,
          slogan: tagline,
          description,
          logo: logo ? absoluteUrl(logo) : undefined,
          url: absoluteUrl(localizePath(path, locale)),
        },
        breadcrumbJsonLd(locale, [
          { name: t.articles.home, path: '/' },
          { name: t.brandPage.brands, path: '/#brands' },
          { name: brand.name, path },
        ]),
      ],
    })
  },
  component: BrandPage,
})

/**
 * The brand's logo: the uploaded one, else the file bundled with the site.
 * @param brand - The brand.
 * @returns The logo URL, or undefined when it has none (the page shows the name as a wordmark).
 */
function logoOf(brand: Brand) {
  return brand.logoUrl ?? brandLogo(brand.slug)
}

/**
 * The brand's logo panel, in the place of the product page's gallery: the logo (or the name as a wordmark in the
 * brand's color) on a pale panel, with a line in the brand's accent color along its bottom edge, like BrandCard's.
 * @param props.brand - The brand.
 * @returns The panel (decorative: the name is the page's <h1>).
 */
function BrandLogoPanel({ brand }: { brand: Brand }) {
  const logo = logoOf(brand)
  const accent = brand.accent ?? 'var(--color-brand-red)'
  return (
    <div className="relative flex aspect-[4/3] items-center justify-center overflow-hidden bg-neutral-50 p-10">
      {logo ? (
        <img src={logo} alt="" width={480} height={360} className="max-h-full w-auto max-w-[70%] object-contain" />
      ) : (
        <span aria-hidden="true" className="text-center font-heading text-4xl font-bold uppercase tracking-widest lg:text-5xl" style={{ color: accent }}>
          {brand.name}
        </span>
      )}
      <span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-1" style={{ backgroundColor: accent }} />
    </div>
  )
}

/**
 * A secondary call to action: red uppercase text with an arrow that points along the reading direction.
 * @param props.link - Where it goes (linkOptions).
 * @param props.children - The text.
 * @returns The link.
 */
function ArrowLink({ link, children }: { link: AppLink; children: ReactNode }) {
  return (
    <Link
      {...link}
      className="group inline-flex items-center gap-2 font-heading text-xs font-bold uppercase tracking-widest text-brand-red-dark hover:underline focus-visible:ring-2 focus-visible:ring-brand-red/60"
    >
      {children}
      <ArrowRight aria-hidden="true" className="size-4 transition-transform duration-300 group-hover:translate-x-1 rtl:rotate-180 rtl:group-hover:-translate-x-1" />
    </Link>
  )
}

/**
 * The brand page.
 * @returns The brand, its products and the other brands.
 */
function BrandPage() {
  const { t, locale } = useI18n()
  const { brand, products, categories, brands } = Route.useLoaderData()
  const prices = useCustomerPrices()
  const categoryName = new Map(categories.map((category) => [category.slug, localized(category.name, locale)]))
  const brandCategories = categories.filter((category) => (products.categoryCounts[category.slug] ?? 0) > 0)
  const others = brands.filter((other) => other.slug !== brand.slug)
  const catalogLink = linkOptions({ to: '/catalog', search: { brand: brand.slug } })
  // Plain text: staff type it in a text box, so blank lines separate the paragraphs.
  const paragraphs = brand.description ? localized(brand.description, locale).split(/\n\s*\n/).filter((p) => p.trim()) : []

  return (
    <>
      <article aria-labelledby="brand-title" className="mx-auto max-w-screen-2xl px-6 py-12 lg:px-10 lg:py-16">
        <Breadcrumbs
          items={[
            { label: t.articles.home, link: linkOptions({ to: '/' }) },
            { label: t.brandPage.brands, link: linkOptions({ to: '/', hash: 'brands' }) },
            { label: brand.name },
          ]}
        />

        <div className="mt-10 grid gap-10 lg:grid-cols-2 lg:gap-16">
          <BrandLogoPanel brand={brand} />

          <div className="flex flex-col">
            {brand.tagline && (
              <p className="font-heading text-xs font-bold uppercase tracking-widest text-brand-red-dark">{localized(brand.tagline, locale)}</p>
            )}
            <h1 id="brand-title" className="mt-4 font-display text-3xl font-bold text-brand-charcoal lg:text-4xl">
              {brand.name}
            </h1>
            {paragraphs.map((paragraph, index) => (
              <p key={index} className="mt-6 max-w-prose text-brand-charcoal-muted">
                {paragraph}
              </p>
            ))}

            <dl className="mt-8 divide-y divide-neutral-150 border-y border-neutral-150 text-sm">
              <div className="flex gap-2 py-4">
                <dt className="text-brand-charcoal-muted">{t.brandPage.products}:</dt>
                <dd className="font-semibold text-brand-charcoal">{products.total}</dd>
              </div>
              {brandCategories.length > 0 && (
                <div className="flex flex-wrap gap-x-2 gap-y-1 py-4">
                  <dt className="text-brand-charcoal-muted">{t.brandPage.categories}:</dt>
                  <dd className="flex flex-wrap gap-x-4 gap-y-1">
                    {brandCategories.map((category) => (
                      <Link
                        key={category.slug}
                        to="/catalog"
                        search={{ brand: brand.slug, category: category.slug }}
                        className="font-semibold text-brand-charcoal hover:text-brand-red-dark hover:underline focus-visible:ring-2 focus-visible:ring-brand-red/60"
                      >
                        {localized(category.name, locale)}
                      </Link>
                    ))}
                  </dd>
                </div>
              )}
            </dl>

            <div className="mt-8 flex flex-wrap items-center gap-x-8 gap-y-4">
              {products.total > 0 && (
                <Button asChild>
                  <Link {...catalogLink}>{t.brandPage.viewAll.replace('{n}', String(products.total))}</Link>
                </Button>
              )}
              <ArrowLink link={HERO_LINKS.business.link}>{HERO_LINKS.business.label(t)}</ArrowLink>
            </div>
            <p className="mt-4 text-sm text-brand-charcoal-muted">{t.product.wholesale}</p>
          </div>
        </div>
      </article>

      {products.items.length > 0 && (
        <section aria-labelledby="brand-products-title" className="bg-neutral-50 px-6 py-16 lg:px-10 lg:py-20">
          <div className="mx-auto max-w-screen-2xl">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <h2 id="brand-products-title" className="font-display text-3xl font-bold text-brand-charcoal">
                {t.brandPage.productsTitle.replace('{brand}', brand.name)}
              </h2>
              {products.total > products.items.length && (
                <ArrowLink link={catalogLink}>{t.brandPage.viewAllShort}</ArrowLink>
              )}
            </div>
            <ul className="mt-8 grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
              {products.items.map((product) => (
                <li key={product.id} className="flex">
                  <CatalogCard
                    product={product}
                    categoryName={categoryName.get(product.category)}
                    price={priceFor(prices, product.id)}
                    stock={stockFor(prices, product.id)}
                    className="w-full"
                  />
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {others.length > 0 && (
        <section aria-labelledby="other-brands-title" className="bg-black px-6 py-16 lg:px-10 lg:py-20">
          <div className="mx-auto max-w-7xl">
            <h2 id="other-brands-title" className="font-display text-3xl font-bold text-white">
              {t.brandPage.otherBrands}
            </h2>
            <Carousel label={t.brands.carouselLabel} pageSize={BRANDS_PER_PAGE} tone="dark" className="mt-10">
              {others.map((other) => (
                <BrandCard key={other.slug} brand={other} className="w-full" />
              ))}
            </Carousel>
          </div>
        </section>
      )}
    </>
  )
}
