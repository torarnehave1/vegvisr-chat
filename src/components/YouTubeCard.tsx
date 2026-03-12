import { useState } from 'react'

interface Props {
  videoId: string
  url: string
}

export function YouTubeCard({ videoId, url }: Props) {
  const [showPlayer, setShowPlayer] = useState(false)
  const [transcribing, setTranscribing] = useState(false)
  const [transcript, setTranscript] = useState<string | null>(null)
  const [transcriptError, setTranscriptError] = useState<string | null>(null)

  const thumbnailUrl = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`

  const handleTranscribe = async () => {
    setTranscribing(true)
    setTranscriptError(null)
    try {
      const res = await fetch(
        `https://api.vegvisr.org/youtube-transcript-io?videoId=${encodeURIComponent(videoId)}`
      )
      if (!res.ok) throw new Error(`Transcript fetch failed (${res.status})`)
      const data = await res.json()
      const text = data.transcript || data.text
      if (!text) throw new Error('No transcript available')
      setTranscript(text)
    } catch (err) {
      setTranscriptError(err instanceof Error ? err.message : 'Transcription failed')
    } finally {
      setTranscribing(false)
    }
  }

  return (
    <div className="mt-1.5 rounded-lg border border-rose-400/20 bg-rose-500/10 overflow-hidden">
      {/* Thumbnail or embedded player */}
      {showPlayer ? (
        <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
          <iframe
            className="absolute inset-0 w-full h-full"
            src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1`}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            title="YouTube video"
          />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setShowPlayer(true)}
          className="relative w-full block"
        >
          <img
            src={thumbnailUrl}
            alt="YouTube video"
            className="w-full h-auto object-cover"
          />
          {/* Play button overlay */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-14 h-10 bg-red-600 rounded-xl flex items-center justify-center shadow-lg">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>
          </div>
        </button>
      )}

      {/* Action buttons */}
      <div className="px-3 py-2 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setShowPlayer(prev => !prev)}
          className="text-[11px] px-2.5 py-1 rounded-lg bg-white/10 text-white/70 hover:text-white hover:bg-white/15 transition-colors"
        >
          {showPlayer ? 'Hide player' : 'Play here'}
        </button>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[11px] px-2.5 py-1 rounded-lg bg-white/10 text-white/70 hover:text-white hover:bg-white/15 transition-colors no-underline"
        >
          Open on YouTube
        </a>
        <button
          type="button"
          onClick={handleTranscribe}
          disabled={transcribing || !!transcript}
          className="text-[11px] px-2.5 py-1 rounded-lg bg-white/10 text-white/70 hover:text-white hover:bg-white/15 transition-colors disabled:opacity-40"
        >
          {transcribing ? 'Transcribing...' : transcript ? 'Transcribed' : 'Transcribe'}
        </button>
      </div>

      {/* Transcript display */}
      {transcript && (
        <div className="px-3 pb-2">
          <p className="text-xs text-white/60 leading-relaxed max-h-40 overflow-y-auto whitespace-pre-wrap">
            {transcript}
          </p>
        </div>
      )}
      {transcriptError && (
        <div className="px-3 pb-2">
          <p className="text-xs text-rose-300/70">{transcriptError}</p>
        </div>
      )}
    </div>
  )
}
