import { useState, useEffect } from 'react'

interface FinnPreview {
  title: string | null
  description: string | null
  image: string | null
  url: string
}

interface Props {
  url: string
}

const LINK_PREVIEW_BASE = 'https://group-chat-worker.torarnehave.workers.dev'

export function FinnListingCard({ url }: Props) {
  const [preview, setPreview] = useState<FinnPreview | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(false)

    fetch(`${LINK_PREVIEW_BASE}/link-preview?url=${encodeURIComponent(url)}`)
      .then(res => {
        if (!res.ok) throw new Error('Not found')
        return res.json()
      })
      .then(data => {
        if (cancelled) return
        if (!data.success || !data.preview) throw new Error('No preview')
        setPreview(data.preview)
      })
      .catch(() => {
        if (!cancelled) setError(true)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
  }, [url])

  if (loading) {
    return (
      <div className="mt-1.5 rounded-lg border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/5 px-3 py-2 text-xs text-slate-400 dark:text-white/40 animate-pulse">
        Loading listing...
      </div>
    )
  }

  if (error || !preview || !preview.title) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-sky-700 dark:text-sky-300 underline break-all"
      >
        {url}
      </a>
    )
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-1.5 flex gap-3 rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors overflow-hidden no-underline"
    >
      {preview.image && (
        <img
          src={preview.image}
          alt=""
          className="h-20 w-20 flex-shrink-0 object-cover"
        />
      )}
      <div className="min-w-0 py-2 pr-3">
        <div className="text-sm font-semibold text-slate-900 dark:text-white/90 line-clamp-2">
          {preview.title}
        </div>
        {preview.description && (
          <div className="mt-0.5 text-xs text-slate-500 dark:text-white/50 line-clamp-2">
            {preview.description}
          </div>
        )}
        <div className="mt-1 text-[11px] text-slate-400 dark:text-white/30">finn.no</div>
      </div>
    </a>
  )
}
