import { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Play, Pause, Download, Volume2 } from 'lucide-react'

interface AudioPlayerProps {
  audioUrl: string
  script?: string
}

export default function AudioPlayer({ audioUrl, script }: AudioPlayerProps) {
  const { t } = useTranslation()
  const audioRef = useRef<HTMLAudioElement>(null)
  const [playing, setPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [speed, setSpeed] = useState(1)

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const onTimeUpdate = () => setCurrentTime(audio.currentTime)
    const onDurationChange = () => setDuration(audio.duration)
    const onEnded = () => setPlaying(false)

    audio.addEventListener('timeupdate', onTimeUpdate)
    audio.addEventListener('durationchange', onDurationChange)
    audio.addEventListener('ended', onEnded)
    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate)
      audio.removeEventListener('durationchange', onDurationChange)
      audio.removeEventListener('ended', onEnded)
    }
  }, [])

  const togglePlay = () => {
    const audio = audioRef.current
    if (!audio) return
    if (playing) {
      audio.pause()
    } else {
      audio.play()
    }
    setPlaying(!playing)
  }

  const seek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current
    if (!audio) return
    audio.currentTime = Number(e.target.value)
  }

  const cycleSpeed = () => {
    const speeds = [0.75, 1, 1.25, 1.5, 2]
    const next = speeds[(speeds.indexOf(speed) + 1) % speeds.length]
    setSpeed(next)
    if (audioRef.current) audioRef.current.playbackRate = next
  }

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60)
    const sec = Math.floor(s % 60)
    return `${m}:${sec.toString().padStart(2, '0')}`
  }

  if (!audioUrl) return null

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6 backdrop-blur">
      <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-white">
        <Volume2 className="h-5 w-5 text-[#FF7000]" />
        {t('audio_briefing')}
      </h3>
      <audio ref={audioRef} src={audioUrl} preload="metadata" />
      <div className="flex items-center gap-4">
        <button
          onClick={togglePlay}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-[#FF7000] text-white transition hover:bg-[#FF7000]/80"
        >
          {playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 ml-0.5" />}
        </button>
        <div className="flex-1">
          <input
            type="range"
            min="0"
            max={duration || 0}
            value={currentTime}
            onChange={seek}
            className="w-full accent-[#FF7000]"
          />
          <div className="mt-1 flex justify-between text-xs text-zinc-500">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>
        <button
          onClick={cycleSpeed}
          className="rounded bg-zinc-800 px-2 py-1 text-xs font-medium text-zinc-400 transition hover:text-white"
        >
          {speed}x
        </button>
        <a
          href={audioUrl}
          download
          className="flex h-8 w-8 items-center justify-center rounded bg-zinc-800 text-zinc-400 transition hover:text-white"
        >
          <Download className="h-4 w-4" />
        </a>
      </div>

      {script && (
        <div className="mt-4 max-h-48 overflow-y-auto rounded-lg bg-zinc-800/50 p-4">
          <p className="text-sm leading-relaxed text-zinc-400 whitespace-pre-wrap">{script}</p>
        </div>
      )}
    </div>
  )
}
