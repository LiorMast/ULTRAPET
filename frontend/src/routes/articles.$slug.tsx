/**
 * routes/articles.$slug.tsx — One article, e.g. /articles/living-with-a-cat. Unknown slugs show "not found".
 * The loader fetches the article and the list of articles (for the "more articles" row) from the API.
 *
 * The page: breadcrumbs, topic/date/reading time, title, photo and text inside <article>; then a "find a
 * store" call to action, the related product categories and more articles (same topic first). Those
 * internal links pass visitors and search engines on to the product pages.
 *
 * SEO: its `head` sets the article's title, description, canonical and hreflang links, og:image and
 * article dates, plus BlogPosting and BreadcrumbList JSON-LD (eligible for rich results).
 */
import { createFileRoute, Link, linkOptions } from '@tanstack/react-router'
import { ArticleCard, ArticleMeta } from '@/components/ArticleCard'
import { Breadcrumbs } from '@/components/Breadcrumbs'
import { CategoryCard } from '@/components/CategoryCard'
import { TextLink } from '@/components/TextLink'
import { Button } from '@/components/ui/button'
import { fetchArticle, fetchArticles, rethrowNotFound, type Article, type ArticleBlock } from '@/api'
import { articleImage, CATEGORIES, localized } from '@/config'
import { dictionaryFor, localizePath, useI18n } from '@/i18n'
import { absoluteUrl, breadcrumbJsonLd, organizationJsonLd, pageHead } from '@/seo'

/** How many other articles the "more articles" row shows. */
const MORE_COUNT = 3

export const Route = createFileRoute('/articles/$slug')({
  loader: async ({ params, abortController }) => {
    const { signal } = abortController
    const [article, articles] = await Promise.all([fetchArticle(params.slug, signal).catch(rethrowNotFound), fetchArticles(signal)])
    return { article, more: moreArticles(article, articles) }
  },
  head: ({ match, loaderData }) => {
    if (!loaderData) return {}
    const { article } = loaderData
    const image = articleImage(article.slug)
    const { locale } = match.context
    const t = dictionaryFor(locale)
    const path = `/articles/${article.slug}`
    const title = localized(article.title, locale)
    const head = pageHead({
      locale,
      path,
      title,
      description: localized(article.description, locale),
      image: image?.src,
      type: 'article',
      jsonLd: [
        {
          '@context': 'https://schema.org',
          '@type': 'BlogPosting',
          headline: title,
          description: localized(article.description, locale),
          image: image ? [absoluteUrl(image.src)] : undefined,
          datePublished: article.publishedAt,
          dateModified: article.updatedAt,
          inLanguage: locale,
          articleSection: t.articles.topics[article.topic],
          mainEntityOfPage: absoluteUrl(localizePath(path, locale)),
          author: organizationJsonLd(locale),
          publisher: organizationJsonLd(locale),
        },
        breadcrumbJsonLd(locale, [
          { name: t.articles.home, path: '/' },
          { name: t.nav.articles, path: '/articles' },
          { name: title, path },
        ]),
      ],
    })
    head.meta.push(
      { property: 'article:published_time', content: article.publishedAt },
      { property: 'article:modified_time', content: article.updatedAt },
      { property: 'article:section', content: t.articles.topics[article.topic] },
    )
    return head
  },
  component: ArticlePage,
})

/**
 * Renders one block of article text.
 * @param props.block - A paragraph or a numbered list.
 * @returns The <p> or <ol>.
 */
function ArticleBlockView({ block }: { block: ArticleBlock }) {
  if (block.type === 'p') return <p>{block.text}</p>
  return (
    <ol className="list-decimal space-y-3 ps-6 marker:font-bold marker:text-brand-red">
      {block.items.map((item) => (
        <li key={item} className="ps-2">
          {item}
        </li>
      ))}
    </ol>
  )
}

/**
 * Picks the articles for the "more articles" row: the newest of the same topic first, then the others.
 * @param article - The current article (left out).
 * @param articles - Every published article, newest first.
 * @returns Up to MORE_COUNT articles.
 */
