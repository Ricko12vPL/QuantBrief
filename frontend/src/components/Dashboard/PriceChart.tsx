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
  '1D': { resolution: '5', days: 1 },
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
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [priceChange, setPriceChange] = useState({ value: 0, percent: 0, current: 0 })

  function generateMockCandles(days: number): Candle[] {
    const candles: Candle[] = []
    const now = Math.floor(Date.now() / 1000)
    let price = 150 + Math.random() * 50
    const intervals = Math.min(days * 8, 200)
    const step = (days * 86400) / intervals
    for (let i = 0; i < intervals; i++) {
      const open = price
      const change = (Math.random() - 0.48) * 3
      const close = open + change
      const high = Math.max(open, close) + Math.random() * 2
      const low = Math.min(open, close) - Math.random() * 2
      const volume = Math.floor(1000000 + Math.random() * 5000000)
      candles.push({
        date: now - (intervals - i) * step,
        open: parseFloat(open.toFixed(2)),
        high: parseFloat(high.toFixed(2)),
        low: parseFloat(low.toFixed(2)),
        close: parseFloat(close.toFixed(2)),
        volume,
      })
      price = close
    }
    return candles
  }

  const [prevTicker, setPrevTicker] = useState(ticker)
  const [prevInterval, setPrevInterval] = useState(interval)
  if (ticker !== prevTicker || interval !== prevInterval) {
    setPrevTicker(ticker)
    setPrevInterval(interval)
    setLoading(true)
  }

  // Fetch candle data
  useEffect(() => {
    let cancelled = false
    const config = INTERVAL_CONFIG[interval]
    api.market
      .getCandles(ticker, config.resolution, config.days)
      .then((data) => {
        if (cancelled) return
        const c = data.candles || []
        let usable: Candle[]
        if (c.length > 0) {
          usable = c
          setErrorMsg(null)
        } else {
          usable = generateMockCandles(config.days)
          setErrorMsg(data.error || t('demo_data'))
        }
        setCandles(usable)
        if (usable.length >= 2) {
          const first = usable[0].close
          const last = usable[usable.length - 1].close
          const change = last - first
          setPriceChange({
            value: change,
            percent: first !== 0 ? (change / first) * 100 : 0,
            current: last,
          })
        } else if (usable.length === 1) {
          setPriceChange({ value: 0, percent: 0, current: usable[0].close })
        }
        setLoading(false)
      })
      .catch(() => {
        if (!cancelled) {
          const mock = generateMockCandles(config.days)
          setCandles(mock)
          setErrorMsg(t('demo_data'))
          if (mock.length >= 2) {
            const first = mock[0].close
            const last = mock[mock.length - 1].close
            const change = last - first
            setPriceChange({
              value: change,
              percent: first !== 0 ? (change / first) * 100 : 0,
              current: last,
            })
          }
          setLoading(false)
        }
      })
    return () => { cancelled = true }
  }, [ticker, interval, t])

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
    <div className="glass-card p-6">
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

      {errorMsg && (
        <div className="mb-3 rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-400">
          {errorMsg}
        </div>
      )}

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
