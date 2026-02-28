import { create } from 'zustand'
import { api } from '../lib/api'

interface Position {
  ticker: string
  shares: number
  avg_price: number
  company_name: string
}

interface PortfolioState {
  positions: Position[]
  loading: boolean
  error: string | null
  fetch: () => Promise<void>
  add: (ticker: string, shares: number, avgPrice: number, companyName?: string) => Promise<void>
  remove: (ticker: string) => Promise<void>
  tickers: () => string[]
}

export const usePortfolioStore = create<PortfolioState>((set, get) => ({
  positions: [],
  loading: false,
  error: null,

  fetch: async () => {
    set({ loading: true, error: null })
    try {
      const data = await api.portfolio.get()
      set({ positions: data.positions, loading: false })
    } catch (error) {
      set({
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to fetch portfolio',
      })
    }
  },

  add: async (ticker, shares, avgPrice, companyName) => {
    set({ error: null })
    try {
      const data = await api.portfolio.add(ticker, shares, avgPrice, companyName)
      set({ positions: data.positions })
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to add position' })
    }
  },

  remove: async (ticker) => {
    set({ error: null })
    try {
      const data = await api.portfolio.remove(ticker)
      set({ positions: data.positions })
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to remove position' })
    }
  },

  tickers: () => get().positions.map((p) => p.ticker),
}))
