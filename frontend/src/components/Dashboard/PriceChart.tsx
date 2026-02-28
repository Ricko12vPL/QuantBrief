import { useTranslation } from 'react-i18next'
import { LineChart } from 'lucide-react'
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts'

interface PricePoint {
  date: string
  close: number
  volume?: number
}

interface PriceChartProps {
  prices: PricePoint[]
  ticker: string
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return `${d.getMonth() + 1}/${d.getDate()}`
}

function formatPrice(value: number): string {
  return `$${value.toFixed(2)}`
}

function formatVolume(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `${(value / 1_000).toFixed(0)}K`
  return String(value)
}

export default function PriceChart({ prices, ticker }: PriceChartProps) {
  const { t } = useTranslation()

  if (!prices.length) return null

  const hasVolume = prices.some((p) => p.volume != null && p.volume > 0)
  const minPrice = Math.min(...prices.map((p) => p.close))
  const maxPrice = Math.max(...prices.map((p) => p.close))
  const pricePadding = (maxPrice - minPrice) * 0.05
  const priceChange = prices.length >= 2
    ? prices[prices.length - 1].close - prices[0].close
    : 0
  const priceChangePercent = prices.length >= 2
    ? ((priceChange / prices[0].close) * 100)
    : 0
  const changeColor = priceChange >= 0 ? 'text-emerald-400' : 'text-red-400'

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6 backdrop-blur">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-lg font-semibold text-white">
          <LineChart className="h-5 w-5 text-[#FF7000]" />
          {ticker} {t('price_chart')}
        </h3>
        <div className="flex items-center gap-2 text-sm">
          <span className="font-medium text-white">
            {formatPrice(prices[prices.length - 1].close)}
          </span>
          <span className={`font-medium ${changeColor}`}>
            {priceChange >= 0 ? '+' : ''}{formatPrice(priceChange)} ({priceChangePercent >= 0 ? '+' : ''}{priceChangePercent.toFixed(2)}%)
          </span>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={hasVolume ? 280 : 220}>
        <ComposedChart data={prices} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
          <XAxis
            dataKey="date"
            tickFormatter={formatDate}
            tick={{ fill: '#71717a', fontSize: 11 }}
            axisLine={{ stroke: '#3f3f46' }}
            tickLine={false}
          />
          <YAxis
            yAxisId="price"
            domain={[minPrice - pricePadding, maxPrice + pricePadding]}
            tickFormatter={formatPrice}
            tick={{ fill: '#71717a', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={70}
          />
          {hasVolume && (
            <YAxis
              yAxisId="volume"
              orientation="right"
              tickFormatter={formatVolume}
              tick={{ fill: '#52525b', fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              width={50}
            />
          )}
          <Tooltip
            contentStyle={{
              backgroundColor: '#18181b',
              border: '1px solid #3f3f46',
              borderRadius: '8px',
              color: '#e4e4e7',
              fontSize: '12px',
            }}
            labelFormatter={(label: unknown) => new Date(String(label)).toLocaleDateString()}
            formatter={((value: unknown, name: unknown) => {
              const v = Number(value) || 0
              if (name === 'close') return [formatPrice(v), 'Price']
              if (name === 'volume') return [formatVolume(v), 'Volume']
              return [v, String(name)]
            }) as never}
          />
          {hasVolume && (
            <Bar
              yAxisId="volume"
              dataKey="volume"
              fill="#FF7000"
              opacity={0.15}
              radius={[2, 2, 0, 0]}
            />
          )}
          <Line
            yAxisId="price"
            type="monotone"
            dataKey="close"
            stroke="#FF7000"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: '#FF7000', stroke: '#18181b', strokeWidth: 2 }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
