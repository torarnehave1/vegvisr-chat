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

    // Prefer AAC-in-MP4, then plain MP4, then webm/opus.
    //
    // The order matters beyond file size: Instagram DMs relayed from a chat
    // group accept AAC/M4A/WAV/MP4 for audio and reject webm (webm is fine for
    // video, not for audio). Chromium and Safari both record audio/mp4, so this
    // ordering makes voice messages relayable from those browsers; Firefox has
    // no mp4 audio recording and still yields webm, which the relay refuses with
    // an explanation rather than letting Meta reject it opaquely.
    const preferred = [
      'audio/mp4;codecs=mp4a.40.2',
      'audio/mp4',
      'audio/webm;codecs=opus',
      'audio/webm',
    ]
    const mimeType = preferred.find(t => MediaRecorder.isTypeSupported(t)) || ''

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
