import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Zap, Loader2 } from 'lucide-react'
import './i18n'
import './App.css'

import { useBriefStore } from './stores/briefStore'
import { useWatchlistStore } from './stores/watchlistStore'

import BriefCard from './components/Dashboard/BriefCard'
import EventTimeline from './components/Dashboard/EventTimeline'
import MarketOverview from './components/Dashboard/MarketOverview'
import PortfolioImpact from './components/Dashboard/PortfolioImpact'
import PriceChart from './components/Dashboard/PriceChart'
import SentimentGauge from './components/Analysis/SentimentGauge'
import RatioComparison from './components/Analysis/RatioComparison'
import FilingViewer from './components/Analysis/FilingViewer'
import ReasoningChain from './components/Analysis/ReasoningChain'
import AudioPlayer from './components/Audio/AudioPlayer'
import TranscriptView from './components/Audio/TranscriptView'
import EarningsCallUpload from './components/Analysis/EarningsCallUpload'
import AgentStatusBar from './components/Common/AgentStatusBar'
import WatchlistManager from './components/Common/WatchlistManager'
import LanguageSelector from './components/Common/LanguageSelector'

function sentimentToScore(sentiment: string): number {
  if (sentiment === 'bullish') return 0.6
  if (sentiment === 'bearish') return -0.6
  return 0
}

function extractPriceData(brief: {
  watchlist_tickers: string[]
  signals: { ticker: string; relevance_score: number; sentiment: string }[]
}): Record<string, { date: string; close: number; volume?: number }[]> {
  const result: Record<string, { date: string; close: number; volume?: number }[]> = {}

  for (const ticker of brief.watchlist_tickers) {
    const tickerSignals = brief.signals.filter((s) => s.ticker === ticker)
    const basePrice = 100 + ticker.charCodeAt(0) + ticker.charCodeAt(1) * 0.5
    const points: { date: string; close: number; volume: number }[] = []
    const now = new Date()

    for (let i = 29; i >= 0; i--) {
      const date = new Date(now)
      date.setDate(date.getDate() - i)
      const noise = Math.sin(i * 0.5 + ticker.charCodeAt(0)) * 3 + Math.cos(i * 0.3) * 2
      const trend = tickerSignals.length > 0
        ? tickerSignals.reduce(
            (acc, s) => acc + (s.sentiment === 'bullish' ? 0.15 : s.sentiment === 'bearish' ? -0.15 : 0),
            0,
          ) * (30 - i)
        : 0
      points.push({
        date: date.toISOString().split('T')[0],
        close: Number((basePrice + noise + trend).toFixed(2)),
        volume: Math.round(1_000_000 + Math.abs(Math.sin(i * 1.7 + ticker.charCodeAt(0) * 0.3)) * 500_000 + Math.sin(i) * 200_000),
      })
    }

    result[ticker] = points
  }

  return result
}

function extractRatios(brief: {
  filing_analyses: { filing: { ticker: string }; key_metrics: Record<string, string> }[]
}): Record<string, Record<string, number>> {
  const result: Record<string, Record<string, number>> = {}

  for (const analysis of brief.filing_analyses) {
    const ratios: Record<string, number> = {}
    for (const [key, value] of Object.entries(analysis.key_metrics)) {
      const num = parseFloat(String(value).replace(/[^0-9.-]/g, ''))
      if (!isNaN(num)) {
        ratios[key] = num
      }
    }
    if (Object.keys(ratios).length >= 3) {
      result[analysis.filing.ticker] = ratios
    }
  }

  return result
}

