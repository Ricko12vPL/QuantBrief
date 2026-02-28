import { useTranslation } from 'react-i18next'
import { AlertTriangle, TrendingUp, TrendingDown, Minus } from 'lucide-react'

interface MaterialEvent {
  ticker: string
  event_type: string
  headline: string
  impact_assessment: string
  confidence: number
  sentiment: string
}

interface EventTimelineProps {
  events: MaterialEvent[]
}

const sentimentIcon = {
  bullish: TrendingUp,
  bearish: TrendingDown,
  neutral: Minus,
}

const sentimentColor = {
  bullish: 'border-emerald-500 bg-emerald-500',
  bearish: 'border-red-500 bg-red-500',
  neutral: 'border-yellow-500 bg-yellow-500',
}

export default function EventTimeline({ events }: EventTimelineProps) {
  const { t } = useTranslation()

  if (!events.length) return null

  return (
    <div className="glass-card p-6">
      <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-white">
        <AlertTriangle className="h-5 w-5 text-[#FF7000]" />
        {t('material_events')}
      </h3>
      <div className="space-y-4">
        {events.map((event, i) => {
          const color = sentimentColor[event.sentiment as keyof typeof sentimentColor] || sentimentColor.neutral
          const Icon = sentimentIcon[event.sentiment as keyof typeof sentimentIcon] || Minus
          return (
            <div key={i} className="flex gap-4">
              <div className="flex flex-col items-center">
                <div className={`h-3 w-3 rounded-full ${color}`} />
                {i < events.length - 1 && <div className="w-px flex-1 bg-zinc-700" />}
              </div>
              <div className="flex-1 pb-4">
                <div className="flex items-center gap-2">
                  <span className="rounded bg-zinc-800 px-2 py-0.5 text-xs font-bold text-[#FF7000]">
                    {event.ticker}
                  </span>
                  <span className="text-xs text-zinc-500">{event.event_type.replace(/_/g, ' ')}</span>
                  <Icon className={`h-3.5 w-3.5 ${event.sentiment === 'bullish' ? 'text-emerald-400' : event.sentiment === 'bearish' ? 'text-red-400' : 'text-yellow-400'}`} />
                </div>
                <p className="mt-1 text-justify text-sm font-medium text-zinc-200">{event.headline}</p>
                <p className="mt-0.5 text-justify text-sm text-zinc-500">{event.impact_assessment}</p>
                <div className="mt-1 flex items-center gap-1">
                  <div className="h-1.5 w-16 overflow-hidden rounded-full bg-zinc-800">
                    <div
                      className="h-full rounded-full bg-[#FF7000]"
                      style={{ width: `${event.confidence * 100}%` }}
                    />
                  </div>
                  <span className="text-xs tabular-nums text-zinc-600">{Math.round(event.confidence * 100)}%</span>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
