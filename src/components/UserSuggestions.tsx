import { useEffect, useState, useCallback, useRef, type ReactNode } from 'react'
import { sendMessage } from '../services/chat-service'

const KNOWLEDGE_BASE = 'https://knowledge.vegvisr.org'
const GRAPH_ID = 'graph_chat_user_suggestions'

const STATUS_COLORS: Record<string, string> = {
  new: '#38bdf8',
  reviewed: '#f59e0b',
  icebox: '#94a3b8',
  planned: '#a78bfa',
  shipped: '#34d399',
}

const STATUS_LABELS: Record<string, string> = {
  new: 'New',
  reviewed: 'Reviewed',
  icebox: 'Icebox',
  planned: 'Planned',
  shipped: 'Shipped',
}

const CATEGORY_STYLES: Record<string, string> = {
  feature: 'bg-sky-500/20 text-sky-300',
  bug: 'bg-rose-500/20 text-rose-300',
  ux: 'bg-violet-500/20 text-violet-300',
  integration: 'bg-emerald-500/20 text-emerald-300',
  other: 'bg-white/10 text-white/50',
}

const CATEGORY_LABELS: Record<string, string> = {
  feature: 'Feature',
  bug: 'Bug',
  ux: 'UX',
  integration: 'Integration',
  other: 'Other',
}

// Reuse same markdown image parser as WhatsNew
const MD_IMAGE_RE = /!\[([^\]]*)\]\(([^)]+)\)/g

