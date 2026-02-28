import { useTranslation } from 'react-i18next'
import { Search, FileSearch, Brain, Sparkles, Volume2, CheckCircle } from 'lucide-react'

interface AgentStatusBarProps {
  currentStage: string
}

const stages = [
  { key: 'screening', icon: Search, label: 'pipeline_screening' },
  { key: 'analyzing', icon: FileSearch, label: 'pipeline_analyzing' },
  { key: 'reasoning', icon: Brain, label: 'pipeline_reasoning' },
  { key: 'synthesizing', icon: Sparkles, label: 'pipeline_synthesizing' },
  { key: 'voice', icon: Volume2, label: 'pipeline_voice' },
  { key: 'done', icon: CheckCircle, label: 'pipeline_done' },
]

export default function AgentStatusBar({ currentStage }: AgentStatusBarProps) {
  const { t } = useTranslation()

  if (!currentStage) return null

  const currentIdx = stages.findIndex((s) => s.key === currentStage)

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 backdrop-blur">
      <div className="flex items-center justify-between">
        {stages.map((stage, i) => {
          const Icon = stage.icon
          const isActive = stage.key === currentStage
          const isDone = i < currentIdx
          return (
            <div key={stage.key} className="flex items-center">
              <div className="flex flex-col items-center gap-1">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full transition-all ${
                    isActive
                      ? 'bg-[#FF7000] text-white animate-pulse'
                      : isDone
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : 'bg-zinc-800 text-zinc-600'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                </div>
                <span
                  className={`text-xs ${
                    isActive ? 'text-[#FF7000] font-medium' : isDone ? 'text-emerald-400' : 'text-zinc-600'
                  }`}
                >
                  {t(stage.label).split(' ')[0]}
                </span>
              </div>
              {i < stages.length - 1 && (
                <div
                  className={`mx-2 h-0.5 w-8 sm:w-12 ${
                    isDone ? 'bg-emerald-500/30' : 'bg-zinc-800'
                  }`}
                />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
