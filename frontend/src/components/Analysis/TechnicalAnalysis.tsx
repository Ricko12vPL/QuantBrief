import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Activity, BarChart3, Brain, Loader2, PenLine, TrendingUp } from 'lucide-react'
import { api } from '../../lib/api'

interface TechnicalAnalysisProps {
  ticker: string
}

interface TechnicalData {
  ticker: string
  rsi: number
  rsi_signal: string
  macd_signal: string
  macd_histogram: number
  macd_line?: number
  macd_signal_line?: number
  bb_upper?: number
  bb_middle?: number
  bb_lower?: number
  bb_position?: string
  sma_20?: number
  sma_50?: number
  sma_200?: number
  price?: number
  price_vs_sma200?: string
  volume_signal?: string
  volume_latest?: number
  volume_avg_20?: number
}

interface AIAnalysis {
  trend?: string
  trend_confidence?: number
  recommendation?: string
  recommendation_rationale?: string
  risk_level?: string
  short_term_outlook?: string
  medium_term_outlook?: string
  error?: string
}

function getRSIColor(rsi: number): string {
  if (rsi >= 70) return 'text-red-400'
  if (rsi <= 30) return 'text-emerald-400'
  return 'text-[#FF7000]'
}

function getRSIBgWidth(rsi: number): string {
  return `${Math.min(Math.max(rsi, 0), 100)}%`
}

function getBBPositionLabel(pos?: string): string {
  const labels: Record<string, string> = {
    above_upper: 'Above upper band',
    near_upper: 'Near upper band',
    middle: 'Middle',
    near_lower: 'Near lower band',
    below_lower: 'Below lower band',
  }
  return labels[pos ?? 'middle'] ?? 'Middle'
}

function getBBPositionColor(pos?: string): string {
  if (pos === 'above_upper' || pos === 'near_upper') return 'text-red-400'
  if (pos === 'below_lower' || pos === 'near_lower') return 'text-emerald-400'
  return 'text-zinc-300'
}

function getVolumeColor(signal?: string): string {
  if (signal === 'high') return 'text-[#FF7000]'
  if (signal === 'low') return 'text-zinc-500'
  return 'text-zinc-300'
}

function getSMAColor(price: number, sma: number): string {
  if (!sma) return 'text-zinc-500'
  return price > sma ? 'text-emerald-400' : 'text-red-400'
}

