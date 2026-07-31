import { useRef, useState } from 'react'

interface Props {
  url: string
  /** Filename decoded from the URL path, when the link carries one directly
   * (e.g. a founder's own /recordings/<name>.mp4 domain). Share-token links
   * (api.vegvisr.org/realtime/recordings/shared?token=...) don't carry a
   * filename, so this is undefined for those. */
  fileName?: string
}

export function RecordingCard({ url, fileName }: Props) {
  const [showPlayer, setShowPlayer] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)

  // Frame 0 of a recording is frequently a black leading frame (encoder
  // artifact), so relying on the browser's default poster looks broken.
  // Seek 1s in once metadata loads to grab a real thumbnail frame instead.
  const handleLoadedMetadata = () => {
    const v = videoRef.current
    if (v && !showPlayer) v.currentTime = Math.min(1, v.duration / 2 || 1)
  }

  return (
    <div className="mt-1.5 rounded-lg border border-emerald-400/20 bg-emerald-500/10 overflow-hidden">
      {/* The <video> element itself supplies the poster frame — there's no
       * separate thumbnail service for arbitrary R2-hosted files like there
       * is for YouTube, so we seek past the (often black) first frame above. */}
      <div className="relative w-full bg-black">
        <video
          ref={videoRef}
          className="w-full h-auto max-h-80 block"
          src={url}
          controls={showPlayer}
          autoPlay={showPlayer}
          muted={!showPlayer}
          playsInline
          preload="metadata"
          onLoadedMetadata={handleLoadedMetadata}
        />
        {!showPlayer && (
          <button
            type="button"
            onClick={() => {
              if (videoRef.current) videoRef.current.currentTime = 0
              setShowPlayer(true)
            }}
            className="absolute inset-0 flex items-center justify-center"
            aria-label="Play recording"
          >
            <div className="w-14 h-14 bg-emerald-600 rounded-full flex items-center justify-center shadow-lg">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="white">
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>
          </button>
        )}
      </div>

      <div className="px-3 py-2 flex flex-wrap items-center gap-2">
        <span className="text-[11px] text-slate-600 dark:text-white/70 truncate max-w-[200px]">
          {fileName || 'Shared recording'}
        </span>
        <button
          type="button"
          onClick={() => setShowPlayer(prev => !prev)}
          className="text-[11px] px-2.5 py-1 rounded-lg bg-slate-200 dark:bg-white/10 text-slate-600 dark:text-white/70 hover:text-slate-900 dark:hover:text-white hover:bg-white/15 transition-colors"
        >
          {showPlayer ? 'Hide player' : 'Play here'}
        </button>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[11px] px-2.5 py-1 rounded-lg bg-slate-200 dark:bg-white/10 text-slate-600 dark:text-white/70 hover:text-slate-900 dark:hover:text-white hover:bg-white/15 transition-colors no-underline"
        >
          Open in new tab
        </a>
      </div>
    </div>
  )
}
