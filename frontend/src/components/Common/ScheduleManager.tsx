import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Clock, Plus, Pause, Play, Trash2, ChevronUp } from 'lucide-react'
import { useScheduleStore } from '../../stores/scheduleStore'
import { useBriefStore } from '../../stores/briefStore'

const SOURCES = ['custom', 'portfolio', 'watchlist', 'all'] as const
const FREQUENCIES = ['every_4h', 'daily', 'weekly'] as const
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function formatCountdown(nextRunAt: string | null): string {
  if (!nextRunAt) return '---'
  const diff = new Date(nextRunAt).getTime() - Date.now()
  if (diff <= 0) return 'now'
  const hours = Math.floor(diff / 3_600_000)
  const mins = Math.floor((diff % 3_600_000) / 60_000)
  if (hours > 0) return `in ${hours}h ${mins}m`
  return `in ${mins}m`
}

export default function ScheduleManager() {
  const { t } = useTranslation()
  const { schedules, fetch, create, remove, pause, resume } = useScheduleStore()
  const fetchLatestBrief = useBriefStore((s) => s.fetchLatest)
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [source, setSource] = useState<(typeof SOURCES)[number]>('watchlist')
  const [customTickers, setCustomTickers] = useState('')
  const [frequency, setFrequency] = useState<(typeof FREQUENCIES)[number]>('daily')
  const [hour, setHour] = useState(9)
  const [minute, setMinute] = useState(0)
  const [dayOfWeek, setDayOfWeek] = useState(0)
  const [lang, setLang] = useState('en')
  const [audio, setAudio] = useState(true)
  const [, setTick] = useState(0)
  const lastBriefIdsRef = useRef<Record<string, string | null>>({})

  useEffect(() => {
    fetch()
    const interval = window.setInterval(() => {
      fetch()
      setTick((t) => t + 1)
    }, 15_000)
    return () => window.clearInterval(interval)
  }, [])

  // Auto-refresh dashboard when a schedule produces a new brief
  useEffect(() => {
    for (const s of schedules) {
      const prev = lastBriefIdsRef.current[s.id]
      if (prev !== undefined && s.last_brief_id && s.last_brief_id !== prev) {
        fetchLatestBrief()
        break
      }
    }
    const next: Record<string, string | null> = {}
    for (const s of schedules) {
      next[s.id] = s.last_brief_id
    }
    lastBriefIdsRef.current = next
  }, [schedules, fetchLatestBrief])

  const handleCreate = async () => {
    const tickers =
      source === 'custom'
        ? customTickers
            .split(',')
            .map((t) => t.trim().toUpperCase())
            .filter(Boolean)
        : undefined
    const ok = await create({
      name: name || undefined,
      ticker_source: source,
      tickers,
      frequency,
      hour,
      minute,
      day_of_week: dayOfWeek,
      language: lang,
      generate_audio: audio,
    })
    if (ok) {
      setName('')
      setCustomTickers('')
      setOpen(false)
    }
  }

  const sourceLabel = (s: string) => {
    const key = `schedule_source_${s}` as const
    return t(key)
  }

  const freqLabel = (f: string) => {
    const key = `schedule_freq_${f}` as const
    return t(key)
  }

  return (
    <div className="glass-card p-6">
      <h3 className="mb-4 flex items-center justify-between text-lg font-semibold text-white">
        <span className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-[#FF7000]" />
          {t('schedules')}
        </span>
        <button
          onClick={() => setOpen(!open)}
          className="rounded-md p-1 text-zinc-400 transition hover:bg-zinc-700 hover:text-white"
          aria-label={t('schedule_create')}
        >
          {open ? <ChevronUp className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
        </button>
      </h3>

      {open && (
        <div className="mb-4 space-y-3 rounded-lg border border-zinc-700 bg-zinc-800/50 p-3">
          {/* Name */}
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('schedule_name_placeholder')}
            maxLength={100}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-500 outline-none focus:border-[#FF7000]"
          />

          {/* Source */}
          <div>
            <label className="mb-1 block text-xs text-zinc-500">{t('schedule_source')}</label>
            <select
              value={source}
              onChange={(e) => setSource(e.target.value as (typeof SOURCES)[number])}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white outline-none focus:border-[#FF7000]"
            >
              {SOURCES.map((s) => (
                <option key={s} value={s}>
                  {sourceLabel(s)}
                </option>
              ))}
            </select>
          </div>

          {/* Custom tickers */}
          {source === 'custom' && (
            <div>
              <label className="mb-1 block text-xs text-zinc-500">{t('schedule_custom_tickers')}</label>
              <input
                type="text"
                value={customTickers}
                onChange={(e) => setCustomTickers(e.target.value)}
                placeholder="AAPL, NVDA, MSFT"
                maxLength={200}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-500 outline-none focus:border-[#FF7000]"
              />
            </div>
          )}

          {/* Frequency */}
          <div>
            <label className="mb-1 block text-xs text-zinc-500">{t('schedule_frequency')}</label>
            <select
              value={frequency}
              onChange={(e) => setFrequency(e.target.value as (typeof FREQUENCIES)[number])}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white outline-none focus:border-[#FF7000]"
            >
              {FREQUENCIES.map((f) => (
                <option key={f} value={f}>
                  {freqLabel(f)}
                </option>
              ))}
            </select>
          </div>

          {/* Time (daily / weekly only) */}
          {frequency !== 'every_4h' && (
            <div>
              <label className="mb-1 block text-xs text-zinc-500">{t('schedule_time')}</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  max={23}
                  value={hour}
                  onChange={(e) => setHour(Number(e.target.value))}
                  className="w-16 rounded-lg border border-zinc-700 bg-zinc-800 px-2 py-2 text-center text-sm text-white outline-none focus:border-[#FF7000]"
                />
                <span className="text-zinc-500">:</span>
                <input
                  type="number"
                  min={0}
                  max={59}
                  value={minute}
                  onChange={(e) => setMinute(Number(e.target.value))}
                  className="w-16 rounded-lg border border-zinc-700 bg-zinc-800 px-2 py-2 text-center text-sm text-white outline-none focus:border-[#FF7000]"
                />
                <span className="text-xs text-zinc-500">UTC</span>
              </div>
            </div>
          )}

          {/* Day of week (weekly only) */}
          {frequency === 'weekly' && (
            <div>
              <label className="mb-1 block text-xs text-zinc-500">{t('schedule_day')}</label>
              <select
                value={dayOfWeek}
                onChange={(e) => setDayOfWeek(Number(e.target.value))}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white outline-none focus:border-[#FF7000]"
              >
                {DAYS.map((d, i) => (
                  <option key={d} value={i}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Language + Audio */}
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <label className="mb-1 block text-xs text-zinc-500">{t('language')}</label>
              <select
                value={lang}
                onChange={(e) => setLang(e.target.value)}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white outline-none focus:border-[#FF7000]"
              >
                <option value="en">EN</option>
                <option value="fr">FR</option>
                <option value="de">DE</option>
                <option value="pl">PL</option>
                <option value="es">ES</option>
              </select>
            </div>
            <label className="flex items-center gap-2 pt-4 text-sm text-zinc-300">
              <input
                type="checkbox"
                checked={audio}
                onChange={(e) => setAudio(e.target.checked)}
                className="h-4 w-4 rounded border-zinc-600 accent-[#FF7000]"
              />
              {t('schedule_audio')}
            </label>
          </div>

          {/* Create button */}
          <button
            onClick={handleCreate}
            disabled={schedules.length >= 10}
            className="w-full rounded-lg bg-[#FF7000] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#FF7000]/80 disabled:opacity-50"
          >
            {schedules.length >= 10 ? t('schedule_max_reached') : t('schedule_create')}
          </button>
        </div>
      )}

      {/* Schedule cards */}
      {schedules.length > 0 ? (
        <div className="space-y-3">
          {schedules.map((s) => (
            <div
              key={s.id}
              className={`rounded-lg border p-3 ${
                s.paused
                  ? 'border-zinc-700 bg-zinc-800/30 opacity-60'
                  : 'border-zinc-700 bg-zinc-800/50'
              }`}
            >
              <div className="mb-1 text-sm font-medium text-white">
                {s.name || t('schedule_unnamed')}
              </div>
              <div className="mb-2 text-xs text-zinc-500">
                {sourceLabel(s.ticker_source)} &middot; {freqLabel(s.frequency)}
                {s.frequency !== 'every_4h' && (
                  <>
                    {' '}
                    {String(s.hour).padStart(2, '0')}:{String(s.minute).padStart(2, '0')} UTC
                  </>
                )}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-400">
                  {s.paused
                    ? t('schedule_paused')
                    : `${t('schedule_next')}: ${formatCountdown(s.next_run_at)}`}
                </span>
                <div className="flex gap-1">
                  {s.paused ? (
                    <button
                      onClick={() => resume(s.id)}
                      className="rounded p-1 text-zinc-400 transition hover:bg-zinc-700 hover:text-emerald-400"
                      aria-label="Resume"
                    >
                      <Play className="h-3.5 w-3.5" />
                    </button>
                  ) : (
                    <button
                      onClick={() => pause(s.id)}
                      className="rounded p-1 text-zinc-400 transition hover:bg-zinc-700 hover:text-amber-400"
                      aria-label="Pause"
                    >
                      <Pause className="h-3.5 w-3.5" />
                    </button>
                  )}
                  <button
                    onClick={() => remove(s.id)}
                    className="rounded p-1 text-zinc-400 transition hover:bg-zinc-700 hover:text-red-400"
                    aria-label="Delete"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-center text-sm text-zinc-600">{t('no_schedules')}</p>
      )}
    </div>
  )
}
