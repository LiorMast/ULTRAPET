/**
 * routes/products.$slug.tsx — One product's page, e.g. /products/internutri-original-dog-beef-... (the slugs are the
 * old store's, Hebrew words included). Unknown or hidden products show "not found". The loader fetches the product
 * from the API: its gallery, description and related products.
 *
 * The page follows the old WordPress product page: breadcrumbs (home > catalog > category > product); the gallery
 * beside the title, the product details (brand, item code, barcode), the price slot (a signed-in customer's price,
 * "log in to see the price" for everyone else; with a price, the stock status when the product's stock is tracked
 * (In stock / Low stock / Out of stock), a quantity stepper and "Add to cart", or a disabled "Out of stock" button) and
 * the shipping and returns notes; then the full description and
 * "You may also like" (CatalogCards of the same category).
 *
 * SEO: its `head` sets the product's title, a description from its text, the canonical and hreflang links,
 * og:image, and Product + BreadcrumbList JSON-LD. No price ever appears in the head (the public site has none).
 */
import { useState } from 'react'
import { createFileRoute, Link, linkOptions } from '@tanstack/react-router'
import { RotateCcw, Truck, type LucideIcon } from 'lucide-react'
import { fetchProduct, rethrowNotFound, type ProductDetail } from '@/api'
import { useCustomerPrices } from '@/auth'
import { AddToCartButton, CART_FLY_SOURCE_ATTR } from '@/components/AddToCartButton'
import { Breadcrumbs } from '@/components/Breadcrumbs'
import { CatalogCard, PriceSlot, priceFor, stockFor } from '@/components/CatalogCard'
import { DiscountRibbon, STOCK_RIBBONS } from '@/components/DiscountRibbon'
import { ProductGallery } from '@/components/ProductGallery'
import { QuantityStepper } from '@/components/QuantityStepper'
import { RichText } from '@/components/RichText'
import { localized } from '@/config'
import { dictionaryFor, localizePath, useI18n, type Locale } from '@/i18n'
import { absoluteUrl, breadcrumbJsonLd, metaDescription, pageHead } from '@/seo'

export const Route = createFileRoute('/products/$slug')({
  loader: ({ params, abortController }) => fetchProduct(params.slug, abortController.signal).catch(rethrowNotFound),
  head: ({ match, loaderData: product }) => {
    if (!product) return {}
    const { locale } = match.context
    const t = dictionaryFor(locale)
    const path = productPath(product.slug)
    const name = localized(product.name, locale)
    const category = localized(product.category.name, locale)
    const text = plainText(descriptionOf(product, locale)?.html ?? '')
    return pageHead({
      locale,
      path,
      title: name,
      description: metaDescription(text),
      image: product.images[0]?.src,
      jsonLd: [
        {
          '@context': 'https://schema.org',
          '@type': 'Product',
          name,
          description: text || undefined,
          image: product.images.length ? product.images.map((image) => absoluteUrl(image.src)) : undefined,
          sku: product.sku ?? undefined,
          gtin13: product.barcode?.length === 13 ? product.barcode : undefined,
          brand: product.brand ? { '@type': 'Brand', name: product.brand.name } : undefined,
          category,
          url: absoluteUrl(localizePath(path, locale)),
        },
        breadcrumbJsonLd(locale, [
          { name: t.articles.home, path: '/' },
          { name: t.nav.fullCatalog, path: '/catalog' },
          { name: category, path: `/catalog?category=${product.category.slug}` },
          { name, path },
        ]),
      ],
    })
  },
  component: ProductPage,
})

/**
 * The internal path of a product page, with the slug percent-encoded (it holds Hebrew words).
 * @param slug - The product's URL name.
 * @returns E.g. "/products/dog-chew".
 */
function productPath(slug: string) {
  return `/products/${encodeURIComponent(slug)}`
}

/**
 * Picks the description to show: the page language's, else the Hebrew one.
 * @param product - The product.
 * @param locale - The page language.
 * @returns The HTML and its language, or null when the product has no description.
 */
function descriptionOf(product: ProductDetail, locale: Locale): { html: string; lang: Locale } | null {
  const own = product.description[locale]
  if (own) return { html: own, lang: locale }
  return product.description.he ? { html: product.description.he, lang: 'he' } : null
}

/**
 * The text of sanitized HTML: tags become spaces, the few entities the sanitizer writes are decoded.
 * @param html - The HTML.
 * @returns The text, whitespace collapsed.
 */
