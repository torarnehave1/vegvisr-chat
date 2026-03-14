import { useEffect, useRef, useState } from 'react'
import { useVoiceRecorder } from '../hooks/useVoiceRecorder'
import type { VoiceRecording } from '../hooks/useVoiceRecorder'

interface Props {
  onSend: (recording: VoiceRecording) => void
}

function formatTimer(ms: number) {
  const totalSec = Math.floor(ms / 1000)
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

/** Draws a live waveform from an AnalyserNode onto a canvas */
function LiveWaveform({ analyser }: { analyser: AnalyserNode | null }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef<number>(0)

  useEffect(() => {
    if (!analyser || !canvasRef.current) return
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const bufferLength = analyser.frequencyBinCount
    const dataArray = new Uint8Array(bufferLength)

    const draw = () => {
      rafRef.current = requestAnimationFrame(draw)
      analyser.getByteTimeDomainData(dataArray)

      const w = canvas.width
      const h = canvas.height
      ctx.clearRect(0, 0, w, h)

      ctx.lineWidth = 2
      ctx.strokeStyle = '#38bdf8'
      ctx.beginPath()

      const sliceWidth = w / bufferLength
      let x = 0
      for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i] / 128.0
        const y = (v * h) / 2
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
        x += sliceWidth
      }
      ctx.lineTo(w, h / 2)
      ctx.stroke()
    }

    draw()
    return () => cancelAnimationFrame(rafRef.current)
  }, [analyser])

  return (
    <canvas
      ref={canvasRef}
      width={160}
      height={32}
      className="rounded bg-white/5"
    />
  )
}

/** Draws a static waveform from an AudioBuffer for preview */
function StaticWaveform({ audioUrl }: { audioUrl: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (!audioUrl || !canvasRef.current) return
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    fetch(audioUrl)
      .then((r) => r.arrayBuffer())
      .then((buf) => new AudioContext().decodeAudioData(buf))
      .then((audioBuffer) => {
        const raw = audioBuffer.getChannelData(0)
        const w = canvas.width
        const h = canvas.height
        ctx.clearRect(0, 0, w, h)

        const step = Math.ceil(raw.length / w)
        ctx.fillStyle = '#38bdf8'
        for (let i = 0; i < w; i++) {
          let min = 1.0,
            max = -1.0
          for (let j = 0; j < step; j++) {
            const val = raw[i * step + j] ?? 0
            if (val < min) min = val
            if (val > max) max = val
          }
          const barH = Math.max(((max - min) * h) / 2, 1)
          ctx.fillRect(i, (h - barH) / 2, 1, barH)
        }
      })
      .catch(() => {})
  }, [audioUrl])

  return (
    <canvas
      ref={canvasRef}
      width={200}
      height={32}
      className="rounded bg-white/5"
    />
  )
}

export function VoiceRecorder({ onSend }: Props) {
  const { recording, start, stop, cancel } = useVoiceRecorder()
  const [elapsed, setElapsed] = useState(0)
  const [error, setError] = useState('')
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null)
  const [preview, setPreview] = useState<{
    blob: Blob
    durationMs: number
    mimeType: string
    url: string
  } | null>(null)
  const [title, setTitle] = useState('')
  const timerRef = useRef<ReturnType<typeof setInterval>>(undefined)

  useEffect(() => {
    if (recording) {
      setElapsed(0)
      timerRef.current = setInterval(() => setElapsed((p) => p + 1000), 1000)
    } else {
      clearInterval(timerRef.current)
    }
    return () => clearInterval(timerRef.current)
  }, [recording])

  useEffect(() => {
    return () => {
      if (preview?.url) URL.revokeObjectURL(preview.url)
    }
  }, [preview?.url])

  const handleStart = async () => {
    setError('')
    setPreview(null)
    setTitle('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })

      const audioCtx = new AudioContext()
      const source = audioCtx.createMediaStreamSource(stream)
      const node = audioCtx.createAnalyser()
      node.fftSize = 256
      source.connect(node)
      setAnalyser(node)

      await start(stream)
    } catch {
      setError('Microphone access denied')
    }
  }

  const handleStop = async () => {
    try {
      const rec = await stop()
      setAnalyser(null)
      const url = URL.createObjectURL(rec.blob)
      setPreview({ blob: rec.blob, durationMs: rec.durationMs, mimeType: rec.mimeType, url })
    } catch {
      setError('Recording failed')
    }
  }

  const handleCancel = () => {
    cancel()
    setAnalyser(null)
    if (preview?.url) URL.revokeObjectURL(preview.url)
    setPreview(null)
    setTitle('')
  }

  const handleSend = () => {
    if (!preview || !title.trim()) return
    onSend({
      blob: preview.blob,
      durationMs: preview.durationMs,
      mimeType: preview.mimeType,
      title: title.trim(),
    })
    URL.revokeObjectURL(preview.url)
    setPreview(null)
    setTitle('')
  }

  // Preview state — title input + waveform + send
  if (preview) {
    return (
      <div className="flex flex-col gap-2 w-full">
        <div className="flex items-center gap-2">
          <StaticWaveform audioUrl={preview.url} />
          <span className="text-[11px] text-white/50">{formatTimer(preview.durationMs)}</span>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && title.trim()) handleSend() }}
            placeholder="Subject (required)"
            autoFocus
            className="flex-1 rounded-xl border border-white/10 bg-slate-900/60 px-3 py-1.5 text-sm text-white placeholder:text-white/40 focus:outline-none focus:ring-1 focus:ring-sky-500/60"
          />
          <button
            type="button"
            onClick={handleCancel}
            className="rounded-full p-1.5 text-white/50 hover:text-white/80 hover:bg-white/10"
            title="Discard"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <button
            type="button"
            onClick={handleSend}
            disabled={!title.trim()}
            className="rounded-full bg-emerald-500 p-1.5 text-white hover:bg-emerald-400 disabled:opacity-30 disabled:cursor-not-allowed"
            title="Send voice message"
          >
            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
            </svg>
          </button>
        </div>
      </div>
    )
  }

  // Recording state — live waveform + timer
  if (recording) {
    return (
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 text-rose-400 text-sm">
          <span className="inline-block h-2 w-2 rounded-full bg-rose-500 animate-pulse" />
          {formatTimer(elapsed)}
        </div>
        <LiveWaveform analyser={analyser} />
        <button
          type="button"
          onClick={handleCancel}
          className="rounded-full p-2 text-white/50 hover:text-white/80 hover:bg-white/10"
          title="Cancel"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        <button
          type="button"
          onClick={handleStop}
          className="rounded-full bg-emerald-500 p-2 text-white hover:bg-emerald-400"
          title="Stop recording"
        >
          <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
            <rect x="4" y="4" width="12" height="12" rx="2" />
          </svg>
        </button>
      </div>
    )
  }

  // Idle state — mic button
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={handleStart}
        className="rounded-full p-2 text-white/50 hover:text-white/80 hover:bg-white/10"
        title="Record voice message"
      >
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-14 0M12 19v2m-3-2h6M12 3a3 3 0 00-3 3v4a3 3 0 006 0V6a3 3 0 00-3-3z" />
        </svg>
      </button>
      {error && <span className="text-xs text-rose-400">{error}</span>}
    </div>
  )
}
