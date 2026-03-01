import { Zap, Filter, FileSearch, Brain, Headphones } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../stores/authStore'

const features = [
  { icon: Filter, titleKey: 'feature_screening', descKey: 'feature_screening_desc', model: 'Ministral 3B' },
  { icon: FileSearch, titleKey: 'feature_analysis', descKey: 'feature_analysis_desc', model: 'Mistral Large 3' },
  { icon: Brain, titleKey: 'feature_risk', descKey: 'feature_risk_desc', model: 'Magistral' },
  { icon: Headphones, titleKey: 'feature_audio', descKey: 'feature_audio_desc', model: 'ElevenLabs' },
]

export default function Hero() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const token = useAuthStore((s) => s.token)

  const handleGetStarted = () => {
    navigate(token ? '/dashboard' : '/register')
  }

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-zinc-950 px-4">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-1/3 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-orange-500/10 blur-[120px]" />
        <div className="absolute bottom-1/4 right-1/4 h-[400px] w-[400px] rounded-full bg-orange-600/5 blur-[100px]" />
      </div>

      <div className="relative z-10 mx-auto max-w-4xl text-center">
        <div className="mb-8 flex items-center justify-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 shadow-lg shadow-orange-500/20">
            <Zap className="h-6 w-6 text-white" />
          </div>
          <span className="text-3xl font-bold text-white">QuantBrief</span>
        </div>

        <h1 className="mb-6 text-5xl font-bold leading-tight tracking-tight text-white sm:text-6xl lg:text-7xl">
          {t('hero_headline_prefix', 'AI-Powered')}{' '}
          <span className="bg-gradient-to-r from-orange-400 to-orange-200 bg-clip-text text-transparent">
            {t('hero_headline_gradient', 'Market Intelligence')}
          </span>
        </h1>

        <p className="mx-auto mb-10 max-w-2xl text-lg text-zinc-400 sm:text-xl">
          {t('hero_subtitle', 'Multi-agent pipeline that screens news, analyzes SEC filings with 256K context, reasons about portfolio impact, and delivers audio briefings in 5 languages.')}
        </p>

        <button
          onClick={handleGetStarted}
          className="group inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-orange-500 to-orange-600 px-8 py-4 text-lg font-semibold text-white shadow-lg shadow-orange-500/25 transition-all hover:shadow-orange-500/40 hover:brightness-110"
        >
          <Zap className="h-5 w-5 transition-transform group-hover:scale-110" />
          {t('get_started', 'Get Started')}
        </button>
      </div>

      <div className="relative z-10 mx-auto mt-20 grid max-w-5xl gap-4 px-4 sm:grid-cols-2 lg:grid-cols-4">
        {features.map((f) => (
          <div
            key={f.titleKey}
            className="group rounded-xl border border-zinc-800 bg-zinc-900/50 p-6 backdrop-blur transition-all hover:border-orange-500/30 hover:shadow-lg hover:shadow-orange-500/5"
          >
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-orange-500/10">
              <f.icon className="h-5 w-5 text-orange-400" />
            </div>
            <h3 className="mb-1 font-semibold text-white">{t(f.titleKey)}</h3>
            <p className="mb-3 text-sm text-zinc-400">{t(f.descKey)}</p>
            <span className="inline-block rounded-full bg-zinc-800 px-2 py-0.5 text-xs text-zinc-500">
              {f.model}
            </span>
          </div>
        ))}
      </div>

      <p className="relative z-10 mt-16 pb-8 text-sm text-zinc-600">
        Built for Mistral AI Worldwide Hackathon 2026
      </p>
    </div>
  )
}
