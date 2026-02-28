import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Briefcase, Plus, Trash2, Search, Loader2 } from 'lucide-react'
import { usePortfolioStore } from '../../stores/portfolioStore'
import { api } from '../../lib/api'

interface Suggestion {
  symbol: string
  description: string
}

export default function PortfolioManager() {
  const { t } = useTranslation()
  const { positions, error, add, remove, fetch: fetchPortfolio } = usePortfolioStore()

  const [ticker, setTicker] = useState('')
  const [shares, setShares] = useState('')
  const [avgPrice, setAvgPrice] = useState('')
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [showDropdown, setShowDropdown] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const [companyName, setCompanyName] = useState('')
  const [adding, setAdding] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  useEffect(() => {
    fetchPortfolio()
  }, [fetchPortfolio])

  const fetchSuggestions = useCallback(async (query: string) => {
    if (query.length < 2) {
      setSuggestions([])
      setShowDropdown(false)
      return
    }
    try {
      const data = await api.watchlist.search(query)
      setSuggestions(data.results || [])
      setShowDropdown(data.results?.length > 0)
      setSelectedIndex(-1)
    } catch {
      setSuggestions([])
    }
  }, [])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => fetchSuggestions(ticker), 300)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [ticker, fetchSuggestions])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const selectSuggestion = (s: Suggestion) => {
    setTicker(s.symbol)
    setCompanyName(s.description)
    setShowDropdown(false)
    setSuggestions([])
  }

  const handleAdd = async () => {
    const tickerVal = ticker.trim().toUpperCase()
    const s = parseFloat(shares)
    const p = parseFloat(avgPrice)
    if (!tickerVal || isNaN(s) || s <= 0 || isNaN(p) || p <= 0) return
    setAdding(true)
    const success = await add(tickerVal, s, p, companyName.trim())
    setAdding(false)
    if (success) {
      setTicker('')
      setShares('')
      setAvgPrice('')
      setCompanyName('')
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setShowDropdown(false)
      return
    }
    if (!showDropdown || suggestions.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : 0))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : suggestions.length - 1))
    } else if (e.key === 'Enter' && selectedIndex >= 0) {
      e.preventDefault()
      selectSuggestion(suggestions[selectedIndex])
    }
  }

  return (
    <div className="glass-card p-6">
      <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-white">
        <Briefcase className="h-5 w-5 text-[#FF7000]" />
        {t('portfolio')}
      </h3>

      {error && (
        <div className="mb-4 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-400">
          {error}
        </div>
      )}

      <div className="mb-4 space-y-2">
        <div className="relative" ref={dropdownRef}>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
            <input
              type="text"
              value={ticker}
              onChange={(e) => setTicker(e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={() => { if (suggestions.length > 0) setShowDropdown(true) }}
              placeholder={t('search_ticker')}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800 py-2 pl-9 pr-3 text-sm text-white placeholder-zinc-500 outline-none focus:border-[#FF7000]"
            />
          </div>
          {showDropdown && suggestions.length > 0 && (
            <div className="absolute z-50 mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-800 py-1 shadow-xl">
              {suggestions.map((s, i) => (
                <button
                  key={s.symbol}
                  onClick={() => selectSuggestion(s)}
                  className={`flex w-full items-center gap-3 px-3 py-2 text-left text-sm transition ${
                    i === selectedIndex ? 'bg-[#FF7000]/20 text-white' : 'text-zinc-300 hover:bg-zinc-700'
                  }`}
                >
                  <span className="font-semibold text-[#FF7000]">{s.symbol}</span>
                  <span className="truncate text-zinc-400">{s.description}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="flex gap-2">
          <input
            type="number"
            value={shares}
            onChange={(e) => setShares(e.target.value)}
            placeholder={t('shares')}
            min="0"
            step="any"
            className="w-1/3 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-500 outline-none focus:border-[#FF7000]"
          />
          <input
            type="number"
            value={avgPrice}
            onChange={(e) => setAvgPrice(e.target.value)}
            placeholder={t('avg_price')}
            min="0"
            step="any"
            className="w-1/3 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-500 outline-none focus:border-[#FF7000]"
          />
          <button
            onClick={handleAdd}
            disabled={adding}
            className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-[#FF7000] px-3 py-2 text-sm font-medium text-white transition hover:bg-[#FF7000]/80 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            {t('add')}
          </button>
        </div>
      </div>

      {positions.length > 0 && (
        <div className="space-y-2">
          {positions.map((pos) => (
            <div
              key={pos.ticker}
              className="flex items-center justify-between rounded-lg border border-zinc-700 bg-zinc-800/50 px-3 py-2"
            >
              <div className="flex items-center gap-3">
                <span className="font-semibold text-[#FF7000]">{pos.ticker}</span>
                {pos.company_name && (
                  <span className="text-xs text-zinc-500">{pos.company_name}</span>
                )}
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right text-sm">
                  <div className="text-white">{pos.shares} {t('shares').toLowerCase()}</div>
                  <div className="text-xs text-zinc-500">@ ${pos.avg_price.toFixed(2)}</div>
                </div>
                <button
                  onClick={() => remove(pos.ticker)}
                  className="text-zinc-600 transition hover:text-red-400"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      {positions.length === 0 && (
        <p className="text-center text-sm text-zinc-600">{t('no_positions')}</p>
      )}
    </div>
  )
}
