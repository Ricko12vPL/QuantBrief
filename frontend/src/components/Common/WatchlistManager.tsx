import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, X, Eye } from 'lucide-react'
import { useWatchlistStore } from '../../stores/watchlistStore'

export default function WatchlistManager() {
  const { t } = useTranslation()
  const { items, add, remove } = useWatchlistStore()
  const [input, setInput] = useState('')

  const handleAdd = async () => {
    const ticker = input.trim().toUpperCase()
    if (!ticker) return
    await add(ticker)
    setInput('')
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleAdd()
  }

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6 backdrop-blur">
      <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-white">
        <Eye className="h-5 w-5 text-[#FF7000]" />
        {t('watchlist')}
      </h3>
      <div className="mb-3 flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value.toUpperCase())}
          onKeyDown={handleKeyDown}
          placeholder={t('add_ticker')}
          maxLength={10}
          className="flex-1 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-500 outline-none focus:border-[#FF7000]"
        />
        <button
          onClick={handleAdd}
          aria-label={t('add_ticker')}
          className="flex items-center gap-1 rounded-lg bg-[#FF7000] px-3 py-2 text-sm font-medium text-white transition hover:bg-[#FF7000]/80"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        {items.map((item) => (
          <div
            key={item.ticker}
            className="flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-800/50 px-3 py-1.5"
          >
            <span className="text-sm font-medium text-white">{item.ticker}</span>
            {item.company_name && (
              <span className="text-xs text-zinc-500">{item.company_name}</span>
            )}
            <button
              onClick={() => remove(item.ticker)}
              aria-label={`${t('remove_ticker')} ${item.ticker}`}
              className="ml-1 text-zinc-600 transition hover:text-red-400"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