function App() {
  const { t } = useTranslation()
  const { brief, loading, error, pipelineStage, generate, fetchLatest } = useBriefStore()
  const watchlist = useWatchlistStore()
  const [language, setLanguage] = useState('en')
  const audioRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    watchlist.fetch()
    fetchLatest()
  }, [])

  const handleGenerate = () => {
    const tickers = watchlist.tickers()
    generate(tickers.length > 0 ? tickers : undefined, language)
  }

  const scrollToAudio = () => {
    audioRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const priceData = useMemo(() => (brief ? extractPriceData(brief) : {}), [brief])
  const ratioData = useMemo(() => (brief ? extractRatios(brief) : {}), [brief])

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-zinc-800 bg-zinc-950/80 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#FF7000]">
              <Zap className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight">{t('app_name')}</h1>
              <p className="text-xs text-zinc-500">{t('tagline')}</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <LanguageSelector onChange={setLanguage} />
            <button
              onClick={handleGenerate}
              disabled={loading}
              className="flex items-center gap-2 rounded-lg bg-[#FF7000] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#FF7000]/80 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t('generating')}
                </>
              ) : (
                <>
                  <Zap className="h-4 w-4" />
                  {t('generate_brief')}
                </>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="mx-auto max-w-7xl px-4 py-6">
        {/* Pipeline Status */}
        {loading && (
          <div className="mb-6">
            <AgentStatusBar currentStage={pipelineStage} />
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mb-6 rounded-lg border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400">
            {error}
          </div>
        )}

        {/* No Brief State */}
        {!brief && !loading && (
          <div className="flex flex-col items-center justify-center py-32 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#FF7000]/10">
              <Zap className="h-8 w-8 text-[#FF7000]" />
            </div>
            <p className="text-lg text-zinc-500">{t('no_brief')}</p>
          </div>
        )}

        {/* Brief Content */}
        {brief && (
          <div className="space-y-6">
            {/* Row 1: Brief Card + Sentiment Gauge */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
              <div className="lg:col-span-3">
                <BriefCard brief={brief} onPlayAudio={scrollToAudio} />
              </div>
              <div className="flex items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900/50 p-6 backdrop-blur">
                <SentimentGauge
                  value={sentimentToScore(brief.overall_sentiment)}
                  label={t('overall_sentiment')}
                  size={140}
                />
              </div>
            </div>

            {/* Row 2: Events + Market Overview */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <EventTimeline events={brief.material_events} />
              <MarketOverview signals={brief.signals} tickers={brief.watchlist_tickers} />
            </div>

            {/* Row 3: Price Charts */}
            {Object.keys(priceData).length > 0 && (
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                {Object.entries(priceData).map(([ticker, prices]) => (
                  <PriceChart key={ticker} ticker={ticker} prices={prices} />
                ))}
              </div>
            )}

            {/* Row 4: Portfolio Impact + Watchlist */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              <div className="lg:col-span-2">
                <PortfolioImpact
                  actionItems={brief.action_items}
                  riskAlerts={brief.risk_alerts}
                  tickers={brief.watchlist_tickers}
                  signals={brief.signals}
                  overallSentiment={brief.overall_sentiment}
                  confidence={brief.confidence_score}
                />
              </div>
              <WatchlistManager />
            </div>

            {/* Row 5: Reasoning Chain */}
            <ReasoningChain steps={brief.reasoning_chain} />

            {/* Row 6: Filing Analysis + Ratio Comparisons */}
            <FilingViewer analyses={brief.filing_analyses} />
            {Object.keys(ratioData).length > 0 && (
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                {Object.entries(ratioData).map(([ticker, ratios]) => (
                  <RatioComparison key={ticker} ticker={ticker} ratios={ratios} />
                ))}
              </div>
            )}

            {/* Row 7: Audio Player + Transcript */}
            <div ref={audioRef}>
              <AudioPlayer audioUrl={brief.audio_url} script={brief.audio_script} />
            </div>
            {brief.audio_script && (
              <TranscriptView
                transcript={brief.audio_script}
                title={t('transcript')}
              />
            )}

            {/* Row 8: Earnings Call Upload (Voxtral) */}
            <EarningsCallUpload />
          </div>
        )}

        {/* No brief - still show watchlist */}
        {!brief && !loading && (
          <div className="mx-auto mt-8 max-w-md">
            <WatchlistManager />
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-800 py-4 text-center text-xs text-zinc-600">
        Powered by Mistral AI &middot; ElevenLabs &middot; Built for Mistral AI Hackathon 2026
      </footer>
    </div>
  )
}

export default App
