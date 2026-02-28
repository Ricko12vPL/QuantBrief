interface SentimentGaugeProps {
  value: number // -1 to +1
  label?: string
  size?: number
}

export default function SentimentGauge({ value, label, size = 120 }: SentimentGaugeProps) {
  const normalized = Math.min(0.99, Math.max(0.01, (value + 1) / 2)) // clamped to [0.01, 0.99] to prevent empty/full arc
  const r = size / 2 - 10
  const cx = size / 2
  const cy = size / 2

  const color = value > 0.2 ? '#34d399' : value < -0.2 ? '#f87171' : '#facc15'

  return (
    <div className="flex flex-col items-center">
      <svg width={size} height={size / 2 + 20} viewBox={`0 0 ${size} ${size / 2 + 20}`}>
        {/* Background arc */}
        <path
          d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
          fill="none"
          stroke="#27272a"
          strokeWidth="8"
          strokeLinecap="round"
        />
        {/* Value arc */}
        <path
          d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r * Math.cos((Math.PI * (180 - normalized * 180)) / 180)} ${cy - r * Math.sin((Math.PI * (180 - normalized * 180)) / 180)}`}
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeLinecap="round"
        />
        {/* Needle */}
        <line
          x1={cx}
          y1={cy}
          x2={cx + (r - 15) * Math.cos((Math.PI * (180 - normalized * 180)) / 180)}
          y2={cy - (r - 15) * Math.sin((Math.PI * (180 - normalized * 180)) / 180)}
          stroke="white"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <circle cx={cx} cy={cy} r="4" fill="white" />
        {/* Value text */}
        <text x={cx} y={cy + 16} textAnchor="middle" className="fill-white text-sm font-bold">
          {value > 0 ? '+' : ''}{value.toFixed(2)}
        </text>
      </svg>
      {label && <span className="mt-1 text-xs text-zinc-500">{label}</span>}
    </div>
  )
}
