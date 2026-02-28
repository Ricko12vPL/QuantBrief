import { useState, useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Upload,
  FileAudio,
  Loader2,
  Mic,
  TrendingUp,
  AlertTriangle,
  MessageSquare,
  Target,
  ChevronDown,
  ChevronRight,
  X,
} from 'lucide-react'
import { api } from '../../lib/api'

interface QAHighlight {
  question: string
  answer: string
  topic: string
}

interface EarningsAnalysis {
  ticker: string
  transcript: string
  key_topics: string[]
  financial_highlights: { metric: string; value: string; comparison: string; commentary: string }[]
  forward_guidance: string[]
  risk_factors: string[]
  qa_highlights: QAHighlight[]
  summary: string
  sentiment: string
  confidence_score: number
}

const ACCEPTED_EXTENSIONS_LIST = ['.mp3', '.wav', '.m4a', '.ogg', '.flac']
const ACCEPTED_EXTENSIONS = ACCEPTED_EXTENSIONS_LIST.join(',')
const MAX_FILE_SIZE = 100 * 1024 * 1024 // 100 MB

function Section({
  title,
  icon: Icon,
  iconColor,
  children,
  defaultOpen = false,
}: {
  title: string
  icon: React.ComponentType<{ className?: string }>
  iconColor: string
  children: React.ReactNode
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="border-t border-zinc-800">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-2 py-3 text-left text-sm font-medium text-zinc-300 hover:text-white"
      >
        {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        <Icon className={`h-4 w-4 ${iconColor}`} />
        {title}
      </button>
      {open && <div className="pb-3">{children}</div>}
    </div>
  )
}

function SentimentBadge({ sentiment, confidence }: { sentiment: string; confidence: number }) {
  const colorMap: Record<string, string> = {
    bullish: 'bg-emerald-400/10 text-emerald-400 border-emerald-400/20',
    bearish: 'bg-red-400/10 text-red-400 border-red-400/20',
    neutral: 'bg-zinc-400/10 text-zinc-400 border-zinc-400/20',
  }
  const color = colorMap[sentiment] || colorMap.neutral

  return (
    <div className="flex items-center gap-2">
      <span className={`rounded border px-2 py-0.5 text-xs font-semibold uppercase ${color}`}>
        {sentiment}
      </span>
      <span className="text-xs text-zinc-500">
        {(confidence * 100).toFixed(0)}% confidence
      </span>
    </div>
  )
}

export default function EarningsCallUpload() {
  useTranslation()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [ticker, setTicker] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [analysis, setAnalysis] = useState<EarningsAnalysis | null>(null)
  const [dragActive, setDragActive] = useState(false)

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }, [])

  const validateFile = useCallback((f: File): string | null => {
    if (f.size > MAX_FILE_SIZE) {
      return `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB.`
    }
    const ext = '.' + f.name.split('.').pop()?.toLowerCase()
    if (!ACCEPTED_EXTENSIONS_LIST.includes(ext)) {
      return `Unsupported format. Accepted: ${ACCEPTED_EXTENSIONS}`
    }
    return null
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setDragActive(false)
      setError(null)

      const droppedFile = e.dataTransfer.files[0]
      if (!droppedFile) return

      const validationError = validateFile(droppedFile)
      if (validationError) {
        setError(validationError)
        return
      }
      setFile(droppedFile)
    },
    [validateFile],
  )

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setError(null)
      const selectedFile = e.target.files?.[0]
      if (!selectedFile) return

      const validationError = validateFile(selectedFile)
      if (validationError) {
        setError(validationError)
        return
      }
      setFile(selectedFile)
    },
    [validateFile],
  )

  const handleSubmit = useCallback(async () => {
    if (!file || !ticker.trim()) return

    setLoading(true)
    setError(null)
    setAnalysis(null)

    try {
      const result = await api.earningsCall.analyze(file, ticker.trim().toUpperCase())
      setAnalysis(result.analysis)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed')
    } finally {
      setLoading(false)
    }
  }, [file, ticker])

  const clearFile = useCallback(() => {
    setFile(null)
    setError(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }, [])

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  return (
    <div className="space-y-6">
      {/* Upload Section */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6 backdrop-blur">
        <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-white">
          <Mic className="h-5 w-5 text-[#FF7000]" />
          Earnings Call Analysis
          <span className="rounded bg-[#FF7000]/10 px-2 py-0.5 text-xs font-medium text-[#FF7000]">
            Voxtral
          </span>
        </h3>

        {/* Drag and Drop Zone */}
        <div
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`relative flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition-colors ${
            dragActive
              ? 'border-[#FF7000] bg-[#FF7000]/5'
              : file
                ? 'border-emerald-500/30 bg-emerald-500/5'
                : 'border-zinc-700 bg-zinc-800/30 hover:border-zinc-600 hover:bg-zinc-800/50'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_EXTENSIONS}
            onChange={handleFileSelect}
            className="hidden"
          />

          {file ? (
            <div className="flex items-center gap-3">
              <FileAudio className="h-8 w-8 text-emerald-400" />
              <div>
                <p className="text-sm font-medium text-white">{file.name}</p>
                <p className="text-xs text-zinc-500">{formatFileSize(file.size)}</p>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  clearFile()
                }}
                className="ml-2 rounded p-1 text-zinc-500 hover:bg-zinc-700 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <>
              <Upload className="mb-3 h-10 w-10 text-zinc-500" />
              <p className="text-sm text-zinc-400">
                Drag and drop an audio file, or click to browse
              </p>
              <p className="mt-1 text-xs text-zinc-600">
                Supports MP3, WAV, M4A, OGG, FLAC (max 100MB)
              </p>
            </>
          )}
        </div>

        {/* Ticker Input and Submit */}
        <div className="mt-4 flex gap-3">
          <input
            type="text"
            placeholder="Ticker (e.g. NVDA)"
            value={ticker}
            onChange={(e) => setTicker(e.target.value.toUpperCase())}
            maxLength={10}
            className="flex-1 rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-sm text-white placeholder-zinc-500 focus:border-[#FF7000] focus:outline-none focus:ring-1 focus:ring-[#FF7000]"
          />
          <button
            onClick={handleSubmit}
            disabled={!file || !ticker.trim() || loading}
            className="flex items-center gap-2 rounded-lg bg-[#FF7000] px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#FF7000]/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <Mic className="h-4 w-4" />
                Analyze
              </>
            )}
          </button>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mt-3 rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-400">
            {error}
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="mt-4 space-y-2">
            <div className="flex items-center gap-2 text-sm text-zinc-400">
              <Loader2 className="h-4 w-4 animate-spin text-[#FF7000]" />
              <span>Step 1: Transcribing audio with Voxtral...</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-zinc-600">
              <div className="h-4 w-4" />
              <span>Step 2: Analyzing transcript with Mistral Large 3...</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
              <div className="h-full animate-pulse rounded-full bg-[#FF7000]/50" style={{ width: '60%' }} />
            </div>
          </div>
        )}
      </div>

      {/* Results Section */}
      {analysis && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6 backdrop-blur">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-lg font-semibold text-white">
              <FileAudio className="h-5 w-5 text-[#FF7000]" />
              {analysis.ticker} Earnings Call Analysis
            </h3>
            <SentimentBadge sentiment={analysis.sentiment} confidence={analysis.confidence_score} />
          </div>

          {/* Summary */}
          <Section title="Summary" icon={Target} iconColor="text-[#FF7000]" defaultOpen>
            <p className="text-sm leading-relaxed text-zinc-300">{analysis.summary}</p>
          </Section>

          {/* Key Topics */}
          {analysis.key_topics.length > 0 && (
            <Section title={`Key Topics (${analysis.key_topics.length})`} icon={Target} iconColor="text-blue-400" defaultOpen>
              <div className="flex flex-wrap gap-2">
                {analysis.key_topics.map((topic, i) => (
                  <span
                    key={i}
                    className="rounded-full border border-blue-400/20 bg-blue-400/10 px-3 py-1 text-xs text-blue-400"
                  >
                    {topic}
                  </span>
                ))}
              </div>
            </Section>
          )}

          {/* Financial Highlights */}
          {analysis.financial_highlights.length > 0 && (
            <Section title="Financial Highlights" icon={TrendingUp} iconColor="text-emerald-400">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-zinc-500">
                      <th className="pb-2 pr-4">Metric</th>
                      <th className="pb-2 pr-4">Value</th>
                      <th className="pb-2 pr-4">Comparison</th>
                      <th className="pb-2">Commentary</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analysis.financial_highlights.map((h, j) => (
                      <tr key={j} className="border-t border-zinc-800/50">
                        <td className="py-1.5 pr-4 text-zinc-300">{h.metric}</td>
                        <td className="py-1.5 pr-4 font-medium text-white">{h.value}</td>
                        <td className="py-1.5 pr-4 text-zinc-500">{h.comparison || '--'}</td>
                        <td className="py-1.5 text-xs text-zinc-500">{h.commentary || ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>
          )}

          {/* Forward Guidance */}
          {analysis.forward_guidance.length > 0 && (
            <Section title={`Forward Guidance (${analysis.forward_guidance.length})`} icon={TrendingUp} iconColor="text-cyan-400">
              <ul className="space-y-1">
                {analysis.forward_guidance.map((g, j) => (
                  <li key={j} className="flex gap-2 text-sm text-zinc-400">
                    <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-cyan-400/50" />
                    {g}
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {/* Risk Factors */}
          {analysis.risk_factors.length > 0 && (
            <Section title={`Risk Factors (${analysis.risk_factors.length})`} icon={AlertTriangle} iconColor="text-red-400">
              <ul className="space-y-1">
                {analysis.risk_factors.map((r, j) => (
                  <li key={j} className="flex gap-2 text-sm text-zinc-400">
                    <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-red-400/50" />
                    {r}
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {/* Q&A Highlights */}
          {analysis.qa_highlights.length > 0 && (
            <Section title={`Q&A Highlights (${analysis.qa_highlights.length})`} icon={MessageSquare} iconColor="text-purple-400">
              <div className="space-y-3">
                {analysis.qa_highlights.map((qa, j) => (
                  <div key={j} className="rounded-lg border border-zinc-800 bg-zinc-800/30 p-3">
                    {qa.topic && (
                      <span className="mb-1 inline-block rounded bg-purple-400/10 px-2 py-0.5 text-xs text-purple-400">
                        {qa.topic}
                      </span>
                    )}
                    <p className="mt-1 text-sm font-medium text-zinc-300">
                      Q: {qa.question}
                    </p>
                    <p className="mt-1 text-sm text-zinc-500">
                      A: {qa.answer}
                    </p>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Transcript (collapsed by default) */}
          {analysis.transcript && (
            <Section title="Full Transcript" icon={FileAudio} iconColor="text-zinc-500">
              <div className="max-h-96 overflow-y-auto rounded-lg bg-zinc-800/50 p-4">
                <pre className="whitespace-pre-wrap text-xs leading-relaxed text-zinc-400">
                  {analysis.transcript}
                </pre>
              </div>
            </Section>
          )}
        </div>
      )}
    </div>
  )
}