function plainText(html: string) {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * One row of the shipping and returns notes.
 * @param props.icon - Its lucide icon.
 * @param props.title - The note's title, e.g. "Shipping".
 * @param props.text - The note.
 * @returns The row (a <div> of the notes' <dl>, holding only its <dt> and <dd>, as HTML requires).
 */
function ServiceNote({ icon: Icon, title, text }: { icon: LucideIcon; title: string; text: string }) {
  return (
    <div className="py-4">
      <dt className="flex items-center gap-4 font-heading text-xs font-bold uppercase tracking-widest text-brand-charcoal">
        <Icon aria-hidden="true" className="size-5 shrink-0 text-brand-red" />
        {title}
      </dt>
      <dd className="mt-1 ps-9 text-sm text-brand-charcoal-muted">{text}</dd>
    </div>
  )
}

/**
 * The product page.
 * @returns The product and its related products.
 */
function ProductPage() {
  const { t, locale } = useI18n()
  const product = Route.useLoaderData()
  const prices = useCustomerPrices()
  const price = priceFor(prices, product.id)
  const stock = stockFor(prices, product.id)
  // The quantity to add belongs to this product: opening another product (same component) starts again at 1.
  const [chosen, setChosen] = useState({ id: product.id, quantity: 1 })
  const quantity = chosen.id === product.id ? chosen.quantity : 1
  /**
   * Sets the quantity to add for this product.
   * @param next - The new quantity.
   */
  const setQuantity = (next: number) => setChosen({ id: product.id, quantity: next })
  const name = localized(product.name, locale)
  const categoryName = localized(product.category.name, locale)
  const description = descriptionOf(product, locale)
  const categoryLink = linkOptions({ to: '/catalog', search: { category: product.category.slug } })
  const details = [
    product.sku && { label: t.product.sku, value: product.sku },
    product.barcode && { label: t.product.barcode, value: product.barcode },
  ].filter((detail) => !!detail)

  return (
    <>
      <article aria-labelledby="product-title" className="mx-auto max-w-screen-2xl px-6 py-12 lg:px-10 lg:py-16">
        <Breadcrumbs
          items={[
            { label: t.articles.home, link: linkOptions({ to: '/' }) },
            { label: t.nav.fullCatalog, link: linkOptions({ to: '/catalog' }) },
            { label: categoryName, link: categoryLink },
            { label: name },
          ]}
        />

        {/* The gallery's large photo is the one that flies to the cart. */}
        <div {...{ [CART_FLY_SOURCE_ATTR]: '' }} className="mt-10 grid gap-10 lg:grid-cols-2 lg:gap-16">
          <ProductGallery images={product.images} name={name} />

          <div className="flex flex-col">
            <Link
              {...categoryLink}
              className="self-start font-heading text-xs font-bold uppercase tracking-widest text-brand-red-dark hover:underline focus-visible:ring-2 focus-visible:ring-brand-red/60"
            >
              {categoryName}
            </Link>
            <h1 id="product-title" className="mt-4 font-display text-3xl font-bold text-brand-charcoal lg:text-4xl">
              {name}
            </h1>

            {(product.brand || details.length > 0) && (
              <dl className="mt-6 flex flex-wrap gap-x-8 gap-y-3 text-sm">
                {product.brand && (
                  <div className="flex gap-2">
                    <dt className="text-brand-charcoal-muted">{t.product.brand}:</dt>
                    <dd className="font-semibold text-brand-charcoal">
                      <Link
                        to="/brands/$slug"
                        params={{ slug: product.brand.slug }}
                        className="hover:text-brand-red-dark hover:underline focus-visible:ring-2 focus-visible:ring-brand-red/60"
                      >
                        {product.brand.name}
                      </Link>
                    </dd>
                  </div>
                )}
                {details.map((detail) => (
                  <div key={detail.label} className="flex gap-2">
                    <dt className="text-brand-charcoal-muted">{detail.label}:</dt>
                    <dd dir="ltr" className="font-semibold text-brand-charcoal">
                      {detail.value}
                    </dd>
                  </div>
                ))}
              </dl>
            )}

            <div className="mt-8 border-y border-neutral-150 py-6">
              <PriceSlot state={price} size="lg" />
              {price.status === 'shown' && stock && <DiscountRibbon kind={STOCK_RIBBONS[stock]} message={t.stock[stock]} className="mt-3" />}
              <p className="mt-3 text-sm text-brand-charcoal-muted">{t.product.wholesale}</p>
              {price.status === 'shown' && (
                <div className="mt-6 flex flex-wrap items-center gap-3">
                  {stock !== 'out' && <QuantityStepper value={quantity} onChange={setQuantity} />}
                  <AddToCartButton
                    key={product.id}
                    size="lg"
                    product={{ id: product.id, slug: product.slug, name: product.name, image: product.images[0]?.thumbnail ?? null, unitPrice: price.price }}
                    quantity={quantity}
                    onAdded={() => setQuantity(1)}
                    available={stock !== 'out'}
                  />
                </div>
              )}
            </div>

            <dl className="divide-y divide-neutral-150 border-b border-neutral-150">
              <ServiceNote icon={Truck} title={t.product.shippingTitle} text={t.product.shippingText} />
              <ServiceNote icon={RotateCcw} title={t.product.returnsTitle} text={t.product.returnsText} />
            </dl>
          </div>
        </div>

        {description && (
          <section aria-labelledby="product-description-title" className="mt-16 max-w-3xl lg:mt-20">
            <h2 id="product-description-title" className="font-display text-2xl font-bold text-brand-charcoal lg:text-3xl">
              {t.product.descriptionTitle}
            </h2>
            <RichText html={description.html} lang={description.lang === locale ? undefined : description.lang} className="mt-6" />
          </section>
        )}
      </article>

      {product.related.length > 0 && (
        <section aria-labelledby="related-title" className="bg-neutral-50 px-6 py-16 lg:px-10 lg:py-20">
          <div className="mx-auto max-w-screen-2xl">
            <h2 id="related-title" className="font-display text-3xl font-bold text-brand-charcoal">
              {t.product.related}
            </h2>
            <ul className="mt-8 grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
              {product.related.map((other) => (
                <li key={other.id} className="flex">
                  <CatalogCard product={other} categoryName={categoryName} price={priceFor(prices, other.id)} stock={stockFor(prices, other.id)} className="w-full" />
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}
    </>
  )
}