function moreArticles(article: Article, articles: Article[]) {
  const others = articles.filter((a) => a.slug !== article.slug)
  return [...others.filter((a) => a.topic === article.topic), ...others.filter((a) => a.topic !== article.topic)].slice(0, MORE_COUNT)
}

/**
 * The article page.
 * @returns The article and the sections after it.
 */
function ArticlePage() {
  const { t, locale } = useI18n()
  const { article, more } = Route.useLoaderData()
  const image = articleImage(article.slug)
  const title = localized(article.title, locale)
  const categories = CATEGORIES.filter((c) => article.relatedCategories.includes(c.slug))

  return (
    <>
      <article aria-labelledby="article-title" className="page-y px-gutter lg:py-20">
        <div className="mx-auto max-w-3xl">
          <Breadcrumbs
            items={[
              { label: t.articles.home, link: linkOptions({ to: '/' }) },
              { label: t.nav.articles, link: linkOptions({ to: '/articles' }) },
              { label: title },
            ]}
          />
          <ArticleMeta article={article} className="mt-6 sm:mt-10" />
          <h1 id="article-title" className="mt-4 font-display text-3xl font-bold leading-tight text-brand-charcoal sm:mt-5 sm:text-4xl lg:text-5xl">
            {title}
          </h1>
        </div>

        {image && (
          <figure className="mx-auto mt-8 max-w-5xl sm:mt-12">
            <img
              src={image.src}
              srcSet={image.srcSet}
              sizes="(min-width: 1024px) 64rem, 100vw"
              alt={article.imageAlt ? localized(article.imageAlt, locale) : ''}
              width={1280}
              height={720}
              fetchPriority="high"
              className="aspect-[16/9] w-full rounded-3xl bg-neutral-150 object-cover"
            />
          </figure>
        )}

        <div className="mx-auto mt-8 max-w-3xl space-y-5 text-base leading-relaxed text-brand-charcoal sm:mt-12 sm:space-y-6 sm:text-lg">
          {localized(article.body, locale).map((block, index) => (
            <ArticleBlockView key={index} block={block} />
          ))}
        </div>
      </article>

      <aside aria-labelledby="article-cta-title" className="px-gutter">
        <div className="mx-auto flex max-w-5xl flex-col items-start gap-6 rounded-3xl bg-brand-charcoal px-5 py-8 sm:px-6 sm:py-12 md:flex-row md:items-center md:justify-between lg:px-12">
          <div>
            <h2 id="article-cta-title" className="font-display text-2xl font-bold text-white lg:text-3xl">
              {t.articles.ctaTitle}
            </h2>
            <p className="mt-2 max-w-xl text-neutral-200">{t.articles.ctaText}</p>
          </div>
          <Button asChild>
            <Link to="/where-to-buy">
              {t.articles.ctaButton}
            </Link>
          </Button>
        </div>
      </aside>

      {categories.length > 0 && (
        <section aria-labelledby="related-products-title" className="px-gutter mx-auto max-w-7xl pt-12 md:pt-16 lg:pt-20">
          <h2 id="related-products-title" className="font-display text-3xl font-bold text-brand-charcoal">
            {t.articles.relatedProducts}
          </h2>
          <div className="mt-8 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {categories.map((category) => (
              <CategoryCard
                key={category.slug}
                name={category.label(t)}
                image={category.image}
                link={linkOptions({ to: '/categories/$slug', params: { slug: category.slug } })}
              />
            ))}
          </div>
        </section>
      )}

      {more.length > 0 && (
        <section aria-labelledby="more-articles-title" className="px-gutter section-y mx-auto max-w-7xl lg:py-20">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <h2 id="more-articles-title" className="font-display text-3xl font-bold text-brand-charcoal">
              {t.articles.moreArticles}
            </h2>
            <TextLink link={linkOptions({ to: '/articles' })}>{t.articles.allArticles}</TextLink>
          </div>
          <div className="mt-8 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {more.map((other) => (
              <ArticleCard key={other.slug} article={other} />
            ))}
          </div>
        </section>
      )}
    </>
  )
}