export default function TechnicalAnalysis({ ticker }: TechnicalAnalysisProps) {
  const { t } = useTranslation()
  const [data, setData] = useState<TechnicalData | null>(null)
  const [aiAnalysis, setAiAnalysis] = useState<AIAnalysis | null>(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [manualNote, setManualNote] = useState('')
  const [showNote, setShowNote] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setAiAnalysis(null)
    api.market
      .getTechnical(ticker)
      .then((result) => {
        if (!cancelled) {
          setData(result)
          setLoading(false)
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [ticker])

  const handleAIAnalysis = async () => {
    setAiLoading(true)
    try {
      const result = await api.market.analyzeTechnical(ticker)
      setAiAnalysis(result.ai_analysis || null)
    } catch {
      setAiAnalysis({ error: 'Analysis failed' })
    }
    setAiLoading(false)
  }

  if (loading) {
    return (
      <div className="flex h-32 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900/50">
        <Loader2 className="h-5 w-5 animate-spin text-[#FF7000]" />
      </div>
    )
  }

  if (!data) return null

  return (
    <div className="glass-card p-6">
      <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-white">
        <Activity className="h-5 w-5 text-[#FF7000]" />
        {ticker} {t('technical_analysis')}
      </h3>

      <div className="mb-4 grid grid-cols-2 gap-4">
        <div className="rounded-lg border border-zinc-700 bg-zinc-800/50 p-3">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-xs text-zinc-500">RSI (14)</span>
            <span className={`text-sm font-semibold ${getRSIColor(data.rsi)}`}>
              {data.rsi.toFixed(1)}
            </span>
          </div>
          <div className="relative h-2 overflow-hidden rounded-full bg-zinc-700">
            <div
              className="absolute left-0 top-0 h-full rounded-full bg-gradient-to-r from-emerald-500 via-[#FF7000] to-red-500"
              style={{ width: getRSIBgWidth(data.rsi) }}
            />
          </div>
          <div className="mt-1 flex justify-between text-[10px] text-zinc-600">
            <span>{t('oversold')}</span>
            <span>{t('overbought')}</span>
          </div>
        </div>

        <div className="rounded-lg border border-zinc-700 bg-zinc-800/50 p-3">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-xs text-zinc-500">MACD</span>
            <span className={`text-sm font-semibold ${
              data.macd_signal === 'bullish' ? 'text-emerald-400' :
              data.macd_signal === 'bearish' ? 'text-red-400' : 'text-zinc-400'
            }`}>
              {data.macd_signal.charAt(0).toUpperCase() + data.macd_signal.slice(1)}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-500">Histogram:</span>
            <span className={`tabular-nums text-sm font-medium ${
              data.macd_histogram > 0 ? 'text-emerald-400' : data.macd_histogram < 0 ? 'text-red-400' : 'text-zinc-400'
            }`}>
              {data.macd_histogram > 0 ? '+' : ''}{data.macd_histogram.toFixed(4)}
            </span>
          </div>
        </div>
      </div>

      {(data.bb_upper != null || data.sma_20 != null) && (
        <div className="mb-4 grid grid-cols-2 gap-4">
          <div className="rounded-lg border border-zinc-700 bg-zinc-800/50 p-3">
            <div className="mb-1 flex items-center justify-between">
              <span className="flex items-center gap-1 text-xs text-zinc-500">
                <BarChart3 className="h-3 w-3" />
                Bollinger Bands
              </span>
              <span className={`text-xs font-medium ${getBBPositionColor(data.bb_position)}`}>
                {getBBPositionLabel(data.bb_position)}
              </span>
            </div>
            <div className="mt-1 space-y-0.5 text-xs tabular-nums">
              <div className="flex justify-between">
                <span className="text-zinc-500">Upper</span>
                <span className="text-zinc-300">${data.bb_upper?.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Middle</span>
                <span className="text-zinc-300">${data.bb_middle?.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Lower</span>
                <span className="text-zinc-300">${data.bb_lower?.toFixed(2)}</span>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-zinc-700 bg-zinc-800/50 p-3">
            <div className="mb-1 flex items-center justify-between">
              <span className="flex items-center gap-1 text-xs text-zinc-500">
                <TrendingUp className="h-3 w-3" />
                Moving Averages
              </span>
              {data.price_vs_sma200 && data.price_vs_sma200 !== 'neutral' && (
                <span className={`text-xs font-medium ${data.price_vs_sma200 === 'above' ? 'text-emerald-400' : 'text-red-400'}`}>
                  {data.price_vs_sma200 === 'above' ? 'Above' : 'Below'} SMA200
                </span>
              )}
            </div>
            <div className="mt-1 space-y-0.5 text-xs tabular-nums">
              <div className="flex justify-between">
                <span className="text-zinc-500">SMA 20</span>
                <span className={getSMAColor(data.price ?? 0, data.sma_20 ?? 0)}>
                  ${data.sma_20?.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">SMA 50</span>
                <span className={getSMAColor(data.price ?? 0, data.sma_50 ?? 0)}>
                  {data.sma_50 ? `$${data.sma_50.toFixed(2)}` : '—'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">SMA 200</span>
                <span className={getSMAColor(data.price ?? 0, data.sma_200 ?? 0)}>
                  {data.sma_200 ? `$${data.sma_200.toFixed(2)}` : '—'}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {data.volume_signal && (
        <div className="mb-4">
          <div className="rounded-lg border border-zinc-700 bg-zinc-800/50 p-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-zinc-500">Volume</span>
              <span className={`text-xs font-medium capitalize ${getVolumeColor(data.volume_signal)}`}>
                {data.volume_signal}
              </span>
            </div>
            {data.volume_latest != null && data.volume_avg_20 != null && (
              <div className="mt-1 flex items-center gap-3 text-xs tabular-nums text-zinc-400">
                <span>Latest: {(data.volume_latest / 1e6).toFixed(1)}M</span>
                <span>Avg(20): {(data.volume_avg_20 / 1e6).toFixed(1)}M</span>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="mb-4 flex gap-2">
        <button
          onClick={handleAIAnalysis}
          disabled={aiLoading}
          className="flex items-center gap-2 rounded-lg bg-[#FF7000]/10 px-3 py-2 text-sm font-medium text-[#FF7000] transition hover:bg-[#FF7000]/20 disabled:opacity-50"
        >
          {aiLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Brain className="h-4 w-4" />
          )}
          {t('ai_analysis')}
        </button>
        <button
          onClick={() => setShowNote(!showNote)}
          className="flex items-center gap-2 rounded-lg bg-zinc-800 px-3 py-2 text-sm font-medium text-zinc-300 transition hover:bg-zinc-700"
        >
          <PenLine className="h-4 w-4" />
          {t('manual_note')}
        </button>
      </div>

      {aiAnalysis && !aiAnalysis.error && (
        <div className="mb-4 rounded-lg border border-[#FF7000]/20 bg-[#FF7000]/5 p-4">
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-[#FF7000]">
            <Brain className="h-4 w-4" />
            {t('ai_analysis')}
          </div>
          <div className="space-y-2 text-sm text-zinc-300">
            {aiAnalysis.trend && (
              <div>
                <span className="text-zinc-500">Trend: </span>
                <span className={`font-medium ${
                  aiAnalysis.trend === 'bullish' ? 'text-emerald-400' :
                  aiAnalysis.trend === 'bearish' ? 'text-red-400' : 'text-zinc-300'
                }`}>
                  {aiAnalysis.trend}
                  {aiAnalysis.trend_confidence != null && ` (${(aiAnalysis.trend_confidence * 100).toFixed(0)}%)`}
                </span>
              </div>
            )}
            {aiAnalysis.recommendation && (
              <div>
                <span className="text-zinc-500">Recommendation: </span>
                <span className="font-medium text-white">{aiAnalysis.recommendation}</span>
              </div>
            )}
            {aiAnalysis.recommendation_rationale && (
              <p className="text-justify text-zinc-400">{aiAnalysis.recommendation_rationale}</p>
            )}
            {aiAnalysis.risk_level && (
              <div>
                <span className="text-zinc-500">Risk: </span>
                <span className={`font-medium ${
                  aiAnalysis.risk_level === 'high' ? 'text-red-400' :
                  aiAnalysis.risk_level === 'low' ? 'text-emerald-400' : 'text-yellow-400'
                }`}>
                  {aiAnalysis.risk_level}
                </span>
              </div>
            )}
            {aiAnalysis.short_term_outlook && (
              <div><span className="text-zinc-500">Short-term: </span>{aiAnalysis.short_term_outlook}</div>
            )}
            {aiAnalysis.medium_term_outlook && (
              <div><span className="text-zinc-500">Medium-term: </span>{aiAnalysis.medium_term_outlook}</div>
            )}
          </div>
        </div>
      )}
      {aiAnalysis?.error && (
        <div className="mb-4 rounded-lg border border-red-500/20 bg-red-500/5 p-3 text-sm text-red-400">
          {aiAnalysis.error}
        </div>
      )}

      {showNote && (
        <textarea
          value={manualNote}
          onChange={(e) => setManualNote(e.target.value)}
          placeholder={`${t('manual_note')} for ${ticker}...`}
          className="w-full rounded-lg border border-zinc-700 bg-zinc-800 p-3 text-sm text-white placeholder-zinc-500 outline-none focus:border-[#FF7000]"
          rows={3}
        />
      )}
    </div>
  )
}
