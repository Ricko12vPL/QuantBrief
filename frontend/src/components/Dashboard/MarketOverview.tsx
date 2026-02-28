import { useTranslation } from 'react-i18next'
import { BarChart3, TrendingUp, TrendingDown } from 'lucide-react'
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

  return {
    ticker,
    signalCount: tickerSignals.length,
    avgSentimentScore,
    avgRelevance,
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
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {tickerData.map((data) => {
          const isPositive = data.dailyChangePct >= 0
          const changeColor = isPositive ? 'text-emerald-400' : 'text-red-400'
          const sparklineColor = isPositive ? '#34d399' : '#f87171'

          return (
            <div
              key={data.ticker}
              className="rounded-lg border border-zinc-800 bg-zinc-800/50 p-4 transition hover:border-zinc-700"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-lg font-bold text-white">{data.ticker}</span>
                  {data.avgSentimentScore > 0.2 ? (
                    <TrendingUp className="h-4 w-4 text-emerald-400" />
                  ) : data.avgSentimentScore < -0.2 ? (
                    <TrendingDown className="h-4 w-4 text-red-400" />
                  ) : (
                    <div className="h-4 w-4 rounded-full bg-yellow-400/20" />
                  )}
                </div>
                <span className="text-lg font-semibold text-white">
                  ${data.price.toFixed(2)}
                </span>
              </div>

              <div className="mt-1 flex items-center justify-between">
                <span className="text-xs text-zinc-500">
                  {data.signalCount} {data.signalCount === 1 ? t('market_signal') : t('market_signals')}
                </span>
                <span className={`text-sm font-medium ${changeColor}`}>
                  {isPositive ? '+' : ''}{data.dailyChangeAbs.toFixed(2)} ({isPositive ? '+' : ''}{data.dailyChangePct.toFixed(2)}%)
                </span>
              </div>

              <div className="mt-2 h-10">
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

              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-zinc-700">
                <div
                  className={`h-full rounded-full transition-all ${
                    data.avgSentimentScore > 0.2
                      ? 'bg-emerald-400'
                      : data.avgSentimentScore < -0.2
                        ? 'bg-red-400'
                        : 'bg-yellow-400'
                  }`}
                  style={{ width: `${Math.max(10, data.avgRelevance * 100)}%` }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
