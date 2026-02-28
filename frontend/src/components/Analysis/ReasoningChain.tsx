import { useTranslation } from 'react-i18next'
import { Brain, Database, Globe, GitBranch, Shield, Target, CheckCircle } from 'lucide-react'

interface ReasoningStep {
  stage: string
  content: string
}

interface ReasoningChainProps {
  steps: ReasoningStep[]
}

const stageConfig: Record<string, { icon: typeof Database; labelKey: string; color: string }> = {
  DATA: { icon: Database, labelKey: 'reasoning_data_points', color: 'text-blue-400 bg-blue-400/10 border-blue-400/20' },
  CONTEXT: { icon: Globe, labelKey: 'reasoning_market_context', color: 'text-purple-400 bg-purple-400/10 border-purple-400/20' },
  CROSS_SIGNALS: { icon: GitBranch, labelKey: 'reasoning_cross_signals', color: 'text-cyan-400 bg-cyan-400/10 border-cyan-400/20' },
  RISK: { icon: Shield, labelKey: 'reasoning_risk_assessment', color: 'text-red-400 bg-red-400/10 border-red-400/20' },
  CONFIDENCE: { icon: Target, labelKey: 'reasoning_confidence_level', color: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20' },
  RECOMMENDATION: { icon: CheckCircle, labelKey: 'reasoning_recommendations', color: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20' },
}

export default function ReasoningChain({ steps }: ReasoningChainProps) {
  const { t } = useTranslation()

  if (!steps.length) return null

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6 backdrop-blur">
      <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-white">
        <Brain className="h-5 w-5 text-[#FF7000]" />
        {t('reasoning_chain')}
      </h3>
      <div className="space-y-3">
        {steps.map((step, i) => {
          const config = stageConfig[step.stage] || stageConfig.DATA
          const Icon = config.icon
          return (
            <div key={i} className={`rounded-lg border p-4 ${config.color}`}>
              <div className="mb-2 flex items-center gap-2">
                <Icon className="h-4 w-4" />
                <span className="text-sm font-semibold">{t(config.labelKey)}</span>
                <span className="text-xs opacity-50">{t('reasoning_step')} {i + 1}/{steps.length}</span>
              </div>
              <p className="text-sm leading-relaxed opacity-90 whitespace-pre-wrap">{step.content}</p>
            </div>
          )
        })}
      </div>
    </div>
  )
}
