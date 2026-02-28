import { useTranslation } from 'react-i18next'
import { FileText, Volume2, TrendingUp, TrendingDown, Minus } from 'lucide-react'

interface BriefCardProps {
  brief: {
    executive_summary: string
    overall_sentiment: string
    confidence_score: number
    generated_at: string
    audio_url: string
    language: string
  }
  onPlayAudio: () => void
}

const sentimentConfig = {
  bullish: { icon: TrendingUp, color: 'text-emerald-400', bg: 'bg-emerald-400/10' },
  bearish: { icon: TrendingDown, color: 'text-red-400', bg: 'bg-red-400/10' },
  neutral: { icon: Minus, color: 'text-yellow-400', bg: 'bg-yellow-400/10' },
}

export default function BriefCard({ brief, onPlayAudio }: BriefCardProps) {
  const { t } = useTranslation()
  const sentiment = sentimentConfig[brief.overall_sentiment as keyof typeof sentimentConfig] || sentimentConfig.neutral
  const SentimentIcon = sentiment.icon
  const date = new Date(brief.generated_at).toLocaleString()

  return (
    <div className="glass-card p-6">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#FF7000]/10">
            <FileText className="h-5 w-5 text-[#FF7000]" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">{t('latest_brief')}</h2>
            <p className="text-sm text-zinc-500">{date}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className={`flex items-center gap-1.5 rounded-full px-3 py-1 ${sentiment.bg}`}>
            <SentimentIcon className={`h-4 w-4 ${sentiment.color}`} />
            <span className={`text-sm font-medium ${sentiment.color}`}>
              {t(`sentiment_${brief.overall_sentiment}`)}
            </span>
          </div>
          {brief.audio_url && (
            <button
              onClick={onPlayAudio}
              className="flex items-center gap-1.5 rounded-lg bg-[#FF7000] px-3 py-1.5 text-sm font-medium text-white transition hover:bg-[#FF7000]/80"
            >
              <Volume2 className="h-4 w-4" />
              {t('play')}
            </button>
          )}
        </div>
      </div>
      <p className="leading-relaxed text-zinc-300">{brief.executive_summary}</p>
      <div className="mt-4 flex items-center gap-2">
        <span className="text-sm text-zinc-500">{t('confidence')}:</span>
        <div className="h-2 w-32 overflow-hidden rounded-full bg-zinc-800">
          <div
            className="h-full rounded-full bg-[#FF7000] transition-all"
            style={{ width: `${brief.confidence_score * 100}%` }}
          />
        </div>
        <span className="text-sm font-medium text-zinc-400">
          {Math.round(brief.confidence_score * 100)}%
        </span>
      </div>
    </div>
  )
}
