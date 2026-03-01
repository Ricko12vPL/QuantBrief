import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import {
  Newspaper,
  Loader2,
  TrendingUp,
  TrendingDown,
  Minus,
  ExternalLink,
  AlertTriangle,
  Filter,
} from 'lucide-react'
import { api } from '../../lib/api'

interface NewsSentimentProps {
  ticker: string
}

interface NewsArticle {
  title: string
  publisher: string
  link: string
  published_at: string
  thumbnail: string
  sentiment: string
  relevance_score: number
  summary: string
}

const SENTIMENT_CONFIG: Record<
  string,
  { icon: typeof TrendingUp; labelKey: string; className: string }
> = {
  bullish: {
    icon: TrendingUp,
    labelKey: 'sentiment_bullish',
    className: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  },
  bearish: {
    icon: TrendingDown,
    labelKey: 'sentiment_bearish',
    className: 'bg-red-500/20 text-red-400 border-red-500/30',
  },
  neutral: {
    icon: Minus,
    labelKey: 'sentiment_neutral',
    className: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  },
}

function formatRelativeTime(dateStr: string, t: TFunction): string {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  if (isNaN(date.getTime())) return ''
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  if (diffMs < 0) return t('news_just_now')
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return t('news_just_now')
  if (diffMin < 60) return t('news_minutes_ago', { count: diffMin })
  const diffHrs = Math.floor(diffMin / 60)
  if (diffHrs < 24) return t('news_hours_ago', { count: diffHrs })
  const diffDays = Math.floor(diffHrs / 24)
  return t('news_days_ago', { count: diffDays })
}

function SentimentBadge({ sentiment, t }: { sentiment: string; t: TFunction }) {
  const c = SENTIMENT_CONFIG[sentiment] || SENTIMENT_CONFIG.neutral
  const Icon = c.icon
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${c.className}`}
    >
      <Icon className="h-3 w-3" />
      {t(c.labelKey)}
    </span>
  )
}

function RelevanceBar({ score }: { score: number }) {
  const pct = Math.round(score * 100)
  const color = score > 0.7 ? 'bg-[#FF7000]' : score > 0.4 ? 'bg-yellow-500' : 'bg-zinc-500'
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-zinc-800">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[10px] text-zinc-500">{pct}%</span>
    </div>
  )
}

export default function NewsSentiment({ ticker }: NewsSentimentProps) {
  const { t } = useTranslation()
  const [articles, setArticles] = useState<NewsArticle[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [criticalOnly, setCriticalOnly] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    api.market
      .getNews(ticker)
      .then((data) => {
        if (!cancelled) {
          setArticles(data.news || [])
        }
      })
      .catch(() => {
        if (!cancelled) {
          setArticles([])
          setError(t('news_load_failed'))
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [ticker, t])

  const criticalCount = articles.filter((a) => a.relevance_score > 0.7).length
  const displayed = criticalOnly ? articles.filter((a) => a.relevance_score > 0.7) : articles

  return (
    <div className="glass-card p-4">
      {/* Header */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Newspaper className="h-4 w-4 text-[#FF7000]" />
          <h3 className="text-sm font-semibold">{t('news_sentiment')}</h3>
          <span className="text-xs text-zinc-500">{ticker}</span>
        </div>
        {criticalCount > 0 && (
          <button
            onClick={() => setCriticalOnly((prev) => !prev)}
            aria-pressed={criticalOnly}
            aria-label={`${t('news_critical_only')} filter`}
            className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition ${
              criticalOnly
                ? 'bg-[#FF7000] text-white'
                : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
            }`}
          >
            <Filter className="h-3 w-3" />
            {t('news_critical_only')} ({criticalCount})
          </button>
        )}
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-zinc-500" />
        </div>
      ) : error ? (
        <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-center text-xs text-red-400">
          {error}
        </div>
      ) : displayed.length === 0 ? (
        <p className="py-6 text-center text-xs text-zinc-600">{t('news_no_news')}</p>
      ) : (
        <div className="space-y-3">
          {displayed.map((article, i) => (
            <div
              key={`${article.link}-${i}`}
              className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3 transition hover:border-zinc-700"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  {/* Title row */}
                  <div className="mb-1.5 flex items-start gap-2">
                    <a
                      href={article.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group flex items-start gap-1 text-sm font-medium text-zinc-200 hover:text-white"
                    >
                      <span className="line-clamp-2">{article.title}</span>
                      <ExternalLink className="mt-0.5 h-3 w-3 shrink-0 text-zinc-600 group-hover:text-zinc-400" />
                    </a>
                  </div>

                  {/* Meta row */}
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <SentimentBadge sentiment={article.sentiment} t={t} />
                    {article.relevance_score > 0.7 && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-[#FF7000]/30 bg-[#FF7000]/10 px-2 py-0.5 text-xs font-medium text-[#FF7000]">
                        <AlertTriangle className="h-3 w-3" />
                        {t('news_high_impact')}
                      </span>
                    )}
                    <span className="text-[10px] text-zinc-600">
                      {article.publisher}
                      {article.published_at && ` · ${formatRelativeTime(article.published_at, t)}`}
                    </span>
                  </div>

                  {/* Summary */}
                  {article.summary && (
                    <p className="mb-2 text-xs leading-relaxed text-zinc-400">{article.summary}</p>
                  )}

                  {/* Relevance bar */}
                  <RelevanceBar score={article.relevance_score} />
                </div>

                {/* Thumbnail */}
                {article.thumbnail && (
                  <img
                    src={article.thumbnail}
                    alt=""
                    className="h-16 w-20 shrink-0 rounded-md object-cover"
                  />
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
