/**
 * routes/articles.index.tsx — The articles page (מאמרים, /articles): pet-care guides and tips, ported
 * from the WordPress blog. The latest article is shown as a wide featured card, the rest in a grid.
 *
 * SEO: its `head` gives the page a title, description, canonical and hreflang links, plus JSON-LD — a
 * Blog listing every post and a BreadcrumbList — so search engines discover and understand the articles.
 */
import { createFileRoute, linkOptions } from '@tanstack/react-router'
import { ArticleCard } from '@/components/ArticleCard'
import { Breadcrumbs } from '@/components/Breadcrumbs'
import { ARTICLES, localized } from '@/config'
import { dictionaryFor, localizePath, useI18n } from '@/i18n'
import { absoluteUrl, breadcrumbJsonLd, organizationJsonLd, pageHead } from '@/seo'

export const Route = createFileRoute('/articles/')({
  head: ({ match }) => {
    const { locale } = match.context
    const t = dictionaryFor(locale)
    return pageHead({
      locale,
      path: '/articles',
      title: t.articles.metaTitle,
      description: t.articles.description,
      image: ARTICLES[0]?.image?.src,
      jsonLd: [
        {
          '@context': 'https://schema.org',
          '@type': 'Blog',
          name: t.articles.title,
          description: t.articles.description,
          url: absoluteUrl(localizePath('/articles', locale)),
          inLanguage: locale,
          publisher: organizationJsonLd(locale),
          blogPost: ARTICLES.map((article) => ({
            '@type': 'BlogPosting',
            headline: localized(article.title, locale),
            url: absoluteUrl(localizePath(`/articles/${article.slug}`, locale)),
            datePublished: article.publishedAt,
          })),
        },
        breadcrumbJsonLd(locale, [
          { name: t.articles.home, path: '/' },
          { name: t.nav.articles, path: '/articles' },
        ]),
      ],
    })
  },
  component: ArticlesPage,
})

/**
 * The articles page.
 * @returns The page <section>: breadcrumbs, heading, the featured latest article and the grid of the others.
 */
function ArticlesPage() {
  const { t } = useI18n()
  const [latest, ...others] = ARTICLES
  return (
    <section aria-labelledby="articles-title" className="mx-auto max-w-7xl px-6 py-16 lg:px-10 lg:py-20">
      <Breadcrumbs items={[{ label: t.articles.home, link: linkOptions({ to: '/' }) }, { label: t.nav.articles }]} />
      <p className="mt-10 font-heading text-xs font-bold uppercase tracking-widest text-brand-red">{t.articles.eyebrow}</p>
      <h1 id="articles-title" className="mt-4 font-display text-4xl font-bold text-brand-charcoal lg:text-5xl">
        {t.articles.title}
      </h1>
      <p className="mt-5 max-w-2xl text-lg text-brand-charcoal-muted">{t.articles.description}</p>

      {latest && <ArticleCard article={latest} variant="featured" headingLevel="h2" priority className="mt-12" />}
      {others.length > 0 && (
        <div className="mt-8 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {others.map((article) => (
            <ArticleCard key={article.slug} article={article} headingLevel="h2" />
          ))}
        </div>
      )}
    </section>
  )
}
