import { useEffect, useState } from 'react'

const KNOWLEDGE_BASE = 'https://knowledge.vegvisr.org'
const GRAPH_ID = 'graph_chat_new_features'

interface FeatureNode {
  id: string
  label: string
  info: string
  color?: string
  created_at?: string
}

interface Props {
  onBack: () => void
}

export function WhatsNew({ onBack }: Props) {
  const [features, setFeatures] = useState<FeatureNode[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    setLoading(true)
    setError('')

    fetch(`${KNOWLEDGE_BASE}/getknowgraph?id=${encodeURIComponent(GRAPH_ID)}`)
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load')
        return res.json()
      })
      .then((data) => {
        const nodes: FeatureNode[] = (data.nodes || [])
          .filter((n: FeatureNode) => n.label && n.info)
          .sort((a: FeatureNode, b: FeatureNode) => {
            // Sort by id descending (newest first) — nodes created later have higher IDs
            return (b.id || '').localeCompare(a.id || '')
          })
        setFeatures(nodes)
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10">
        <button
          onClick={onBack}
          className="rounded-lg p-1.5 text-white/50 hover:text-white hover:bg-white/10 transition-colors"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-white/70">
          What's New
        </h2>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {loading && (
          <div className="text-sm text-white/50 text-center py-8">Loading...</div>
        )}

        {error && (
          <div className="text-sm text-rose-300/80 text-center py-8">{error}</div>
        )}

        {!loading && !error && features.length === 0 && (
          <div className="text-sm text-white/50 text-center py-8">No updates yet.</div>
        )}

        {features.map((feature) => (
          <div
            key={feature.id}
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-3"
          >
            <div className="flex items-start gap-2">
              <span
                className="mt-1 h-2 w-2 rounded-full shrink-0"
                style={{ backgroundColor: feature.color || '#38bdf8' }}
              />
              <div className="min-w-0">
                <h3 className="text-sm font-semibold text-white/90">{feature.label}</h3>
                <p className="mt-1 text-xs text-white/60 leading-relaxed whitespace-pre-line">
                  {feature.info}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
