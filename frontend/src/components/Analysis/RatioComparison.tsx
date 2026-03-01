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

// Keys excluded from radar — absolute dollar values break the scale
const RADAR_EXCLUDE_KEYS = new Set(['market_cap', 'revenue_ttm'])

// Typical benchmark ranges for per-metric normalization.
// Each metric maps raw value -> 0-100 independently, clamped at 100.
const METRIC_BENCHMARKS: Record<string, number> = {
  pe_ratio: 50,
  pb_ratio: 10,
  debt_to_equity: 200,
  roe: 0.5,
  ev_ebitda: 40,
  profit_margin: 0.5,
  operating_margin: 0.5,
  gross_margin: 1,
  revenue_growth_yoy: 1,
  eps: 15,
  fcf_yield: 0.15,
  dividend_yield: 0.06,
  beta: 3,
  current_ratio: 4,
}

function formatLargeNumber(value: number): string {
  const abs = Math.abs(value)
  if (abs >= 1e12) return `${(value / 1e12).toFixed(1)}T`
  if (abs >= 1e9) return `${(value / 1e9).toFixed(1)}B`
  if (abs >= 1e6) return `${(value / 1e6).toFixed(1)}M`
  if (abs >= 1e3) return `${(value / 1e3).toFixed(1)}K`
  return value.toFixed(2)
}

function formatDisplayName(key: string): string {
  return key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

interface RatioEntry {
  name: string
  key: string
  value: number
  raw: number
}

function normalizeRatios(ratios: Record<string, number>, excludeKeys: Set<string>): RatioEntry[] {
  const entries = Object.entries(ratios).filter(([k]) => !excludeKeys.has(k))
  if (entries.length === 0) return []

  return entries.map(([key, raw]) => {
    const benchmark = METRIC_BENCHMARKS[key]
    let value: number
    if (benchmark !== undefined) {
      value = Math.min((Math.abs(raw) / benchmark) * 100, 100)
    } else {
      // Unknown metric: use a reasonable default (assume 0-100 scale)
      value = Math.min(Math.abs(raw), 100)
    }
    return { name: formatDisplayName(key), key, value, raw }
  })
}

function allRatioEntries(ratios: Record<string, number>): { name: string; key: string; raw: number }[] {
  return Object.entries(ratios).map(([key, raw]) => ({
    name: formatDisplayName(key),
    key,
    raw,
  }))
}

export default function RatioComparison({ ratios, ticker }: RatioComparisonProps) {
  const { t } = useTranslation()

  const ratioKeys = Object.keys(ratios)
  if (ratioKeys.length === 0) return null

  const radarData = normalizeRatios(ratios, RADAR_EXCLUDE_KEYS)
  const gridData = allRatioEntries(ratios)

  return (
    <div className="glass-card p-6">
      <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-white">
        <Target className="h-5 w-5 text-[#FF7000]" />
        {ticker} {t('ratio_comparison')}
      </h3>

      {radarData.length > 0 && (
        <ResponsiveContainer width="100%" height={320}>
          <RadarChart cx="50%" cy="50%" outerRadius="75%" data={radarData}>
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
                formatLargeNumber(entry.payload.raw),
                'Value',
              ]) as never}
            />
          </RadarChart>
        </ResponsiveContainer>
      )}

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {gridData.map((item) => (
          <div key={item.key} className="rounded-lg bg-zinc-800/50 p-2">
            <div className="text-xs text-zinc-500">{item.name}</div>
            <div className="text-sm font-medium tabular-nums text-white">
              {RADAR_EXCLUDE_KEYS.has(item.key) ? formatLargeNumber(item.raw) : item.raw.toFixed(2)}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
