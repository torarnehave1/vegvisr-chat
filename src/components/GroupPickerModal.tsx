import { useEffect, useMemo, useState } from 'react'
import type { Group } from '../types/chat'

interface Props {
  open: boolean
  title: string
  ctaLabel: string
  groups: Group[]
  /** Group ids that must not appear in the picker — typically the current group
   * the user is forwarding/moving from. */
  excludeGroupIds?: string[]
  onCancel: () => void
  onPick: (group: Group) => void
}

export function GroupPickerModal({ open, title, ctaLabel, groups, excludeGroupIds, onCancel, onPick }: Props) {
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!open) {
      setQuery('')
      setSelectedId(null)
      setSubmitting(false)
    }
  }, [open])

  const exclude = useMemo(() => new Set(excludeGroupIds || []), [excludeGroupIds])
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return groups
      .filter(g => !exclude.has(g.id))
      .filter(g => !q || g.name.toLowerCase().includes(q))
      .sort((a, b) => (b.updated_at || 0) - (a.updated_at || 0))
  }, [groups, exclude, query])

  if (!open) return null

  const selected = filtered.find(g => g.id === selectedId) || null

  return (
    <div
      className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-md bg-slate-900 border border-white/10 rounded-2xl shadow-2xl flex flex-col max-h-[80vh]"
        onClick={e => e.stopPropagation()}
      >
        <div className="px-4 pt-4 pb-2">
          <h2 className="text-white text-base font-semibold">{title}</h2>
        </div>
        <div className="px-4 pb-2">
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search groups…"
            className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-white/10 text-white text-sm placeholder-white/40 focus:outline-none focus:border-sky-400/60"
            autoFocus
          />
        </div>
        <div className="flex-1 overflow-y-auto px-2 pb-2">
          {filtered.length === 0 ? (
            <div className="px-4 py-8 text-center text-white/50 text-sm">
              {query ? 'No matching groups.' : 'No other groups available.'}
            </div>
          ) : (
            filtered.map(g => {
              const isSelected = g.id === selectedId
              return (
                <button
                  key={g.id}
                  onClick={() => setSelectedId(g.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-left ${isSelected ? 'bg-sky-500/20 ring-1 ring-sky-400/60' : 'hover:bg-white/5'}`}
                >
                  {g.image_url ? (
                    <img src={g.image_url} alt="" className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-white/70 text-xs font-semibold flex-shrink-0">
                      {g.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <span className="text-white text-sm truncate">{g.name}</span>
                </button>
              )
            })
          )}
        </div>
        <div className="px-4 pt-2 pb-4 flex items-center justify-end gap-2 border-t border-white/10">
          <button
            onClick={onCancel}
            disabled={submitting}
            className="px-3 py-1.5 rounded-lg text-white/70 hover:text-white text-sm"
          >
            Cancel
          </button>
          <button
            onClick={async () => {
              if (!selected) return
              setSubmitting(true)
              try { await onPick(selected) }
              finally { setSubmitting(false) }
            }}
            disabled={!selected || submitting}
            className="px-3 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-400 disabled:bg-slate-700 disabled:text-white/40 text-white text-sm font-medium"
          >
            {submitting ? 'Sending…' : ctaLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
