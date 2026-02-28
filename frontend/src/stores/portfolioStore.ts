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
  isLocal: boolean
  fetch: () => Promise<void>
  add: (ticker: string, shares: number, avgPrice: number, companyName?: string) => Promise<boolean>
  remove: (ticker: string) => Promise<void>
  tickers: () => string[]
}

const STORAGE_KEY = 'qb_portfolio'

function loadLocal(): Position[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
  } catch {
    return []
  }
}

function saveLocal(positions: Position[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(positions))
}

export const usePortfolioStore = create<PortfolioState>((set, get) => ({
  positions: loadLocal(),
  loading: false,
  error: null,
  isLocal: false,

  fetch: async () => {
    set({ loading: true, error: null })
    try {
      const data = await api.portfolio.get()
      const positions = data.positions || []
      saveLocal(positions)
      set({ positions, loading: false, isLocal: false })
    } catch {
      const positions = loadLocal()
      set({ positions, loading: false, isLocal: true })
    }
  },

  add: async (ticker, shares, avgPrice, companyName) => {
    set({ error: null })
    const newPosition: Position = {
      ticker: ticker.toUpperCase(),
      shares,
      avg_price: avgPrice,
      company_name: companyName || ticker.toUpperCase(),
    }

    try {
      const data = await api.portfolio.add(ticker, shares, avgPrice, companyName)
      const positions = data.positions || []
      saveLocal(positions)
      set({ positions, isLocal: false })
      return true
    } catch {
      // Fallback: add locally
      const existing = get().positions
      const filtered = existing.filter((p) => p.ticker !== newPosition.ticker)
      const positions = [...filtered, newPosition]
      saveLocal(positions)
      set({ positions, isLocal: true })
      return true
    }
  },

  remove: async (ticker) => {
    set({ error: null })
    try {
      const data = await api.portfolio.remove(ticker)
      const positions = data.positions || []
      saveLocal(positions)
      set({ positions, isLocal: false })
    } catch {
      // Fallback: remove locally
      const positions = get().positions.filter((p) => p.ticker !== ticker)
      saveLocal(positions)
      set({ positions, isLocal: true })
    }
  },

  tickers: () => get().positions.map((p) => p.ticker),
}))
