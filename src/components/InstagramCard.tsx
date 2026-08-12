import { useState } from 'react'

interface Props {
  shortcode: string
  /** 'p' (feed post), 'reel' or 'tv' — determines the canonical permalink path */
  kind: string
  url: string
}

// Instagram embeds reflow: their height tracks caption length and chrome rather
// than the media's own ratio, so there is no aspect-ratio to hold. A fixed height
// is the only stable option; this fits a reel plus its header at chat width.
const EMBED_HEIGHT = 620

export function InstagramCard({ shortcode, kind, url }: Props) {
  const [showPost, setShowPost] = useState(false)

  // Rebuilt from the shortcode rather than the raw URL, which drops share
  // params such as ?igsi=... — those break the /embed/ route.
  const canonicalUrl = `https://www.instagram.com/${kind}/${shortcode}/`
  const embedUrl = `${canonicalUrl}embed/`

  return (
    <div className="mt-1.5 rounded-lg border border-fuchsia-400/20 bg-fuchsia-500/10 overflow-hidden">
      {showPost ? (
        <iframe
          className="w-full block border-0 bg-white"
          style={{ height: EMBED_HEIGHT }}
          src={embedUrl}
          title="Instagram post"
          scrolling="no"
          allow="encrypted-media; picture-in-picture; web-share"
          allowFullScreen
        />
      ) : (
        // Instagram publishes no unauthenticated thumbnail endpoint (unlike
        // img.youtube.com), so this is a branded placeholder rather than a
        // preview image. Deferring the iframe keeps the third-party frame out
        // of the page until the reader asks for it, same as YouTubeCard.
        <button
          type="button"
          onClick={() => setShowPost(true)}
          className="w-full flex items-center gap-3 px-3 py-4 text-left hover:bg-fuchsia-500/15 transition-colors"
        >
          <div
            className="w-10 h-10 shrink-0 rounded-xl flex items-center justify-center shadow-lg"
            style={{ background: 'linear-gradient(45deg, #f09433, #dc2743, #bc1888)' }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
              <rect x="2" y="2" width="20" height="20" rx="5" />
              <circle cx="12" cy="12" r="4" />
              <circle cx="17.5" cy="6.5" r="1" fill="white" stroke="none" />
            </svg>
          </div>
          <div className="min-w-0">
            <p className="text-sm text-slate-700 dark:text-white/80 leading-tight">
              {kind === 'p' ? 'Instagram post' : kind === 'tv' ? 'Instagram video' : 'Instagram reel'}
            </p>
            <p className="text-[11px] text-slate-500 dark:text-white/50 truncate">
              Show post
            </p>
          </div>
        </button>
      )}

      <div className="px-3 py-2 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setShowPost(prev => !prev)}
          className="text-[11px] px-2.5 py-1 rounded-lg bg-slate-200 dark:bg-white/10 text-slate-600 dark:text-white/70 hover:text-slate-900 dark:hover:text-white hover:bg-white/15 transition-colors"
        >
          {showPost ? 'Hide post' : 'Show post'}
        </button>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[11px] px-2.5 py-1 rounded-lg bg-slate-200 dark:bg-white/10 text-slate-600 dark:text-white/70 hover:text-slate-900 dark:hover:text-white hover:bg-white/15 transition-colors no-underline"
        >
          Open on Instagram
        </a>
      </div>
    </div>
  )
}
