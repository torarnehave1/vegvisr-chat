import { useState, useEffect } from 'react'

interface GraphMeta {
  title: string
  nodeCount: number
  edgeCount: number
  metaArea?: string
}

interface Props {
  graphId: string
  url: string
}

const KNOWLEDGE_BASE = 'https://knowledge.vegvisr.org'

export function KnowledgeGraphCard({ graphId, url }: Props) {
  const [meta, setMeta] = useState<GraphMeta | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(false)

    fetch(`${KNOWLEDGE_BASE}/getknowgraph?id=${encodeURIComponent(graphId)}`)
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
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
  }, [graphId])

  if (loading) {
    return (
      <div className="mt-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/40 animate-pulse">
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
        className="text-sky-300 underline break-all"
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
      className="mt-1.5 block rounded-lg border border-sky-400/20 bg-sky-500/10 hover:bg-sky-500/15 transition-colors px-3 py-2.5 no-underline"
    >
      <div className="flex items-center gap-2">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-sky-400 flex-shrink-0">
          <circle cx="12" cy="12" r="2" /><circle cx="6" cy="6" r="2" /><circle cx="18" cy="6" r="2" /><circle cx="6" cy="18" r="2" /><circle cx="18" cy="18" r="2" />
          <line x1="8" y1="8" x2="10" y2="10" /><line x1="14" y1="10" x2="16" y2="8" /><line x1="8" y1="16" x2="10" y2="14" /><line x1="14" y1="14" x2="16" y2="16" />
        </svg>
        <span className="text-sm font-medium text-sky-200 truncate">{meta.title}</span>
      </div>
      <div className="mt-1 flex items-center gap-3 text-[11px] text-white/40">
        <span>{meta.nodeCount} nodes</span>
        <span>{meta.edgeCount} edges</span>
        {meta.metaArea && <span className="bg-white/10 px-1.5 py-px rounded">{meta.metaArea}</span>}
      </div>
    </a>
  )
}
