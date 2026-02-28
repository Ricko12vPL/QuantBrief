import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { LineChart, Loader2 } from 'lucide-react'
import { createChart, ColorType } from 'lightweight-charts'
import type { IChartApi, ISeriesApi, CandlestickData, LineData, HistogramData, Time } from 'lightweight-charts'
import { api } from '../../lib/api'

interface PriceChartProps {
  ticker: string
}

interface Candle {
  date: number
  open: number
  high: number
  low: number
  close: number
  volume: number
}

type IntervalKey = '1D' | '1W' | '1M' | '3M'
type ChartMode = 'candle' | 'line'

const INTERVAL_CONFIG: Record<IntervalKey, { resolution: string; days: number }> = {
  '1D': { resolution: '60', days: 1 },
  '1W': { resolution: 'D', days: 7 },
  '1M': { resolution: 'D', days: 30 },
  '3M': { resolution: 'D', days: 90 },
}

function toChartTime(ts: number): Time {
  return ts as Time
}

export default function PriceChart({ ticker }: PriceChartProps) {
  const { t } = useTranslation()
  const chartContainerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null)
  const lineSeriesRef = useRef<ISeriesApi<'Line'> | null>(null)
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null)

  const [interval, setInterval] = useState<IntervalKey>('1M')
  const [mode, setMode] = useState<ChartMode>('candle')
  const [candles, setCandles] = useState<Candle[]>([])
  const [loading, setLoading] = useState(true)
  const [priceChange, setPriceChange] = useState({ value: 0, percent: 0, current: 0 })

  // Fetch candle data
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    const config = INTERVAL_CONFIG[interval]
    api.market
      .getCandles(ticker, config.resolution, config.days)
      .then((data) => {
        if (cancelled) return
        setCandles(data.candles || [])
        const c = data.candles || []
        if (c.length >= 2) {
          const first = c[0].close
          const last = c[c.length - 1].close
          const change = last - first
          setPriceChange({
            value: change,
            percent: first !== 0 ? (change / first) * 100 : 0,
            current: last,
          })
        } else if (c.length === 1) {
          setPriceChange({ value: 0, percent: 0, current: c[0].close })
        }
        setLoading(false)
      })
      .catch(() => {
        if (!cancelled) {
          setCandles([])
          setLoading(false)
        }
      })
    return () => { cancelled = true }
  }, [ticker, interval])

  // Create/update chart
  useEffect(() => {
    if (!chartContainerRef.current || candles.length === 0) return

    // Destroy previous chart
    if (chartRef.current) {
      chartRef.current.remove()
      chartRef.current = null
      candleSeriesRef.current = null
      lineSeriesRef.current = null
      volumeSeriesRef.current = null
    }

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#a1a1aa',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        fontSize: 11,
      },
      grid: {
        vertLines: { color: '#27272a' },
        horzLines: { color: '#27272a' },
      },
      crosshair: {
        mode: 0,
      },
      rightPriceScale: {
        borderColor: '#3f3f46',
      },
      timeScale: {
        borderColor: '#3f3f46',
        timeVisible: interval === '1D',
        secondsVisible: false,
      },
      width: chartContainerRef.current.clientWidth,
      height: 300,
    })
    chartRef.current = chart

    // Volume series (always shown)
    const volumeSeries = chart.addHistogramSeries({
      color: '#FF7000',
      priceFormat: { type: 'volume' },
      priceScaleId: 'volume',
    })
    chart.priceScale('volume').applyOptions({
      scaleMargins: { top: 0.8, bottom: 0 },
    })
    volumeSeriesRef.current = volumeSeries

    const volumeData: HistogramData[] = candles.map((c) => ({
      time: toChartTime(c.date),
      value: c.volume,
      color: c.close >= c.open ? 'rgba(255, 112, 0, 0.3)' : 'rgba(239, 68, 68, 0.3)',
    }))
    volumeSeries.setData(volumeData)

    if (mode === 'candle') {
      const candleSeries = chart.addCandlestickSeries({
        upColor: '#FF7000',
        downColor: '#ef4444',
        borderUpColor: '#FF7000',
        borderDownColor: '#ef4444',
        wickUpColor: '#FF7000',
        wickDownColor: '#ef4444',
      })
      const candleData: CandlestickData[] = candles.map((c) => ({
        time: toChartTime(c.date),
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      }))
      candleSeries.setData(candleData)
      candleSeriesRef.current = candleSeries
    } else {
      const lineSeries = chart.addLineSeries({
        color: '#FF7000',
        lineWidth: 2,
        crosshairMarkerRadius: 4,
        crosshairMarkerBorderColor: '#18181b',
        crosshairMarkerBackgroundColor: '#FF7000',
      })
      const lineData: LineData[] = candles.map((c) => ({
        time: toChartTime(c.date),
        value: c.close,
      }))
      lineSeries.setData(lineData)
      lineSeriesRef.current = lineSeries
    }

    chart.timeScale().fitContent()

    // Resize handler
    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({ width: chartContainerRef.current.clientWidth })
      }
    }
    const observer = new ResizeObserver(handleResize)
    observer.observe(chartContainerRef.current)

    return () => {
      observer.disconnect()
      if (chartRef.current) {
        chartRef.current.remove()
        chartRef.current = null
      }
    }
  }, [candles, mode, interval])

  const changeColor = priceChange.value >= 0 ? 'text-emerald-400' : 'text-red-400'

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6 backdrop-blur">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-lg font-semibold text-white">
          <LineChart className="h-5 w-5 text-[#FF7000]" />
          {ticker} {t('price_chart')}
        </h3>
        {!loading && candles.length > 0 && (
          <div className="flex items-center gap-2 text-sm">
            <span className="font-medium text-white">
              ${priceChange.current.toFixed(2)}
            </span>
            <span className={`font-medium ${changeColor}`}>
              {priceChange.value >= 0 ? '+' : ''}${priceChange.value.toFixed(2)} ({priceChange.percent >= 0 ? '+' : ''}{priceChange.percent.toFixed(2)}%)
            </span>
          </div>
        )}
      </div>

      {/* Toolbar */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex gap-1">
          {(['1D', '1W', '1M', '3M'] as IntervalKey[]).map((key) => (
            <button
              key={key}
              onClick={() => setInterval(key)}
              className={`rounded px-2.5 py-1 text-xs font-medium transition ${
                interval === key
                  ? 'bg-[#FF7000] text-white'
                  : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'
              }`}
            >
              {t(`interval_${key.toLowerCase()}`)}
            </button>
          ))}
        </div>
        <div className="flex gap-1">
          {(['candle', 'line'] as ChartMode[]).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`rounded px-2.5 py-1 text-xs font-medium transition ${
                mode === m
                  ? 'bg-zinc-700 text-white'
                  : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'
              }`}
            >
              {t(m)}
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
      {loading ? (
        <div className="flex h-[300px] items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-[#FF7000]" />
        </div>
      ) : candles.length === 0 ? (
        <div className="flex h-[300px] items-center justify-center text-sm text-zinc-500">
          No data available
        </div>
      ) : (
        <div ref={chartContainerRef} />
      )}
    </div>
  )
}
