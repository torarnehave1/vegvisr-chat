import { useState, useEffect } from 'react'

interface SeoGraphPreview {
  title: string | null
  description: string | null
  ogImage: string | null
}

interface Props {
  slug: string
  url: string
}

const SEO_BASE = 'https://seo.vegvisr.org'

export function SeoGraphCard({ slug, url }: Props) {
  const [preview, setPreview] = useState<SeoGraphPreview | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(false)

    fetch(`${SEO_BASE}/graph/${encodeURIComponent(slug)}?format=json`)
      .then(res => {
        if (!res.ok) throw new Error('Not found')
        return res.json()
      })
      .then(data => {
        if (cancelled) return
        if (!data.title) throw new Error('No preview')
        setPreview(data)
      })
      .catch(() => {
        if (!cancelled) setError(true)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
  }, [slug])

  if (loading) {
    return (
      <div className="mt-1.5 rounded-lg border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/5 px-3 py-2 text-xs text-slate-400 dark:text-white/40 animate-pulse">
        Loading graph...
      </div>
    )
  }

  if (error || !preview) {
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
      className="mt-1.5 flex gap-3 rounded-lg border border-sky-400/40 dark:border-sky-400/20 bg-sky-50 dark:bg-sky-500/10 hover:bg-sky-100 dark:hover:bg-sky-500/15 transition-colors overflow-hidden no-underline"
    >
      {preview.ogImage && (
        <img
          src={preview.ogImage}
          alt=""
          className="h-20 w-20 flex-shrink-0 object-cover"
        />
      )}
      <div className="min-w-0 py-2 pr-3">
        <div className="text-sm font-semibold text-sky-900 dark:text-sky-200 line-clamp-2">
          {preview.title}
        </div>
        {preview.description && (
          <div className="mt-0.5 text-xs text-slate-500 dark:text-white/50 line-clamp-2">
            {preview.description}
          </div>
        )}
        <div className="mt-1 text-[11px] text-slate-400 dark:text-white/30">Vegvisr Knowledge Graph</div>
      </div>
    </a>
  )
}
