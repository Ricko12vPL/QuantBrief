import { create } from 'zustand'
import { api } from '../lib/api'
import { connectPipelineWS } from '../lib/websocket'

interface Brief {
  id: string
  executive_summary: string
  material_events: any[]
  filing_analyses: any[]
  signals: any[]
  action_items: any[]
  risk_alerts: any[]
  reasoning_chain: any[]
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
  generate: (tickers?: string[], language?: string) => Promise<void>
  fetchLatest: () => Promise<void>
  setPipelineStage: (stage: string) => void
}

export const useBriefStore = create<BriefState>((set) => ({
  brief: null,
  loading: false,
  error: null,
  pipelineStage: '',

  generate: async (tickers, language) => {
    set({ loading: true, error: null, pipelineStage: 'screening' })
    const disconnectWS = connectPipelineWS((stage, _pct) => {
      set({ pipelineStage: stage })
    })
    try {
      const data = await api.brief.generate(tickers, language)
      set({ brief: data.brief, loading: false, pipelineStage: 'done' })
    } catch (e: any) {
      set({ error: e.message, loading: false, pipelineStage: '' })
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
    } catch (e: any) {
      set({ error: e.message })
    }
  },

  setPipelineStage: (stage) => set({ pipelineStage: stage }),
}))