function renderInfo(info: string): ReactNode[] {
  const parts: ReactNode[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null
  let key = 0

  while ((match = MD_IMAGE_RE.exec(info)) !== null) {
    if (match.index > lastIndex) {
      parts.push(<span key={key++}>{info.slice(lastIndex, match.index)}</span>)
    }
    const alt = match[1]
    const url = match[2]
    const widthMatch = alt.match(/width:\s*(\d+(?:px|%)?)/i)
    const style: React.CSSProperties = {
      maxWidth: '100%',
      borderRadius: '0.5rem',
      marginTop: '0.5rem',
      marginBottom: '0.5rem',
    }
    if (widthMatch) {
      style.width = widthMatch[1].includes('%') || widthMatch[1].includes('px')
        ? widthMatch[1]
        : `${widthMatch[1]}px`
    }
    const cleanAlt = alt.replace(/\|.*$/, '').trim() || 'image'
    parts.push(<img key={key++} src={url} alt={cleanAlt} style={style} loading="lazy" />)
    lastIndex = match.index + match[0].length
  }

  if (lastIndex < info.length) {
    parts.push(<span key={key++}>{info.slice(lastIndex)}</span>)
  }
  return parts
}

interface SuggestionMetadata {
  status?: string
  category?: string
  submittedBy?: string
  submittedByEmail?: string
  votes?: number
  votedBy?: string[]
  createdAt?: string
  groupId?: string
}

interface SuggestionNode {
  id: string
  label: string
  info: string
  color?: string
  metadata?: SuggestionMetadata
}

interface Props {
  onBack: () => void
  auth?: { user_id: string; email?: string; role?: string; phone?: string }
  groupId?: string
}

type FilterTab = 'all' | 'new' | 'icebox' | 'planned' | 'shipped'

export function UserSuggestions({ onBack, auth, groupId }: Props) {
  const [suggestions, setSuggestions] = useState<SuggestionNode[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState<FilterTab>('all')
  const [showForm, setShowForm] = useState(false)
  const [formTitle, setFormTitle] = useState('')
  const [formDescription, setFormDescription] = useState('')
  const [formCategory, setFormCategory] = useState('feature')
  const [submitting, setSubmitting] = useState(false)
  const [statusMenuId, setStatusMenuId] = useState<string | null>(null)
  const statusMenuRef = useRef<HTMLDivElement>(null)

  const isAdmin = auth?.role === 'Superadmin'

  // Close status menu on click outside
  useEffect(() => {
    if (!statusMenuId) return
    const handler = (e: MouseEvent) => {
      if (statusMenuRef.current && !statusMenuRef.current.contains(e.target as Node)) {
        setStatusMenuId(null)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [statusMenuId])

  const handleStatusChange = async (suggestion: SuggestionNode, newStatus: string) => {
    setStatusMenuId(null)
    const meta = suggestion.metadata || {}
    const oldStatus = meta.status || 'new'
    if (newStatus === oldStatus) return

    const newColor = STATUS_COLORS[newStatus] || STATUS_COLORS.new

    // Optimistic update
    setSuggestions(prev =>
      prev.map(s =>
        s.id === suggestion.id
          ? { ...s, color: newColor, metadata: { ...meta, status: newStatus } }
          : s
      )
    )

    try {
      const res = await fetch(`${KNOWLEDGE_BASE}/patchNode`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          graphId: GRAPH_ID,
          nodeId: suggestion.id,
          fields: {
            color: newColor,
            metadata: { ...meta, status: newStatus },
          },
        }),
      })
      if (!res.ok) throw new Error(`patchNode failed: ${res.status}`)

      // When shipped: send a message to the originating group
      if (newStatus === 'shipped') {
        const targetGroupId = meta.groupId || groupId
        if (targetGroupId && auth?.user_id && auth?.phone) {
          const title = suggestion.label
          try {
            await sendMessage(
              targetGroupId,
              { body: `🚀 Shipped! «${title}» — suggestion er nå levert. Takk for innspillet! ✅`, message_type: 'text' },
              { user_id: auth.user_id, phone: auth.phone, email: auth.email },
            )
          } catch {
            // Non-critical — don't revert the status change
          }
        }
      }
    } catch {
      // Revert on failure
      setSuggestions(prev =>
        prev.map(s =>
          s.id === suggestion.id
            ? { ...s, color: STATUS_COLORS[oldStatus], metadata: { ...meta, status: oldStatus } }
            : s
        )
      )
    }
  }

  const fetchSuggestions = useCallback(async () => {
    try {
      const res = await fetch(
        `${KNOWLEDGE_BASE}/getknowgraph?id=${encodeURIComponent(GRAPH_ID)}`
      )
      if (!res.ok) {
        if (res.status === 404) {
          setSuggestions([])
          return
        }
        throw new Error('Failed to load')
      }
      const data = await res.json()
      const nodes: SuggestionNode[] = (data.nodes || [])
        .filter((n: SuggestionNode) => n.label && n.info)
        .reverse()
      setSuggestions(nodes)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchSuggestions()
  }, [fetchSuggestions])

  const ensureGraphExists = async (): Promise<boolean> => {
    const check = await fetch(
      `${KNOWLEDGE_BASE}/getknowgraph?id=${encodeURIComponent(GRAPH_ID)}`
    )
    if (check.ok) return true
    // Create graph
    const res = await fetch(`${KNOWLEDGE_BASE}/saveGraphWithHistory`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: GRAPH_ID,
        graphData: {
          nodes: [],
          edges: [],
          metadata: {
            title: 'Chat User Suggestions',
            description: 'User-submitted suggestions for the Vegvisr Chat app',
            metaArea: 'chat',
          },
        },
        override: true,
      }),
    })
    return res.ok
  }

  const handleSubmit = async () => {
    if (!formTitle.trim() || !formDescription.trim() || !auth || submitting) return
    setSubmitting(true)
    try {
      await ensureGraphExists()

      const nodeId = `suggestion-${Date.now()}`
      const node = {
        id: nodeId,
        label: formTitle.trim(),
        type: 'fulltext',
        info: formDescription.trim(),
        color: STATUS_COLORS.new,
        metadata: {
          status: 'new',
          category: formCategory,
          submittedBy: auth.user_id,
          submittedByEmail: auth.email || '',
          votes: 0,
          votedBy: [],
          createdAt: new Date().toISOString(),
          ...(groupId ? { groupId } : {}),
        },
      }

      const res = await fetch(`${KNOWLEDGE_BASE}/addNode`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ graphId: GRAPH_ID, node }),
      })

      if (!res.ok) throw new Error('Failed to submit')

      // Prepend to local list
      setSuggestions(prev => [node as SuggestionNode, ...prev])
      setFormTitle('')
      setFormDescription('')
      setFormCategory('feature')
      setShowForm(false)
    } catch (err) {
      console.error('Submit suggestion failed:', err)
    } finally {
      setSubmitting(false)
    }
  }

  const handleVote = async (suggestion: SuggestionNode) => {
    if (!auth) return
    const meta = suggestion.metadata || {}
    const votedBy = meta.votedBy || []
    if (votedBy.includes(auth.user_id)) return // already voted

    const newVotes = (meta.votes || 0) + 1
    const newVotedBy = [...votedBy, auth.user_id]

    // Optimistic update
    setSuggestions(prev =>
      prev.map(s =>
        s.id === suggestion.id
          ? { ...s, metadata: { ...meta, votes: newVotes, votedBy: newVotedBy } }
          : s
      )
    )

    try {
      const voteRes = await fetch(`${KNOWLEDGE_BASE}/patchNode`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          graphId: GRAPH_ID,
          nodeId: suggestion.id,
          fields: {
            metadata: { ...meta, votes: newVotes, votedBy: newVotedBy },
          },
        }),
      })
      if (!voteRes.ok) throw new Error(`patchNode failed: ${voteRes.status}`)
    } catch {
      // Revert on failure
      setSuggestions(prev =>
        prev.map(s =>
          s.id === suggestion.id
            ? { ...s, metadata: { ...meta, votes: meta.votes || 0, votedBy } }
            : s
        )
      )
    }
  }

  const filtered =
    filter === 'all'
      ? suggestions
      : suggestions.filter(s => s.metadata?.status === filter)

  const tabs: { key: FilterTab; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'new', label: 'New' },
    { key: 'icebox', label: 'Icebox' },
    { key: 'planned', label: 'Planned' },
    { key: 'shipped', label: 'Shipped' },
  ]

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
        <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-white/70 flex-1">
          Suggestions
        </h2>
        {auth && (
          <button
            onClick={() => setShowForm(!showForm)}
            className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${
              showForm
                ? 'bg-white/10 text-white/70'
                : 'bg-gradient-to-r from-sky-500 to-violet-500 text-white shadow-lg shadow-sky-500/20'
            }`}
          >
            {showForm ? 'Cancel' : '+ Suggest'}
          </button>
        )}
      </div>

      {/* Submit form */}
      {showForm && auth && (
        <div className="border-b border-white/10 bg-white/[0.03] px-4 py-4 space-y-3">
          <input
            type="text"
            value={formTitle}
            onChange={e => setFormTitle(e.target.value)}
            placeholder="Suggestion title"
            maxLength={120}
            className="w-full rounded-xl border border-white/10 bg-slate-900/60 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-sky-400/50"
          />
          <textarea
            value={formDescription}
            onChange={e => setFormDescription(e.target.value)}
            placeholder="Describe your suggestion..."
            rows={3}
            className="w-full rounded-xl border border-white/10 bg-slate-900/60 px-3 py-2 text-sm text-white placeholder:text-white/30 resize-none focus:outline-none focus:border-sky-400/50"
          />
          <div className="flex items-center gap-3">
            <select
              value={formCategory}
              onChange={e => setFormCategory(e.target.value)}
              className="text-xs bg-slate-800 border border-white/10 text-white/70 rounded-lg px-2 py-1.5"
            >
              {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
            <div className="flex-1" />
            <button
              onClick={handleSubmit}
              disabled={!formTitle.trim() || !formDescription.trim() || submitting}
              className="px-4 py-1.5 bg-sky-600 text-white text-xs font-semibold rounded-lg disabled:opacity-40 hover:bg-sky-500 transition-colors"
            >
              {submitting ? 'Submitting...' : 'Submit'}
            </button>
          </div>
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex gap-1 px-4 py-2 border-b border-white/10">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
              filter === tab.key
                ? 'bg-white/15 text-white'
                : 'text-white/40 hover:text-white/60 hover:bg-white/5'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {loading && (
          <div className="text-sm text-white/50 text-center py-8">Loading...</div>
        )}

        {error && (
          <div className="text-sm text-rose-300/80 text-center py-8">{error}</div>
        )}

        {!loading && !error && filtered.length === 0 && (
          <div className="text-sm text-white/50 text-center py-8">
            {filter === 'all' ? 'No suggestions yet. Be the first!' : `No ${filter} suggestions.`}
          </div>
        )}

        {filtered.map(suggestion => {
          const meta = suggestion.metadata || {}
          const status = meta.status || 'new'
          const category = meta.category || 'other'
          const votes = meta.votes || 0
          const votedBy = meta.votedBy || []
          const hasVoted = auth ? votedBy.includes(auth.user_id) : false
          const isOwn = auth ? meta.submittedBy === auth.user_id : false

          return (
            <div
              key={suggestion.id}
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-3"
            >
              <div className="flex items-start gap-2">
                <span
                  className="mt-1.5 h-2 w-2 rounded-full shrink-0"
                  style={{ backgroundColor: STATUS_COLORS[status] || STATUS_COLORS.new }}
                  title={STATUS_LABELS[status] || status}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm font-semibold text-white/90">{suggestion.label}</h3>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${CATEGORY_STYLES[category] || CATEGORY_STYLES.other}`}>
                      {CATEGORY_LABELS[category] || category}
                    </span>
                    <span className="relative">
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${isAdmin ? 'cursor-pointer hover:ring-1 hover:ring-white/20' : ''}`}
                        style={{ backgroundColor: `${STATUS_COLORS[status]}20`, color: STATUS_COLORS[status] }}
                        onClick={isAdmin ? () => setStatusMenuId(statusMenuId === suggestion.id ? null : suggestion.id) : undefined}
                        title={isAdmin ? 'Click to change status' : (STATUS_LABELS[status] || status)}
                      >
                        {STATUS_LABELS[status] || status}
                      </span>
                      {statusMenuId === suggestion.id && (
                        <div
                          ref={statusMenuRef}
                          className="absolute z-50 top-6 left-0 bg-slate-800 border border-white/10 rounded-lg shadow-xl py-1 min-w-[120px]"
                        >
                          {Object.entries(STATUS_LABELS).map(([key, label]) => (
                            <button
                              key={key}
                              type="button"
                              onClick={() => handleStatusChange(suggestion, key)}
                              className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs transition-colors ${
                                key === status ? 'bg-white/10 text-white' : 'text-white/60 hover:bg-white/5 hover:text-white'
                              }`}
                            >
                              <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: STATUS_COLORS[key] }} />
                              {label}
                            </button>
                          ))}
                        </div>
                      )}
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-white/60 leading-relaxed whitespace-pre-line">
                    {renderInfo(suggestion.info)}
                  </div>
                  <div className="mt-2 flex items-center gap-3">
                    {auth && (
                      <button
                        onClick={() => handleVote(suggestion)}
                        disabled={hasVoted}
                        className={`flex items-center gap-1 text-xs transition-colors ${
                          hasVoted
                            ? 'text-amber-400 cursor-default'
                            : 'text-white/30 hover:text-amber-400'
                        }`}
                        title={hasVoted ? 'You voted' : 'Upvote'}
                      >
                        <svg className="h-3.5 w-3.5" fill={hasVoted ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 9V5a3 3 0 00-3-3l-4 9v11h11.28a2 2 0 002-1.7l1.38-9a2 2 0 00-2-2.3H14z M3 15v7" />
                        </svg>
                        {votes > 0 && <span>{votes}</span>}
                      </button>
                    )}
                    <span className="text-[10px] text-white/25">
                      {isOwn ? 'You' : meta.submittedByEmail?.split('@')[0] || 'Anonymous'}
                    </span>
                    {meta.createdAt && (
                      <span className="text-[10px] text-white/20">
                        {new Date(meta.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
