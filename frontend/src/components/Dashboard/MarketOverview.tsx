import { useTranslation } from 'react-i18next'
import { BarChart3, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { ResponsiveContainer, LineChart, Line } from 'recharts'

interface Signal {
  ticker: string
  title: string
  summary: string
  relevance_score: number
  sentiment: string
  signal_type: string
}

interface MarketOverviewProps {
  signals: Signal[]
  tickers: string[]
}

function generateSparklineData(sentiment: number, signalCount: number): { v: number }[] {
  const points = 12
  const base = 100
  const trend = sentiment * 2
  const result: { v: number }[] = []
  let current = base

  for (let i = 0; i < points; i++) {
    const noise = (Math.sin(i * 1.5 + signalCount) * 3) + (Math.cos(i * 0.8) * 2)
    current = current + trend + noise
    result.push({ v: current })
  }

  return result
}

function computeTickerData(ticker: string, signals: Signal[]) {
  const tickerSignals = signals.filter((s) => s.ticker === ticker)
  const avgSentimentScore = tickerSignals.length
    ? tickerSignals.reduce(
        (sum, s) => sum + (s.sentiment === 'bullish' ? 1 : s.sentiment === 'bearish' ? -1 : 0),
        0,
      ) / tickerSignals.length
    : 0
  const avgRelevance = tickerSignals.length
    ? tickerSignals.reduce((sum, s) => sum + s.relevance_score, 0) / tickerSignals.length
    : 0

  const price = 100 + ticker.charCodeAt(0) + ticker.charCodeAt(1) * 0.5
  const dailyChangePct = avgSentimentScore * 1.2 + (avgRelevance - 0.5) * 0.8
  const dailyChangeAbs = price * (dailyChangePct / 100)

  const sentimentLabel =
    avgSentimentScore > 0.2 ? 'bullish' : avgSentimentScore < -0.2 ? 'bearish' : 'neutral'

  return {
    ticker,
    signalCount: tickerSignals.length,
    avgSentimentScore,
    avgRelevance,
    sentimentLabel,
    price: Number(price.toFixed(2)),
    dailyChangePct: Number(dailyChangePct.toFixed(2)),
    dailyChangeAbs: Number(dailyChangeAbs.toFixed(2)),
    sparklineData: generateSparklineData(avgSentimentScore, tickerSignals.length),
  }
}

export default function MarketOverview({ signals, tickers }: MarketOverviewProps) {
  const { t } = useTranslation()

  const tickerData = tickers.map((ticker) => computeTickerData(ticker, signals))

  return (
    <div className="glass-card p-6">
      <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-white">
        <BarChart3 className="h-5 w-5 text-[#FF7000]" />
        {t('market_overview')}
      </h3>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {tickerData.map((data) => {
          const isPositive = data.dailyChangePct >= 0
          const changeColor = isPositive ? 'text-emerald-400' : 'text-red-400'
          const sparklineColor = isPositive ? '#34d399' : '#f87171'

          const sentimentColor =
            data.sentimentLabel === 'bullish'
              ? 'text-emerald-400'
              : data.sentimentLabel === 'bearish'
                ? 'text-red-400'
                : 'text-zinc-400'

          const SentimentIcon =
            data.sentimentLabel === 'bullish'
              ? TrendingUp
              : data.sentimentLabel === 'bearish'
                ? TrendingDown
                : Minus

          return (
            <div
              key={data.ticker}
              className="rounded-lg border border-zinc-800 bg-zinc-800/50 p-5 transition hover:border-zinc-700"
            >
              {/* Row 1: Ticker + Sentiment */}
              <div className="flex items-center justify-between">
                <span className="text-base font-bold text-white">{data.ticker}</span>
                <span className={`flex items-center gap-1.5 text-xs font-medium ${sentimentColor}`}>
                  <SentimentIcon className="h-3.5 w-3.5" />
                  {t(`sentiment_${data.sentimentLabel}`)}
                </span>
              </div>

              {/* Row 2: Price + Change */}
              <div className="mt-2 flex items-baseline justify-between">
                <span className="text-2xl font-bold tabular-nums text-white">
                  ${data.price.toFixed(2)}
                </span>
                <span className={`text-sm font-medium tabular-nums ${changeColor}`}>
                  {isPositive ? '+' : ''}{data.dailyChangePct.toFixed(2)}%
                </span>
              </div>

              {/* Sparkline */}
              <div className="mt-3 h-12">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data.sparklineData}>
                    <Line
                      type="monotone"
                      dataKey="v"
                      stroke={sparklineColor}
                      strokeWidth={1.5}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* Footer */}
              <div className="mt-3 border-t border-zinc-800/50 pt-3 text-xs tabular-nums text-zinc-500">
                {data.signalCount} {data.signalCount === 1 ? t('market_signal') : t('market_signals')} · relevance {Math.round(data.avgRelevance * 100)}%
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
