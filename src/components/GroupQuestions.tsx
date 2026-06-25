import { useEffect, useState, useCallback, type ReactNode } from 'react'

const KNOWLEDGE_BASE = 'https://knowledge.vegvisr.org'

/** One knowledge-graph per locked group, addressed by group_id. */
function graphIdFor(groupId: string): string {
  return `graph_chat_questions_${groupId}`
}

const STATUS_COLORS: Record<string, string> = {
  open: '#38bdf8',
  answered: '#34d399',
}

const STATUS_LABELS: Record<string, string> = {
  open: 'Open',
  answered: 'Answered',
}

// Reuse same markdown image parser as WhatsNew / UserSuggestions.
const MD_IMAGE_RE = /!\[([^\]]*)\]\(([^)]+)\)/g

function renderInfo(info: string): ReactNode[] {
  const parts: ReactNode[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null
  let key = 0
  while ((match = MD_IMAGE_RE.exec(info)) !== null) {
    if (match.index > lastIndex) parts.push(<span key={key++}>{info.slice(lastIndex, match.index)}</span>)
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
  if (lastIndex < info.length) parts.push(<span key={key++}>{info.slice(lastIndex)}</span>)
  return parts
}

interface QuestionMetadata {
  status?: string // 'open' | 'answered'
  submittedBy?: string
  submittedByEmail?: string
  votes?: number
  votedBy?: string[]
  createdAt?: string
  answer?: string
  answeredBy?: string
  answeredAt?: string
}

interface QuestionNode {
  id: string
  label: string
  info: string
  color?: string
  metadata?: QuestionMetadata
}

interface Props {
  /** Required — questions are per-group. App.tsx supplies the groupId from
   * the View state (set from the locked-composer CTA or the chat header). */
  groupId: string
  groupName: string
  /** True when the current user is the group's created_by user; controls
   * whether the "Answer" action is shown. */
  isOwner: boolean
  onBack: () => void
  auth?: { user_id: string; email?: string; role?: string; phone?: string }
}

type FilterTab = 'all' | 'open' | 'answered'

function authHeaders(auth?: { user_id: string; email?: string; role?: string; phone?: string }): Record<string, string> {
  if (!auth) return {}
  return {
    'x-user-id': auth.user_id,
    'x-user-role': auth.role || '',
    'x-user-email': auth.email || '',
  }
}

export function GroupQuestions({ groupId, groupName, isOwner, onBack, auth }: Props) {
  const GRAPH_ID = graphIdFor(groupId)

  const [questions, setQuestions] = useState<QuestionNode[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  // patchNode requires expectedVersion for optimistic concurrency. Seeded from
  // getknowgraph (data.metadata.version) and updated from each patchNode's
  // newVersion field. Without this, every write returns HTTP 400 silently.
  const [graphVersion, setGraphVersion] = useState<number | null>(null)
  const [filter, setFilter] = useState<FilterTab>('all')
  const [showForm, setShowForm] = useState(false)
  const [formTitle, setFormTitle] = useState('')
  const [formDescription, setFormDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Answer-by-owner state (per-question, only one open at a time).
  const [answeringId, setAnsweringId] = useState<string | null>(null)
  const [answerText, setAnswerText] = useState('')
  const [savingAnswer, setSavingAnswer] = useState(false)

  /**
   * Optimistic-concurrency-safe patch. If the graph was edited externally
   * since our last fetch, the cached graphVersion is stale and patchNode
   * rejects the request. We refetch the version once and retry. Same recipe
   * as UserSuggestions (commit a0eb1f4) — kept verbatim so future fixes to
   * the protocol propagate to both screens together.
   */
  const runPatch = async (nodeId: string, fields: Record<string, unknown>): Promise<void> => {
    if (graphVersion === null) throw new Error('Graph version not loaded')

    const tryWith = (ver: number) =>
      fetch(`${KNOWLEDGE_BASE}/patchNode`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders(auth) },
        body: JSON.stringify({
          graphId: GRAPH_ID,
          nodeId,
          fields,
          expectedVersion: ver,
        }),
      })

    let res = await tryWith(graphVersion)

    if (!res.ok) {
      try {
        const meta = await fetch(`${KNOWLEDGE_BASE}/getknowgraph?id=${encodeURIComponent(GRAPH_ID)}`).then(r => r.json())
        const freshVer = typeof meta?.metadata?.version === 'number' ? meta.metadata.version : null
        if (freshVer !== null && freshVer !== graphVersion) {
          setGraphVersion(freshVer)
          res = await tryWith(freshVer)
        }
      } catch {
        // Refetch failed — fall through with the original response.
      }
      if (!res.ok) throw new Error(`patchNode failed: ${res.status}`)
    }

    const data = await res.json().catch(() => null)
    if (data && typeof data.newVersion === 'number') setGraphVersion(data.newVersion)
  }

  const fetchQuestions = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`${KNOWLEDGE_BASE}/getknowgraph?id=${encodeURIComponent(GRAPH_ID)}`)
      if (!res.ok) {
        if (res.status === 404) {
          setQuestions([])
          return
        }
        throw new Error('Failed to load')
      }
      const data = await res.json()
      const nodes: QuestionNode[] = (data.nodes || [])
        .filter((n: QuestionNode) => n.label && n.info)
        .reverse()
      setQuestions(nodes)
      if (typeof data.metadata?.version === 'number') setGraphVersion(data.metadata.version)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [GRAPH_ID])

  useEffect(() => {
    fetchQuestions()
  }, [fetchQuestions])

  const ensureGraphExists = async (): Promise<boolean> => {
    const check = await fetch(`${KNOWLEDGE_BASE}/getknowgraph?id=${encodeURIComponent(GRAPH_ID)}`)
    if (check.ok) return true
    const res = await fetch(`${KNOWLEDGE_BASE}/saveGraphWithHistory`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: GRAPH_ID,
        graphData: {
          nodes: [],
          edges: [],
          metadata: {
            title: `Questions — ${groupName}`,
            description: `User-submitted questions for the ${groupName} group`,
            metaArea: 'chat',
          },
        },
        override: true,
      }),
    })
    // Refetch version so subsequent patches don't hit a 400.
    if (res.ok) {
      try {
        const refetch = await fetch(`${KNOWLEDGE_BASE}/getknowgraph?id=${encodeURIComponent(GRAPH_ID)}`).then(r => r.json())
        if (typeof refetch?.metadata?.version === 'number') setGraphVersion(refetch.metadata.version)
      } catch { /* ignore */ }
    }
    return res.ok
  }

  const handleSubmit = async () => {
    if (!formTitle.trim() || !formDescription.trim() || !auth || submitting) return
    setSubmitting(true)
    try {
      await ensureGraphExists()

      const nodeId = `question-${Date.now()}`
      const node = {
        id: nodeId,
        label: formTitle.trim(),
        type: 'fulltext',
        info: formDescription.trim(),
        color: STATUS_COLORS.open,
        metadata: {
          status: 'open',
          submittedBy: auth.user_id,
          submittedByEmail: auth.email || '',
          votes: 0,
          votedBy: [],
          createdAt: new Date().toISOString(),
        },
      }

      const res = await fetch(`${KNOWLEDGE_BASE}/addNode`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders(auth) },
        body: JSON.stringify({ graphId: GRAPH_ID, node }),
      })

      if (!res.ok) throw new Error('Failed to submit')

      setQuestions(prev => [node as QuestionNode, ...prev])
      setFormTitle('')
      setFormDescription('')
      setShowForm(false)
    } catch (err) {
      console.error('Submit question failed:', err)
    } finally {
      setSubmitting(false)
    }
  }

  const handleVote = async (question: QuestionNode) => {
    if (!auth) return
    const meta = question.metadata || {}
    const votedBy = meta.votedBy || []
    if (votedBy.includes(auth.user_id)) return // already voted

    const newVotes = (meta.votes || 0) + 1
    const newVotedBy = [...votedBy, auth.user_id]

    setQuestions(prev =>
      prev.map(q =>
        q.id === question.id ? { ...q, metadata: { ...meta, votes: newVotes, votedBy: newVotedBy } } : q
      )
    )

    try {
      await runPatch(question.id, {
        metadata: { ...meta, votes: newVotes, votedBy: newVotedBy },
      })
    } catch {
      setQuestions(prev =>
        prev.map(q =>
          q.id === question.id ? { ...q, metadata: { ...meta, votes: meta.votes || 0, votedBy } } : q
        )
      )
    }
  }

  const startAnswer = (question: QuestionNode) => {
    setAnsweringId(question.id)
    setAnswerText(question.metadata?.answer || '')
  }

  const cancelAnswer = () => {
    setAnsweringId(null)
    setAnswerText('')
  }

  const saveAnswer = async (question: QuestionNode) => {
    if (savingAnswer || !auth || !answerText.trim()) return
    setSavingAnswer(true)
    const meta = question.metadata || {}
    const nextMeta: QuestionMetadata = {
      ...meta,
      status: 'answered',
      answer: answerText.trim(),
      answeredBy: auth.user_id,
      answeredAt: new Date().toISOString(),
    }
    setQuestions(prev =>
      prev.map(q => (q.id === question.id ? { ...q, color: STATUS_COLORS.answered, metadata: nextMeta } : q))
    )
    try {
      await runPatch(question.id, {
        color: STATUS_COLORS.answered,
        metadata: nextMeta,
      })
      setAnsweringId(null)
      setAnswerText('')
    } catch (err) {
      console.error('Save answer failed:', err)
      // Revert local
      setQuestions(prev =>
        prev.map(q => (q.id === question.id ? { ...q, color: STATUS_COLORS[meta.status || 'open'], metadata: meta } : q))
      )
    } finally {
      setSavingAnswer(false)
    }
  }

  const filtered =
    filter === 'all'
      ? questions
      : questions.filter(q => (q.metadata?.status || 'open') === filter)

  const tabs: { key: FilterTab; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'open', label: 'Open' },
    { key: 'answered', label: 'Answered' },
  ]

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-200 dark:border-white/10">
        <button
          onClick={onBack}
          className="rounded-lg p-1.5 text-slate-500 dark:text-white/50 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-white/10 transition-colors"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-600 dark:text-white/70 flex-1 truncate">
          Questions <span className="text-slate-400 dark:text-white/30 normal-case tracking-normal">— {groupName}</span>
        </h2>
        {auth && (
          <button
            onClick={() => setShowForm(!showForm)}
            className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${
              showForm
                ? 'bg-slate-200 dark:bg-white/10 text-slate-600 dark:text-white/70'
                : 'bg-gradient-to-r from-amber-500 to-sky-500 text-slate-900 dark:text-white shadow-lg shadow-amber-500/20'
            }`}
          >
            {showForm ? 'Cancel' : '+ Ask'}
          </button>
        )}
      </div>

      {/* Submit form */}
      {showForm && auth && (
        <div className="border-b border-slate-200 dark:border-white/10 bg-white/[0.03] px-4 py-4 space-y-3">
          <input
            type="text"
            value={formTitle}
            onChange={e => setFormTitle(e.target.value)}
            placeholder="What's your question?"
            maxLength={120}
            className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white/60 dark:bg-slate-900/60 px-3 py-2 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-white/30 focus:outline-none focus:border-amber-400/50"
          />
          <textarea
            value={formDescription}
            onChange={e => setFormDescription(e.target.value)}
            placeholder="Add detail so the owner can answer fully..."
            rows={3}
            className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white/60 dark:bg-slate-900/60 px-3 py-2 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-white/30 resize-none focus:outline-none focus:border-amber-400/50"
          />
          <div className="flex items-center justify-end">
            <button
              onClick={handleSubmit}
              disabled={!formTitle.trim() || !formDescription.trim() || submitting}
              className="px-4 py-1.5 bg-amber-600 text-slate-900 dark:text-white text-xs font-semibold rounded-lg disabled:opacity-40 hover:bg-amber-500 transition-colors"
            >
              {submitting ? 'Submitting...' : 'Submit'}
            </button>
          </div>
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex gap-1 px-4 py-2 border-b border-slate-200 dark:border-white/10">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
              filter === tab.key
                ? 'bg-white/15 text-slate-900 dark:text-white'
                : 'text-slate-400 dark:text-white/40 hover:text-slate-500 dark:hover:text-white/60 hover:bg-slate-100 dark:hover:bg-white/5'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {loading && (
          <div className="text-sm text-slate-500 dark:text-white/50 text-center py-8">Loading...</div>
        )}

        {error && (
          <div className="text-sm text-rose-300/80 text-center py-8">{error}</div>
        )}

        {!loading && !error && filtered.length === 0 && (
          <div className="text-sm text-slate-500 dark:text-white/50 text-center py-8">
            {filter === 'all' ? 'No questions yet. Be the first to ask!' : `No ${filter} questions.`}
          </div>
        )}

        {filtered.map(question => {
          const meta = question.metadata || {}
          const status = meta.status || 'open'
          const votes = meta.votes || 0
          const votedBy = meta.votedBy || []
          const hasVoted = auth ? votedBy.includes(auth.user_id) : false
          const isOwn = auth ? meta.submittedBy === auth.user_id : false
          const isAnswering = answeringId === question.id

          return (
            <div
              key={question.id}
              className="rounded-xl border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/5 px-4 py-3"
            >
              <div className="flex items-start gap-2">
                <span
                  className="mt-1.5 h-2 w-2 rounded-full shrink-0"
                  style={{ backgroundColor: STATUS_COLORS[status] || STATUS_COLORS.open }}
                  title={STATUS_LABELS[status] || status}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm font-semibold text-slate-800 dark:text-white/90">{question.label}</h3>
                    <span
                      className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                      style={{ backgroundColor: `${STATUS_COLORS[status]}20`, color: STATUS_COLORS[status] }}
                    >
                      {STATUS_LABELS[status] || status}
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-slate-500 dark:text-white/60 leading-relaxed whitespace-pre-line">
                    {renderInfo(question.info)}
                  </div>

                  {/* Answer block */}
                  {meta.answer && !isAnswering && (
                    <div className="mt-3 rounded-lg border-l-2 border-emerald-400/60 bg-emerald-500/5 px-3 py-2">
                      <div className="text-[10px] uppercase tracking-wider text-emerald-300/80 font-semibold mb-1">
                        Owner answered
                      </div>
                      <div className="text-xs text-slate-700 dark:text-white/80 leading-relaxed whitespace-pre-line">
                        {renderInfo(meta.answer)}
                      </div>
                    </div>
                  )}

                  {/* Owner editor */}
                  {isAnswering && isOwner && (
                    <div className="mt-3 space-y-2">
                      <textarea
                        value={answerText}
                        onChange={e => setAnswerText(e.target.value)}
                        placeholder="Write the answer..."
                        rows={3}
                        className="w-full rounded-xl border border-emerald-400/30 bg-emerald-500/5 px-3 py-2 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-white/30 resize-none focus:outline-none focus:border-emerald-400/60"
                      />
                      <div className="flex items-center gap-2 justify-end">
                        <button
                          onClick={cancelAnswer}
                          disabled={savingAnswer}
                          className="px-3 py-1 text-xs text-slate-500 dark:text-white/60 hover:text-slate-900 dark:hover:text-white"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => saveAnswer(question)}
                          disabled={!answerText.trim() || savingAnswer}
                          className="px-3 py-1 bg-emerald-600 text-slate-900 dark:text-white text-xs font-semibold rounded-lg disabled:opacity-40 hover:bg-emerald-500 transition-colors"
                        >
                          {savingAnswer ? 'Saving...' : 'Save answer'}
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="mt-2 flex items-center gap-3">
                    {auth && (
                      <button
                        onClick={() => handleVote(question)}
                        disabled={hasVoted}
                        className={`flex items-center gap-1 text-xs transition-colors ${
                          hasVoted ? 'text-amber-400 cursor-default' : 'text-slate-400 dark:text-white/30 hover:text-amber-400'
                        }`}
                        title={hasVoted ? 'You voted' : 'Upvote'}
                      >
                        <svg className="h-3.5 w-3.5" fill={hasVoted ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 9V5a3 3 0 00-3-3l-4 9v11h11.28a2 2 0 002-1.7l1.38-9a2 2 0 00-2-2.3H14z M3 15v7" />
                        </svg>
                        {votes > 0 && <span>{votes}</span>}
                      </button>
                    )}
                    {isOwner && !isAnswering && (
                      <button
                        onClick={() => startAnswer(question)}
                        className="text-xs text-emerald-300/70 hover:text-emerald-300 transition-colors"
                      >
                        {meta.answer ? 'Edit answer' : 'Answer'}
                      </button>
                    )}
                    <span className="text-[10px] text-slate-400 dark:text-white/25">
                      {isOwn ? 'You' : meta.submittedByEmail?.split('@')[0] || 'Anonymous'}
                    </span>
                    {meta.createdAt && (
                      <span className="text-[10px] text-slate-300 dark:text-white/20">
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
