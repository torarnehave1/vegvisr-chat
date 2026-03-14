import { useCallback, useRef, useState } from 'react'

export interface RawRecording {
  blob: Blob
  durationMs: number
  mimeType: string
}

export interface VoiceRecording extends RawRecording {
  title: string
}

export function useVoiceRecorder() {
  const [recording, setRecording] = useState(false)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const startTimeRef = useRef(0)

  const start = useCallback(async (existingStream?: MediaStream) => {
    const stream = existingStream || await navigator.mediaDevices.getUserMedia({ audio: true })

    // Prefer webm/opus, fall back to mp4 (Safari)
    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : MediaRecorder.isTypeSupported('audio/mp4')
        ? 'audio/mp4'
        : ''

    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
    chunksRef.current = []

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data)
    }

    recorderRef.current = recorder
    startTimeRef.current = Date.now()
    recorder.start(250) // collect chunks every 250ms
    setRecording(true)
  }, [])

  const stop = useCallback((): Promise<RawRecording> => {
    return new Promise((resolve, reject) => {
      const recorder = recorderRef.current
      if (!recorder || recorder.state === 'inactive') {
        reject(new Error('Not recording'))
        return
      }

      recorder.onstop = () => {
        const durationMs = Date.now() - startTimeRef.current
        const mimeType = recorder.mimeType || 'audio/webm'
        const blob = new Blob(chunksRef.current, { type: mimeType })

        // Stop all tracks to release microphone
        recorder.stream.getTracks().forEach((t) => t.stop())
        recorderRef.current = null
        chunksRef.current = []
        setRecording(false)

        resolve({ blob, durationMs, mimeType })
      }

      recorder.onerror = () => {
        recorder.stream.getTracks().forEach((t) => t.stop())
        recorderRef.current = null
        setRecording(false)
        reject(new Error('Recording failed'))
      }

      recorder.stop()
    })
  }, [])

  const cancel = useCallback(() => {
    const recorder = recorderRef.current
    if (recorder && recorder.state !== 'inactive') {
      recorder.stream.getTracks().forEach((t) => t.stop())
      recorder.stop()
    }
    recorderRef.current = null
    chunksRef.current = []
    setRecording(false)
  }, [])

  return { recording, start, stop, cancel }
}
