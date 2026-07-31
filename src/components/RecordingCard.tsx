import { useState } from 'react'

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

  return (
    <div className="mt-1.5 rounded-lg border border-emerald-400/20 bg-emerald-500/10 overflow-hidden">
      {showPlayer ? (
        <video
          className="w-full h-auto max-h-80 bg-black"
          src={url}
          controls
          autoPlay
          preload="metadata"
        />
      ) : (
        <button
          type="button"
          onClick={() => setShowPlayer(true)}
          className="relative w-full flex items-center justify-center bg-slate-900/40"
          style={{ paddingBottom: '40%' }}
        >
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-14 h-14 bg-emerald-600 rounded-full flex items-center justify-center shadow-lg">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="white">
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>
          </div>
        </button>
      )}

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
