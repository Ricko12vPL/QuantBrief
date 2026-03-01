import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { Zap, Loader2, LogOut } from 'lucide-react'

import { useBriefStore } from '../../stores/briefStore'
import { useWatchlistStore } from '../../stores/watchlistStore'
import { usePortfolioStore } from '../../stores/portfolioStore'
import { useAuthStore } from '../../stores/authStore'
import { api } from '../../lib/api'

import BriefCard from './BriefCard'
import EventTimeline from './EventTimeline'
import MarketOverview from './MarketOverview'
import PortfolioImpact from './PortfolioImpact'
import PortfolioManager from './PortfolioManager'
import PriceChart from './PriceChart'
import SentimentGauge from '../Analysis/SentimentGauge'
import RatioComparison from '../Analysis/RatioComparison'
import TechnicalAnalysis from '../Analysis/TechnicalAnalysis'
import NewsSentiment from '../Analysis/NewsSentiment'
import FilingViewer from '../Analysis/FilingViewer'
import ReasoningChain from '../Analysis/ReasoningChain'
import AudioPlayer from '../Audio/AudioPlayer'
import TranscriptView from '../Audio/TranscriptView'
import EarningsCallUpload from '../Analysis/EarningsCallUpload'
import AgentStatusBar from '../Common/AgentStatusBar'
import WatchlistManager from '../Common/WatchlistManager'
import ScheduleManager from '../Common/ScheduleManager'
import LanguageSelector from '../Common/LanguageSelector'

function sentimentToScore(sentiment: string): number {
  if (sentiment === 'bullish') return 0.6
  if (sentiment === 'bearish') return -0.6
  return 0
}

export default function DashboardPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { brief, loading, error, pipelineStage, generate, fetchLatest } = useBriefStore()
  const watchlist = useWatchlistStore()
  const portfolio = usePortfolioStore()
  const { user, logout } = useAuthStore()
  const [language, setLanguage] = useState('en')
  const [ratioData, setRatioData] = useState<Record<string, Record<string, number>>>({})
  const audioRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    watchlist.fetch()
    portfolio.fetch()
    fetchLatest()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchLatest])

  useEffect(() => {
    if (!brief) return
    let tickers: string[] = brief.watchlist_tickers || []
    if (tickers.length === 0 && brief.signals?.length) {
      tickers = [...new Set(brief.signals.map((s: { ticker: string }) => s.ticker).filter(Boolean))]
    }
    if (tickers.length === 0 && brief.material_events?.length) {
      tickers = [...new Set(brief.material_events.map((e: { ticker?: string }) => e.ticker).filter(Boolean))] as string[]
    }
    if (tickers.length === 0) return
    const excludeKeys = new Set(['ticker', 'company_name', 'sector', 'industry', 'error'])
    Promise.all(tickers.map((tk: string) => api.market.getRatios(tk).catch(() => null)))
      .then((results) => {
        const data: Record<string, Record<string, number>> = {}
        for (const r of results) {
          if (r && !r.error && r.ticker) {
            const valid: Record<string, number> = {}
            for (const [k, v] of Object.entries(r)) {
              if (!excludeKeys.has(k) && typeof v === 'number' && v !== 0) valid[k] = v
            }
            if (Object.keys(valid).length >= 3) data[r.ticker as string] = valid
          }
        }
        setRatioData(data)
      })
  }, [brief])

  const handleGenerate = () => {
    const portfolioTickers = portfolio.tickers()
    const watchTickers = watchlist.tickers()
    const tickers = [...new Set([...portfolioTickers, ...watchTickers])]
    generate(tickers.length > 0 ? tickers : undefined, language)
  }

  const scrollToAudio = () => {
    audioRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const handleLogout = () => {
    logout()
    navigate('/')
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <header className="sticky top-0 z-50 border-b border-zinc-800 bg-zinc-950/80 backdrop-blur">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between px-4 py-3">
          <div className="flex cursor-pointer items-center gap-3" onClick={() => navigate('/')}>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#FF7000]">
              <Zap className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight">{t('app_name')}</h1>
              <p className="text-xs text-zinc-500">{t('tagline')}</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {user && (
              <span className="text-sm text-zinc-400">
                {user.display_name || user.email}
              </span>
            )}
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
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-400 transition hover:border-zinc-600 hover:text-white"
              title={t('logout')}
            >
              <LogOut className="h-4 w-4" />
              {t('logout')}
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-[1400px] gap-6 px-4 py-6">
        <main className="min-w-0 flex-1">
          {loading && (
            <div className="mb-6">
              <AgentStatusBar currentStage={pipelineStage} />
            </div>
          )}

          {error && (
            <div className="mb-6 rounded-lg border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400">
              {error}
            </div>
          )}

          {!brief && !loading && (
            <div className="flex flex-col items-center justify-center py-32 text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#FF7000]/10">
                <Zap className="h-8 w-8 text-[#FF7000]" />
              </div>
              <p className="text-lg text-zinc-500">{t('no_brief')}</p>
            </div>
          )}

          {brief && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
                <div className="lg:col-span-3">
                  <BriefCard brief={brief} onPlayAudio={scrollToAudio} />
                </div>
                <div className="glass-card flex items-center justify-center p-6">
                  <SentimentGauge
                    value={sentimentToScore(brief.overall_sentiment)}
                    label={t('overall_sentiment')}
                    size={140}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <EventTimeline events={brief.material_events} />
                <MarketOverview signals={brief.signals} tickers={brief.watchlist_tickers} />
              </div>

              {brief.watchlist_tickers && brief.watchlist_tickers.length > 0 && (
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                  {brief.watchlist_tickers.map((ticker: string) => (
                    <div key={ticker} className="space-y-4">
                      <PriceChart ticker={ticker} />
                      <TechnicalAnalysis ticker={ticker} />
                      <NewsSentiment ticker={ticker} />
                    </div>
                  ))}
                </div>
              )}

              <PortfolioImpact
                actionItems={brief.action_items}
                riskAlerts={brief.risk_alerts}
                tickers={brief.watchlist_tickers}
                signals={brief.signals}
                overallSentiment={brief.overall_sentiment}
                confidence={brief.confidence_score}
              />

              <ReasoningChain steps={brief.reasoning_chain} />

              <FilingViewer analyses={brief.filing_analyses} />
              {Object.keys(ratioData).length > 0 && (
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                  {Object.entries(ratioData).map(([ticker, ratios]) => (
                    <RatioComparison key={ticker} ticker={ticker} ratios={ratios} />
                  ))}
                </div>
              )}

              <div ref={audioRef}>
                <AudioPlayer audioUrl={brief.audio_url} script={brief.audio_script} />
              </div>
              {brief.audio_script && (
                <TranscriptView
                  transcript={brief.audio_script}
                  title={t('transcript')}
                />
              )}

              <EarningsCallUpload />
            </div>
          )}
        </main>

        <aside className="hidden w-[320px] shrink-0 lg:block">
          <div className="sticky top-[73px] max-h-[calc(100vh-73px)] space-y-4 overflow-y-auto pb-6">
            <PortfolioManager />
            <WatchlistManager />
            <ScheduleManager />
          </div>
        </aside>
      </div>

      <footer className="border-t border-zinc-800 py-4 text-center text-xs text-zinc-600">
        Powered by Mistral AI &middot; ElevenLabs &middot; Built for Mistral AI Hackathon 2026
      </footer>
    </div>
  )
}
