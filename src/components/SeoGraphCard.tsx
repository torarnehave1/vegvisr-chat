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
      <div className="mt-1.5 rounded-lg border border-line bg-surface-sunk px-3 py-2 text-xs text-ink-faint animate-pulse">
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
        className="text-brand underline break-all"
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
      className="mt-1.5 flex gap-3 rounded-lg border border-brand/40 bg-brand-soft hover:bg-brand-soft transition-colors overflow-hidden no-underline"
    >
      {preview.ogImage && (
        <img
          src={preview.ogImage}
          alt=""
          className="h-20 w-20 flex-shrink-0 object-cover"
        />
      )}
      <div className="min-w-0 py-2 pr-3">
        <div className="text-sm font-semibold text-brand-strong line-clamp-2">
          {preview.title}
        </div>
        {preview.description && (
          <div className="mt-0.5 text-xs text-ink-soft line-clamp-2">
            {preview.description}
          </div>
        )}
        <div className="mt-1 text-[11px] text-ink-faint">Vegvisr Knowledge Graph</div>
      </div>
    </a>
  )
}
