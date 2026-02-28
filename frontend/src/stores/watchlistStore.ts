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
  isLocal: boolean
  fetch: () => Promise<void>
  add: (ticker: string, companyName?: string) => Promise<void>
  remove: (ticker: string) => Promise<void>
  fetchQuotes: () => Promise<void>
  tickers: () => string[]
}

const STORAGE_KEY = 'qb_watchlist'

function loadLocal(): WatchlistItem[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
  } catch {
    return []
  }
}

function saveLocal(items: WatchlistItem[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
}

function mockQuote(ticker: string): QuoteData {
  const seed = ticker.split('').reduce((s, c) => s + c.charCodeAt(0), 0)
  const price = 50 + (seed % 200) + ((seed * 7) % 100) / 100
  const changePct = ((seed % 11) - 5) * 0.3
  return {
    ticker,
    price: Number(price.toFixed(2)),
    change: Number((price * changePct / 100).toFixed(2)),
    change_pct: Number(changePct.toFixed(2)),
  }
}

export const useWatchlistStore = create<WatchlistState>((set, get) => ({
  items: loadLocal(),
  quotes: {},
  loading: false,
  error: null,
  isLocal: false,

  fetch: async () => {
    set({ loading: true, error: null })
    try {
      const data = await api.watchlist.get()
      const items = data.watchlist.items || []
      saveLocal(items)
      set({ items, loading: false, isLocal: false })
    } catch {
      const items = loadLocal()
      set({ items, loading: false, isLocal: true })
    }
  },

  add: async (ticker, companyName) => {
    set({ error: null })
    const newItem: WatchlistItem = {
      ticker: ticker.toUpperCase(),
      company_name: companyName || ticker.toUpperCase(),
      added_at: new Date().toISOString(),
      notes: '',
    }

    try {
      const data = await api.watchlist.add(ticker, companyName)
      const items = data.watchlist.items || []
      saveLocal(items)
      set({ items, isLocal: false })
    } catch {
      // Fallback: add locally
      const existing = get().items
      if (existing.some((i) => i.ticker === newItem.ticker)) return
      const items = [...existing, newItem]
      saveLocal(items)
      set({ items, isLocal: true })
    }
  },

  remove: async (ticker) => {
    set({ error: null })
    try {
      const data = await api.watchlist.remove(ticker)
      const items = data.watchlist.items || []
      saveLocal(items)
      set({ items, isLocal: false })
    } catch {
      // Fallback: remove locally
      const items = get().items.filter((i) => i.ticker !== ticker)
      saveLocal(items)
      set({ items, isLocal: true })
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
    } catch {
      // Fallback: generate deterministic mock quotes
      const quotesMap: Record<string, QuoteData> = {}
      for (const ticker of tickers) {
        quotesMap[ticker] = mockQuote(ticker)
      }
      set({ quotes: quotesMap })
    }
  },

  tickers: () => get().items.map((i) => i.ticker),
}))
