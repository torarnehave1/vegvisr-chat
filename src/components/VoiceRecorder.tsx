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

export function VoiceRecorder({ onSend }: Props) {
  const { recording, start, stop, cancel } = useVoiceRecorder()
  const [elapsed, setElapsed] = useState(0)
  const [error, setError] = useState('')
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

  const handleStart = async () => {
    setError('')
    try {
      await start()
    } catch {
      setError('Microphone access denied')
    }
  }

  const handleStop = async () => {
    try {
      const rec = await stop()
      onSend(rec)
    } catch {
      setError('Recording failed')
    }
  }

  if (recording) {
    return (
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 text-rose-400 text-sm">
          <span className="inline-block h-2 w-2 rounded-full bg-rose-500 animate-pulse" />
          {formatTimer(elapsed)}
        </div>
        <button
          type="button"
          onClick={cancel}
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
          title="Send voice message"
        >
          <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
            <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
          </svg>
        </button>
      </div>
    )
  }

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
