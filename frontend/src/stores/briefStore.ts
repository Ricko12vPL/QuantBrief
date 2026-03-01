import { create } from 'zustand'
import { api } from '../lib/api'
import { connectPipelineWS } from '../lib/websocket'

interface MaterialEvent {
  ticker: string
  event_type: string
  headline: string
  impact_assessment: string
  confidence: number
  sentiment: string
  title?: string
  summary?: string
  source?: string
  relevance_score?: number
  published_at?: string
}

interface FilingAnalysis {
  filing: {
    ticker: string
    company_name: string
    form_type: string
    filing_date: string
  }
  executive_summary: string
  financial_highlights: { metric: string; current_value: string; previous_value: string; change_pct: number | null; commentary: string }[]
  risk_factors: string[]
  key_metrics: Record<string, string>
  management_outlook: string
  notable_changes: string[]
  sentiment: string
  relevance_score: number
}

interface Signal {
  ticker: string
  title: string
  summary: string
  relevance_score: number
  sentiment: string
  signal_type: string
}

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
  risk?: string
}

interface ReasoningStep {
  stage: string
  content: string
}

export interface Brief {
  id: string
  executive_summary: string
  material_events: MaterialEvent[]
  filing_analyses: FilingAnalysis[]
  signals: Signal[]
  action_items: ActionItem[]
  risk_alerts: RiskAlert[]
  reasoning_chain: ReasoningStep[]
  audio_script: string
  audio_url: string
  language: string
  generated_at: string
  watchlist_tickers: string[]
  overall_sentiment: string
  confidence_score: number
}

interface BriefState {
  brief: Brief | null
  loading: boolean
  error: string | null
  pipelineStage: string
  pipelineProgress: number
  generate: (tickers?: string[], language?: string) => Promise<void>
  fetchLatest: () => Promise<void>
  setPipelineStage: (stage: string) => void
}

export const useBriefStore = create<BriefState>((set) => ({
  brief: null,
  loading: false,
  error: null,
  pipelineStage: '',
  pipelineProgress: 0,

  generate: async (tickers, language) => {
    set({ loading: true, error: null, pipelineStage: 'screening', pipelineProgress: 0 })
    const disconnectWS = connectPipelineWS((stage, pct) => {
      set({ pipelineStage: stage, pipelineProgress: pct })
    })
    try {
      const data = await api.brief.generate(tickers, language)
      set({ brief: data.brief, loading: false, pipelineStage: 'done', pipelineProgress: 100 })
    } catch (e: unknown) {
      set({ error: e instanceof Error ? e.message : 'Unknown error', loading: false, pipelineStage: '', pipelineProgress: 0 })
    } finally {
      disconnectWS()
    }
  },

  fetchLatest: async () => {
    try {
      const data = await api.brief.getLatest()
      if (data.brief) {
        set({ brief: data.brief })
      }
    } catch (e: unknown) {
      set({ error: e instanceof Error ? e.message : 'Unknown error' })
    }
  },

  setPipelineStage: (stage) => set({ pipelineStage: stage }),
}))
