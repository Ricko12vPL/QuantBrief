import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { FileText, ChevronDown, ChevronRight } from 'lucide-react'

interface FilingAnalysis {
  filing: {
    ticker: string
    company_name: string
    form_type: string
    filing_date: string
  }
  executive_summary: string
  financial_highlights: { metric: string; current_value: string; previous_value: string; change_pct: number | null; commentary: string }[]
  risk_factors: string[]
  key_metrics: Record<string, string>
  management_outlook: string
  notable_changes: string[]
  sentiment: string
  relevance_score: number
}

interface FilingViewerProps {
  analyses: FilingAnalysis[]
}

function Section({ title, children, defaultOpen = false }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="border-t border-zinc-800">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-2 py-3 text-left text-sm font-medium text-zinc-300 hover:text-white"
      >
        {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        {title}
      </button>
      {open && <div className="pb-3">{children}</div>}
    </div>
  )
}

export default function FilingViewer({ analyses }: FilingViewerProps) {
  const { t } = useTranslation()

  if (!analyses.length) return null

  return (
    <div className="glass-card p-6">
      <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-white">
        <FileText className="h-5 w-5 text-[#FF7000]" />
        {t('filing_analysis')}
      </h3>
      <div className="space-y-4">
        {analyses.map((analysis, i) => (
          <div key={i} className="rounded-lg border border-zinc-800 bg-zinc-800/30 p-4">
            <div className="mb-2 flex items-center gap-2">
              <span className="rounded bg-[#FF7000]/10 px-2 py-0.5 text-sm font-bold text-[#FF7000]">
                {analysis.filing.ticker}
              </span>
              <span className="text-sm text-zinc-400">{analysis.filing.form_type}</span>
              <span className="text-xs text-zinc-600">
                {new Date(analysis.filing.filing_date).toLocaleDateString()}
              </span>
            </div>

            <Section title={t('executive_summary')} defaultOpen>
              <p className="text-justify text-sm leading-relaxed text-zinc-300">{analysis.executive_summary}</p>
            </Section>

            {analysis.financial_highlights.length > 0 && (
              <Section title={t('filing_financial_highlights')}>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs text-zinc-500">
                        <th className="pb-2 pr-4">{t('filing_metric')}</th>
                        <th className="pb-2 pr-4">{t('filing_current')}</th>
                        <th className="pb-2 pr-4">{t('filing_previous')}</th>
                        <th className="pb-2">{t('filing_change')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {analysis.financial_highlights.map((h, j) => (
                        <tr key={j} className="border-t border-zinc-800/50">
                          <td className="py-1.5 pr-4 text-zinc-300">{h.metric}</td>
                          <td className="py-1.5 pr-4 font-medium text-white">{h.current_value}</td>
                          <td className="py-1.5 pr-4 text-zinc-500">{h.previous_value || '—'}</td>
                          <td className={`py-1.5 tabular-nums ${h.change_pct != null ? (h.change_pct > 0 ? 'text-emerald-400' : h.change_pct < 0 ? 'text-red-400' : 'text-zinc-400') : 'text-zinc-600'}`}>
                            {h.change_pct != null ? `${h.change_pct > 0 ? '+' : ''}${h.change_pct.toFixed(1)}%` : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Section>
            )}

            {analysis.risk_factors.length > 0 && (
              <Section title={`${t('filing_risk_factors')} (${analysis.risk_factors.length})`}>
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

            {Object.keys(analysis.key_metrics).length > 0 && (
              <Section title={t('filing_key_metrics')}>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(analysis.key_metrics).map(([key, val]) => (
                    <div key={key} className="rounded bg-zinc-800/50 p-2">
                      <div className="text-xs text-zinc-500">{key.replace(/_/g, ' ')}</div>
                      <div className="text-sm font-medium text-white">{val}</div>
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {analysis.management_outlook && (
              <Section title={t('filing_management_outlook')}>
                <p className="text-justify text-sm text-zinc-400">{analysis.management_outlook}</p>
              </Section>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
