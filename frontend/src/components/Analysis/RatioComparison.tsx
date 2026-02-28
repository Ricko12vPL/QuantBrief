import { useTranslation } from 'react-i18next'
import { Target } from 'lucide-react'
import {
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Tooltip,
} from 'recharts'

interface RatioComparisonProps {
  ratios: Record<string, number>
  ticker: string
}

function normalizeRatios(ratios: Record<string, number>): { name: string; value: number; raw: number }[] {
  const entries = Object.entries(ratios)
  if (entries.length === 0) return []

  const values = entries.map(([, v]) => v)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min

  return entries.map(([name, raw]) => ({
    name: name.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
    value: range > 0 ? ((raw - min) / range) * 100 : 50,
    raw,
  }))
}

export default function RatioComparison({ ratios, ticker }: RatioComparisonProps) {
  const { t } = useTranslation()

  const ratioKeys = Object.keys(ratios)
  if (ratioKeys.length === 0) return null

  const data = normalizeRatios(ratios)

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6 backdrop-blur">
      <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-white">
        <Target className="h-5 w-5 text-[#FF7000]" />
        {ticker} {t('ratio_comparison')}
      </h3>

      <ResponsiveContainer width="100%" height={320}>
        <RadarChart cx="50%" cy="50%" outerRadius="75%" data={data}>
          <PolarGrid stroke="#3f3f46" />
          <PolarAngleAxis
            dataKey="name"
            tick={{ fill: '#a1a1aa', fontSize: 11 }}
          />
          <PolarRadiusAxis
            angle={90}
            domain={[0, 100]}
            tick={{ fill: '#52525b', fontSize: 10 }}
            axisLine={false}
          />
          <Radar
            name={ticker}
            dataKey="value"
            stroke="#FF7000"
            fill="#FF7000"
            fillOpacity={0.2}
            strokeWidth={2}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#18181b',
              border: '1px solid #3f3f46',
              borderRadius: '8px',
              color: '#e4e4e7',
              fontSize: '12px',
            }}
            // Recharts v3 formatter type workaround
            formatter={((_: unknown, __: unknown, entry: { payload: { raw: number } }) => [
              entry.payload.raw.toFixed(2),
              'Value',
            ]) as never}
          />
        </RadarChart>
      </ResponsiveContainer>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {data.map((item) => (
          <div key={item.name} className="rounded-lg bg-zinc-800/50 p-2">
            <div className="text-xs text-zinc-500">{item.name}</div>
            <div className="text-sm font-medium text-white">{item.raw.toFixed(2)}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
