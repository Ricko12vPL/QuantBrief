import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, X, Eye, Search, TrendingUp, TrendingDown } from 'lucide-react'
import { useWatchlistStore } from '../../stores/watchlistStore'
import { api } from '../../lib/api'

interface Suggestion {
  symbol: string
  description: string
  type: string
}

export default function WatchlistManager() {
  const { t } = useTranslation()
  const { items, quotes, add, remove, fetchQuotes } = useWatchlistStore()
  const [input, setInput] = useState('')
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [showDropdown, setShowDropdown] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined)

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
      setShowDropdown(false)
    }
  }, [])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => fetchSuggestions(input), 300)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [input, fetchSuggestions])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Fetch quotes when items load and every 30 seconds
  useEffect(() => {
    if (items.length === 0) return
    fetchQuotes()
    const interval = window.setInterval(fetchQuotes, 30_000)
    return () => window.clearInterval(interval)
  }, [items.length])

  const selectSuggestion = async (suggestion: Suggestion) => {
    await add(suggestion.symbol, suggestion.description)
    setInput('')
    setSuggestions([])
    setShowDropdown(false)
    inputRef.current?.focus()
  }

  const handleAdd = async () => {
    const ticker = input.trim().toUpperCase()
    if (!ticker) return
    await add(ticker)
    setInput('')
    setSuggestions([])
    setShowDropdown(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setShowDropdown(false)
      return
    }
    if (!showDropdown || suggestions.length === 0) {
      if (e.key === 'Enter') handleAdd()
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : 0))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : suggestions.length - 1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
        selectSuggestion(suggestions[selectedIndex])
      } else {
        handleAdd()
      }
    }
  }

  return (
    <div className="glass-card p-6">
      <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-white">
        <Eye className="h-5 w-5 text-[#FF7000]" />
        {t('watchlist')}
      </h3>
      <div className="relative mb-4" ref={dropdownRef}>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={() => { if (suggestions.length > 0) setShowDropdown(true) }}
              placeholder={t('search_ticker')}
              maxLength={50}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800 py-2 pl-9 pr-3 text-sm text-white placeholder-zinc-500 outline-none focus:border-[#FF7000]"
            />
          </div>
          <button
            onClick={handleAdd}
            aria-label={t('add_ticker')}
            className="flex items-center gap-1 rounded-lg bg-[#FF7000] px-3 py-2 text-sm font-medium text-white transition hover:bg-[#FF7000]/80"
          >
            <Plus className="h-4 w-4" />
          </button>
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

      {items.length > 0 ? (
        <div>
          {/* Header row */}
          <div className="flex items-center justify-between border-b border-zinc-700 pb-2 text-xs text-zinc-500">
            <span className="flex-1">{t('ticker') || 'Ticker'}</span>
            <div className="flex items-center gap-3 text-right">
              <span className="w-20 text-right">{t('price') || 'Price'}</span>
              <span className="w-20 text-right">{t('change') || 'Change'}</span>
              <span className="w-5" />
            </div>
          </div>

          {/* Watchlist rows */}
          {items.map((item) => {
            const quote = quotes[item.ticker]
            const positive = quote ? quote.change_pct >= 0 : true
            return (
              <div
                key={item.ticker}
                className="flex items-center justify-between border-b border-zinc-800/50 py-2 last:border-0"
              >
                <div className="min-w-0 flex-1">
                  <span className="text-sm font-medium text-white">{item.ticker}</span>
                  {item.company_name && (
                    <span className="ml-2 truncate text-xs text-zinc-500">{item.company_name}</span>
                  )}
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <span className="w-20 text-right tabular-nums text-zinc-300">
                    {quote ? `$${quote.price.toFixed(2)}` : '---'}
                  </span>
                  <span
                    className={`flex w-20 items-center justify-end gap-1 tabular-nums ${
                      positive ? 'text-emerald-400' : 'text-red-400'
                    }`}
                  >
                    {quote ? (
                      <>
                        {positive ? (
                          <TrendingUp className="h-3 w-3" />
                        ) : (
                          <TrendingDown className="h-3 w-3" />
                        )}
                        {quote.change_pct >= 0 ? '+' : ''}{quote.change_pct.toFixed(2)}%
                      </>
                    ) : (
                      '---'
                    )}
                  </span>
                  <button
                    onClick={() => remove(item.ticker)}
                    aria-label={`${t('remove_ticker')} ${item.ticker}`}
                    className="text-zinc-600 transition hover:text-red-400"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <p className="text-center text-sm text-zinc-600">{t('no_watchlist')}</p>
      )}
    </div>
  )
}
