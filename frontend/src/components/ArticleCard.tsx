/**
 * ArticleCard.tsx — A card for one article: photo, topic, date and reading time, title, summary and a
 * "read the article" arrow; the whole card is one link to the article page. Two looks (`variant`):
 * `default` for grids, `featured` (photo beside the text on large screens) for the latest article.
 * Used by the articles list page and the "more articles" row of an article page.
 *
 * Also exports ArticleMeta, the topic · date · reading-time line, shared with the article page header.
 */
import { Link } from '@tanstack/react-router'
import { ArrowRight } from 'lucide-react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from 'cn'
import { localized, type Article } from '@/config'
import { useI18n, type Locale } from '@/i18n'

/** Reading speed used for the "N min read" estimate, in words per minute. */
const WORDS_PER_MINUTE = 200

/**
 * Estimates how long an article takes to read.
 * @param article - The article.
 * @param locale - The language whose text is counted.
 * @returns Whole minutes, at least 1.
 */
function readingMinutes(article: Article, locale: Locale) {
  const text = localized(article.body, locale)
    .flatMap((block) => (block.type === 'p' ? [block.text] : block.items))
    .join(' ')
  return Math.max(1, Math.round(text.split(/\s+/).filter(Boolean).length / WORDS_PER_MINUTE))
}

/**
 * The topic, publication date and reading time of an article, on one line.
 * @param props.article - The article.
 * @param props.className - Extra classes, e.g. colour or spacing.
 * @returns The meta line.
 */
export function ArticleMeta({ article, className }: { article: Article; className?: string }) {
  const { t, locale } = useI18n()
  const date = new Intl.DateTimeFormat(locale, { dateStyle: 'long', timeZone: 'Asia/Jerusalem' }).format(new Date(article.publishedAt))
  return (
    <p className={cn('flex flex-wrap items-center gap-x-3 gap-y-1 font-heading text-xs font-semibold text-brand-charcoal-muted', className)}>
      <span className="uppercase tracking-widest text-brand-red-dark">{t.articles.topics[article.topic]}</span>
      <span aria-hidden="true">·</span>
      <time dateTime={article.publishedAt}>{date}</time>
      <span aria-hidden="true">·</span>
      <span>{t.articles.readingTime.replace('{n}', String(readingMinutes(article, locale)))}</span>
    </p>
  )
}

const cardVariants = cva(
  [
    'group flex flex-col overflow-hidden border border-neutral-200 bg-white outline-none',
    'transition-[box-shadow,transform] duration-300 hover:-translate-y-1 hover:shadow-premium-sm',
    'focus-visible:ring-2 focus-visible:ring-brand-red focus-visible:ring-offset-2',
  ],
  {
    variants: {
      variant: {
        default: '',
        featured: 'lg:grid lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]',
      },
    },
    defaultVariants: { variant: 'default' },
  },
)

/**
 * One article card. A real link (crawlable, keyboard-focusable); the photo zooms slightly on hover.
 * @param props.article - The article to show.
 * @param props.variant - `default` (grid card) or `featured` (wide card, photo beside the text).
 * @param props.headingLevel - The title's heading tag, so the card fits the page outline; default "h3".
 * @param props.priority - Load the photo immediately (for a card at the top of the page); default false.
 * @param props.className - Extra classes for the card, e.g. grid placement.
 * @returns The card link element.
 */
export function ArticleCard({
  article,
  variant,
  headingLevel: Heading = 'h3',
  priority = false,
  className,
}: { article: Article; headingLevel?: 'h2' | 'h3'; priority?: boolean; className?: string } & VariantProps<typeof cardVariants>) {
  const { t, locale } = useI18n()
  const featured = variant === 'featured'
  return (
    <Link to="/articles/$slug" params={{ slug: article.slug }} className={cn(cardVariants({ variant }), className)}>
      <div className={cn('relative aspect-[16/10] overflow-hidden bg-neutral-150', featured && 'lg:aspect-auto lg:min-h-96')}>
        {article.image && (
          <img
            src={article.image.src}
            srcSet={article.image.srcSet}
            sizes={featured ? '(min-width: 1024px) 60vw, 100vw' : '(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw'}
            alt=""
            width={1280}
            height={800}
            loading={priority ? 'eager' : 'lazy'}
            fetchPriority={priority ? 'high' : undefined}
            className="absolute inset-0 size-full object-cover transition-transform duration-700 group-hover:scale-105"
          />
        )}
      </div>
      <div className={cn('flex flex-1 flex-col p-7', featured && 'lg:justify-center lg:p-12')}>
        <ArticleMeta article={article} />
        <Heading className={cn('mt-4 font-display font-bold text-brand-charcoal', featured ? 'text-2xl lg:text-3xl' : 'text-xl')}>
          {localized(article.title, locale)}
        </Heading>
        <p className="mt-3 flex-1 text-sm leading-relaxed text-brand-charcoal-muted">{localized(article.description, locale)}</p>
        <span className="mt-6 flex items-center gap-2 font-heading text-xs font-bold uppercase tracking-widest text-brand-red">
          {t.articles.readMore}
          <ArrowRight aria-hidden="true" className="size-4 transition-transform duration-300 group-hover:translate-x-1 rtl:rotate-180 rtl:group-hover:-translate-x-1" />
        </span>
      </div>
    </Link>
  )
}
