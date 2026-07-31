import { useState, useEffect } from 'react'

interface GraphMeta {
  title: string
  nodeCount: number
  edgeCount: number
  metaArea?: string
  description?: string
  ogImage?: string
}

interface Props {
  graphId: string
  url: string
}

const KNOWLEDGE_BASE = 'https://knowledge.vegvisr.org'
const SEO_BASE = 'https://seo.vegvisr.org'

export function KnowledgeGraphCard({ graphId, url }: Props) {
  const [meta, setMeta] = useState<GraphMeta | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(false)

    // Prefer the SEO worker's stored metadata (has description + ogImage,
    // if a share page was ever generated for this graph). Falls back to the
    // raw graph endpoint (title + counts only) when no SEO page exists.
    fetch(`${SEO_BASE}/meta-by-graph?graphId=${encodeURIComponent(graphId)}`)
      .then(res => {
        if (!res.ok) throw new Error('No SEO metadata')
        return res.json()
      })
      .then(seoData => {
        if (cancelled) return
        setMeta({
          title: seoData.title || graphId,
          nodeCount: 0,
          edgeCount: 0,
          description: seoData.description,
          ogImage: seoData.ogImage,
        })
      })
      .catch(() => {
        if (cancelled) return null
        return fetch(`${KNOWLEDGE_BASE}/getknowgraph?id=${encodeURIComponent(graphId)}`)
          .then(res => {
            if (!res.ok) throw new Error('Not found')
            return res.json()
          })
          .then(data => {
            if (cancelled) return
            const graph = data.graphData || data
            const nodes = graph.nodes || []
            const edges = graph.edges || []
            const metadata = graph.metadata || data.metadata || {}
            setMeta({
              title: metadata.title || metadata.name || graphId,
              nodeCount: nodes.length,
              edgeCount: edges.length,
              metaArea: metadata.metaArea || metadata.area,
            })
          })
          .catch(() => {
            if (!cancelled) setError(true)
          })
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
  }, [graphId])

  if (loading) {
    return (
      <div className="mt-1.5 rounded-lg border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/5 px-3 py-2 text-xs text-slate-400 dark:text-white/40 animate-pulse">
        Loading graph...
      </div>
    )
  }

  if (error || !meta) {
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

  // SEO metadata available (description present) — render an image + text
  // card, matching SeoGraphCard's layout.
  if (meta.description !== undefined) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-1.5 flex gap-3 rounded-lg border border-sky-400/40 dark:border-sky-400/20 bg-sky-50 dark:bg-sky-500/10 hover:bg-sky-100 dark:hover:bg-sky-500/15 transition-colors overflow-hidden no-underline"
      >
        {meta.ogImage && (
          <img
            src={meta.ogImage}
            alt=""
            className="h-20 w-20 flex-shrink-0 object-cover"
          />
        )}
        <div className="min-w-0 py-2 pr-3">
          <div className="text-sm font-semibold text-sky-900 dark:text-sky-200 line-clamp-2">
            {meta.title}
          </div>
          {meta.description && (
            <div className="mt-0.5 text-xs text-slate-500 dark:text-white/50 line-clamp-2">
              {meta.description}
            </div>
          )}
          <div className="mt-1 text-[11px] text-slate-400 dark:text-white/30">Vegvisr Knowledge Graph</div>
        </div>
      </a>
    )
  }

  // No SEO page generated for this graph — fall back to title + counts.
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-1.5 block rounded-lg border border-sky-400/40 dark:border-sky-400/20 bg-sky-50 dark:bg-sky-500/10 hover:bg-sky-100 dark:hover:bg-sky-500/15 transition-colors px-3 py-2.5 no-underline"
    >
      <div className="flex items-center gap-2">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-sky-700 dark:text-sky-400 flex-shrink-0">
          <circle cx="12" cy="12" r="2" /><circle cx="6" cy="6" r="2" /><circle cx="18" cy="6" r="2" /><circle cx="6" cy="18" r="2" /><circle cx="18" cy="18" r="2" />
          <line x1="8" y1="8" x2="10" y2="10" /><line x1="14" y1="10" x2="16" y2="8" /><line x1="8" y1="16" x2="10" y2="14" /><line x1="14" y1="14" x2="16" y2="16" />
        </svg>
        <span className="text-sm font-semibold text-sky-900 dark:text-sky-200 truncate">{meta.title}</span>
      </div>
      <div className="mt-1 flex items-center gap-3 text-[11px] text-slate-600 dark:text-white/40">
        <span>{meta.nodeCount} nodes</span>
        <span>{meta.edgeCount} edges</span>
        {meta.metaArea && <span className="bg-slate-200 text-slate-700 dark:bg-white/10 dark:text-white/60 px-1.5 py-px rounded">{meta.metaArea}</span>}
      </div>
    </a>
  )
}
