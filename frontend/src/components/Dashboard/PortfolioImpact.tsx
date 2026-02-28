import { useTranslation } from 'react-i18next'
import { Grid3X3, TrendingUp, TrendingDown, Minus, AlertTriangle } from 'lucide-react'

interface ActionItem {
  action: string
  ticker: string
  urgency: string
  rationale: string
}

interface RiskAlert {
  ticker: string
  risk_type: string
  description: string
  severity: string
}

interface Signal {
  ticker: string
  sentiment: string
  relevance_score: number
}

interface PortfolioImpactProps {
  actionItems: ActionItem[]
  riskAlerts: RiskAlert[]
  tickers: string[]
  signals?: Signal[]
  overallSentiment: string
  confidence: number
}

const sentimentStyles = {
  bullish: {
    bg: 'bg-emerald-500/15 border-emerald-500/30',
    text: 'text-emerald-400',
    icon: TrendingUp,
  },
  bearish: {
    bg: 'bg-red-500/15 border-red-500/30',
    text: 'text-red-400',
    icon: TrendingDown,
  },
  neutral: {
    bg: 'bg-yellow-500/15 border-yellow-500/30',
    text: 'text-yellow-400',
    icon: Minus,
  },
}

const urgencyColor: Record<string, string> = {
  high: 'bg-red-400/10 text-red-400 border-red-400/20',
  medium: 'bg-yellow-400/10 text-yellow-400 border-yellow-400/20',
  low: 'bg-zinc-400/10 text-zinc-400 border-zinc-400/20',
}

function computeTickerSentiment(
  ticker: string,
  actionItems: ActionItem[],
  riskAlerts: RiskAlert[],
  signals?: Signal[],
): { sentiment: string; confidencePct: number } {
  const tickerSignals = (signals ?? []).filter((s) => s.ticker === ticker)
  const tickerActions = actionItems.filter((a) => a.ticker === ticker)
  const tickerRisks = riskAlerts.filter((r) => r.ticker === ticker)

  let score = 0
  let total = 0

  for (const s of tickerSignals) {
    const weight = s.relevance_score
    score += s.sentiment === 'bullish' ? weight : s.sentiment === 'bearish' ? -weight : 0
    total += weight
  }

  for (const a of tickerActions) {
    const w = a.urgency === 'high' ? 0.8 : a.urgency === 'medium' ? 0.5 : 0.3
    const actionLower = a.action.toLowerCase()
    if (actionLower.includes('buy') || actionLower.includes('accumulate')) {
      score += w
    } else if (actionLower.includes('sell') || actionLower.includes('reduce')) {
      score -= w
    }
    total += w
  }

  for (const r of tickerRisks) {
    const w = r.severity === 'high' ? 0.6 : r.severity === 'medium' ? 0.4 : 0.2
    score -= w
    total += w
  }

  const avgScore = total > 0 ? score / total : 0
  const sentiment = avgScore > 0.15 ? 'bullish' : avgScore < -0.15 ? 'bearish' : 'neutral'
  const confidencePct = total > 0 ? Math.min(95, Math.round(Math.abs(avgScore) * 100 + 30)) : 50

  return { sentiment, confidencePct }
}

export default function PortfolioImpact({
  actionItems,
  riskAlerts,
  tickers,
  signals,
  overallSentiment,
  confidence,
}: PortfolioImpactProps) {
  const { t } = useTranslation()

  const tickerHeatmap = tickers.map((ticker) => ({
    ticker,
    ...computeTickerSentiment(ticker, actionItems, riskAlerts, signals),
  }))

  const overallStyle = sentimentStyles[overallSentiment as keyof typeof sentimentStyles] || sentimentStyles.neutral
  const OverallIcon = overallStyle.icon

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6 backdrop-blur">
      <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-white">
        <Grid3X3 className="h-5 w-5 text-[#FF7000]" />
        {t('portfolio_impact')}
      </h3>

      {/* Overall sentiment summary */}
      <div className={`mb-4 flex items-center gap-3 rounded-lg border p-3 ${overallStyle.bg}`}>
        <OverallIcon className={`h-5 w-5 ${overallStyle.text}`} />
        <div className="flex-1">
          <span className={`text-sm font-semibold ${overallStyle.text}`}>
            {t(`sentiment_${overallSentiment}`)}
          </span>
          <span className="ml-2 text-xs text-zinc-500">
            {t('confidence')}: {Math.round(confidence * 100)}%
          </span>
        </div>
      </div>

      {/* Heatmap grid */}
      {tickerHeatmap.length > 0 && (
        <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {tickerHeatmap.map(({ ticker, sentiment, confidencePct }) => {
            const style = sentimentStyles[sentiment as keyof typeof sentimentStyles] || sentimentStyles.neutral
            const Icon = style.icon
            return (
              <div
                key={ticker}
                className={`flex flex-col items-center rounded-lg border p-3 transition hover:scale-[1.02] ${style.bg}`}
              >
                <span className="text-sm font-bold text-white">{ticker}</span>
                <Icon className={`mt-1 h-5 w-5 ${style.text}`} />
                <span className={`mt-1 text-xs font-medium ${style.text}`}>
                  {t(`sentiment_${sentiment}`)}
                </span>
                <span className="mt-0.5 text-xs text-zinc-500">
                  {confidencePct}%
                </span>
              </div>
            )
          })}
        </div>
      )}

      {/* Action items */}
      {actionItems.length > 0 && (
        <div className="mb-4">
          <h4 className="mb-2 text-sm font-medium text-zinc-400">{t('action_items')}</h4>
          <div className="space-y-2">
            {actionItems.map((item, i) => (
              <div
                key={i}
                className={`rounded-lg border p-3 ${urgencyColor[item.urgency] || urgencyColor.medium}`}
              >
                <div className="flex items-center gap-2">
                  <span className="rounded bg-zinc-900 px-1.5 py-0.5 text-xs font-bold">
                    {item.ticker}
                  </span>
                  <span className="text-sm font-medium">{item.action}</span>
                </div>
                {item.rationale && (
                  <p className="mt-1 text-xs opacity-70">{item.rationale}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Risk alerts */}
      {riskAlerts.length > 0 && (
        <div>
          <h4 className="mb-2 flex items-center gap-1.5 text-sm font-medium text-zinc-400">
            <AlertTriangle className="h-3.5 w-3.5" />
            {t('risk_alerts')}
          </h4>
          <div className="space-y-2">
            {riskAlerts.map((alert, i) => (
              <div key={i} className="rounded-lg border border-zinc-800 bg-zinc-800/50 p-3">
                <div className="flex items-center gap-2">
                  <span className="rounded bg-zinc-900 px-1.5 py-0.5 text-xs font-bold text-[#FF7000]">
                    {alert.ticker}
                  </span>
                  <span className={`text-xs font-medium ${
                    alert.severity === 'high'
                      ? 'text-red-400'
                      : alert.severity === 'medium'
                        ? 'text-yellow-400'
                        : 'text-zinc-400'
                  }`}>
                    {alert.risk_type}
                  </span>
                </div>
                <p className="mt-1 text-sm text-zinc-400">{alert.description}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
