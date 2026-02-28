import { create } from 'zustand'
import { api } from '../lib/api'

interface WatchlistItem {
  ticker: string
  company_name: string
  added_at: string
  notes: string
}

interface QuoteData {
  ticker: string
  price: number
  change: number
  change_pct: number
}

interface WatchlistState {
  items: WatchlistItem[]
  quotes: Record<string, QuoteData>
  loading: boolean
  error: string | null
  fetch: () => Promise<void>
  add: (ticker: string, companyName?: string) => Promise<void>
  remove: (ticker: string) => Promise<void>
  fetchQuotes: () => Promise<void>
  tickers: () => string[]
}

export const useWatchlistStore = create<WatchlistState>((set, get) => ({
  items: [],
  quotes: {},
  loading: false,
  error: null,

  fetch: async () => {
    set({ loading: true, error: null })
    try {
      const data = await api.watchlist.get()
      set({ items: data.watchlist.items, loading: false })
    } catch (error) {
      set({
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to fetch watchlist',
      })
    }
  },

  add: async (ticker, companyName) => {
    set({ error: null })
    try {
      const data = await api.watchlist.add(ticker, companyName)
      set({ items: data.watchlist.items })
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to add ticker' })
    }
  },

  remove: async (ticker) => {
    set({ error: null })
    try {
      const data = await api.watchlist.remove(ticker)
      set({ items: data.watchlist.items })
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to remove ticker' })
    }
  },

  fetchQuotes: async () => {
    const tickers = get().tickers()
    if (tickers.length === 0) {
      set({ quotes: {} })
      return
    }
    try {
      const data = await api.market.getQuotes(tickers)
      const quotesMap: Record<string, QuoteData> = {}
      for (const q of data.quotes) {
        quotesMap[q.ticker] = q
      }
      set({ quotes: quotesMap })
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to fetch quotes' })
    }
  },

  tickers: () => get().items.map((i) => i.ticker),
}))
