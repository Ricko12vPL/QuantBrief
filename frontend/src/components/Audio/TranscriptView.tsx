import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { FileText, ChevronDown, ChevronRight } from 'lucide-react'

interface TranscriptViewProps {
  transcript: string
  title?: string
}

export default function TranscriptView({ transcript, title }: TranscriptViewProps) {
  const { t } = useTranslation()
  const [expanded, setExpanded] = useState(false)

  if (!transcript) return null

  const paragraphs = transcript
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter(Boolean)

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6 backdrop-blur">
      <button
        onClick={() => setExpanded((prev) => !prev)}
        className="flex w-full items-center justify-between text-left"
      >
        <h3 className="flex items-center gap-2 text-lg font-semibold text-white">
          <FileText className="h-5 w-5 text-[#FF7000]" />
          {title || t('transcript')}
        </h3>
        <div className="flex items-center gap-2 text-sm text-zinc-500">
          <span>{expanded ? t('collapse') : t('expand')}</span>
          {expanded
            ? <ChevronDown className="h-4 w-4" />
            : <ChevronRight className="h-4 w-4" />
          }
        </div>
      </button>

      {expanded && (
        <div className="mt-4 max-h-96 overflow-y-auto rounded-lg bg-zinc-800/50 p-4">
          <div className="space-y-3">
            {paragraphs.map((paragraph, i) => (
              <p key={i} className="text-sm leading-relaxed text-zinc-300">
                {paragraph}
              </p>
            ))}
          </div>
        </div>
      )}

      {!expanded && (
        <p className="mt-3 line-clamp-2 text-sm text-zinc-500">
          {paragraphs[0]}
        </p>
      )}
    </div>
  )
}
