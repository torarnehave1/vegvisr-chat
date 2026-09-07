import { useState, useEffect } from 'react'

interface LinkPreview {
  title: string | null
  description: string | null
  image: string | null
  url: string
  siteName?: string | null
}

interface Props {
  url: string
}

const LINK_PREVIEW_BASE = 'https://group-chat-worker.torarnehave.workers.dev'

// Card for any pasted link the host-specific extractors in MessageBubble don't claim. The worker
// reads the target's og:/twitter: tags; a page with none (or an unreachable one) renders nothing
// at all rather than a placeholder, because the message text already carries the link itself —
// a failed preview should leave the message looking exactly as it did before.
export function LinkPreviewCard({ url }: Props) {
  const [preview, setPreview] = useState<LinkPreview | null>(null)
  const [imageFailed, setImageFailed] = useState(false)

  // No reset on url change: MessageBubble keys each card by its url, so a different link mounts a
  // fresh component rather than reusing this one's state.
  useEffect(() => {
    let cancelled = false

    fetch(`${LINK_PREVIEW_BASE}/link-preview?url=${encodeURIComponent(url)}`)
      .then(res => {
        if (!res.ok) throw new Error('No preview')
        return res.json()
      })
      .then(data => {
        if (cancelled) return
        if (!data.success || !data.preview) throw new Error('No preview')
        if (!data.preview.title && !data.preview.image) throw new Error('Nothing to show')
        setPreview(data.preview)
      })
      .catch(() => {
        if (!cancelled) setPreview(null)
      })

    return () => { cancelled = true }
  }, [url])

  if (!preview) return null

  let host = preview.siteName || ''
  if (!host) {
    try {
      host = new URL(url).hostname.replace(/^www\./, '')
    } catch {
      host = ''
    }
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-1.5 flex gap-3 rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors overflow-hidden no-underline"
    >
      {preview.image && !imageFailed && (
        <img
          src={preview.image}
          alt=""
          onError={() => setImageFailed(true)}
          className="h-20 w-20 flex-shrink-0 object-cover"
        />
      )}
      <div className="min-w-0 py-2 pr-3">
        <div className="text-sm font-semibold text-slate-900 dark:text-white/90 line-clamp-2">
          {preview.title || host}
        </div>
        {preview.description && (
          <div className="mt-0.5 text-xs text-slate-500 dark:text-white/50 line-clamp-2">
            {preview.description}
          </div>
        )}
        {host && (
          <div className="mt-1 text-[11px] text-slate-400 dark:text-white/30">{host}</div>
        )}
      </div>
    </a>
  )
}
