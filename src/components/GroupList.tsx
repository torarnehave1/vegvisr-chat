import { useState, useEffect, useCallback, useRef } from 'react'
import { fetchGroups, createGroup, archiveGroup, restoreGroup, fetchUnansweredPollCount, joinInvite } from '../services/chat-service'
import type { AuthParams, Group } from '../types/chat'

export const INVITE_STORAGE_KEY = 'pending_invite_code'

interface Props {
  auth: AuthParams
  userRole?: string | null
  onSelectGroup: (group: Group) => void
  selectedGroupId?: string
  deepLinkGroupId?: string | null
  onDeepLinkConsumed?: () => void
}

function parseInviteCode(input: string): string | null {
  const trimmed = input.trim()
  if (!trimmed) return null
  try {
    const url = new URL(trimmed)
    const code = url.searchParams.get('invite')
    if (code) return code
  } catch { /* not a URL — treat as raw code */ }
  return trimmed
}

function getLastRead(groupId: string): number {
  try {
    const stored = JSON.parse(localStorage.getItem('chat_last_read') || '{}')
    return stored[groupId] || 0
  } catch { return 0 }
}

export function markGroupRead(groupId: string) {
  try {
    const stored = JSON.parse(localStorage.getItem('chat_last_read') || '{}')
    stored[groupId] = Date.now()
    localStorage.setItem('chat_last_read', JSON.stringify(stored))
  } catch { /* ignore */ }
}

export function GroupList({ auth, userRole, onSelectGroup, selectedGroupId, deepLinkGroupId, onDeepLinkConsumed }: Props) {
  const [groups, setGroups] = useState<Group[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [showArchived, setShowArchived] = useState(false)
  const [archiving, setArchiving] = useState<string | null>(null)
  const [unansweredPolls, setUnansweredPolls] = useState<Record<string, number>>({})
  const [joinInput, setJoinInput] = useState('')
  const [joining, setJoining] = useState(false)
  const [joinError, setJoinError] = useState<string | null>(null)
  const inviteAttempted = useRef(false)

  const isSuperAdmin = userRole === 'Superadmin'

  const loadGroups = useCallback(() => {
    fetchGroups(auth, { includeArchived: showArchived && isSuperAdmin })
      .then(g => setGroups(g.sort((a, b) => b.updated_at - a.updated_at)))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [auth, showArchived, isSuperAdmin])

  useEffect(() => {
    loadGroups()
    const interval = setInterval(loadGroups, 30000)
    return () => clearInterval(interval)
  }, [loadGroups])

  // Deep-link: once groups are loaded, open the one named in ?group=<id> (from an
  // email alert link). Consume once so it doesn't re-fire on later refreshes.
  const deepLinkConsumed = useRef(false)
  useEffect(() => {
    if (deepLinkConsumed.current || !deepLinkGroupId || groups.length === 0) return
    const target = groups.find(g => g.id === deepLinkGroupId)
    if (!target) return
    deepLinkConsumed.current = true
    markGroupRead(target.id)
    onSelectGroup(target)
    onDeepLinkConsumed?.()
  }, [deepLinkGroupId, groups, onSelectGroup, onDeepLinkConsumed])

  // Fetch unanswered poll counts for active groups
  useEffect(() => {
    const activeGroups = groups.filter(g => !(g.archived_at && g.archived_at > 0))
    if (activeGroups.length === 0) return
    Promise.allSettled(
      activeGroups.map(async g => {
        const count = await fetchUnansweredPollCount(g.id, auth)
        return { id: g.id, count }
      })
    ).then(results => {
      const counts: Record<string, number> = {}
      for (const r of results) {
        if (r.status === 'fulfilled' && r.value.count > 0) {
          counts[r.value.id] = r.value.count
        }
      }
      setUnansweredPolls(counts)
    })
  }, [groups, auth])

  const handleCreate = async () => {
    if (!newName.trim() || creating) return
    setCreating(true)
    try {
      const group = await createGroup(newName.trim(), auth)
      setGroups(prev => [group, ...prev])
      setNewName('')
      setShowCreate(false)
      onSelectGroup(group)
    } catch (err) {
      console.error('Create group failed:', err)
    } finally {
      setCreating(false)
    }
  }

  const runJoin = useCallback(async (code: string) => {
    setJoining(true)
    setJoinError(null)
    try {
      const result = await joinInvite(code, auth)
      try { sessionStorage.removeItem(INVITE_STORAGE_KEY) } catch { /* ignore */ }
      const fresh = await fetchGroups(auth, { includeArchived: showArchived && isSuperAdmin })
      const sorted = fresh.sort((a, b) => b.updated_at - a.updated_at)
      setGroups(sorted)
      setJoinInput('')
      const joined = sorted.find(g => g.id === result.group_id)
      if (joined) {
        onSelectGroup(joined)
      } else {
        setJoinError('Joined, but the group did not appear in your list. Try refreshing.')
      }
    } catch (err) {
      setJoinError(err instanceof Error ? err.message : 'Failed to join group')
    } finally {
      setJoining(false)
    }
  }, [auth, onSelectGroup, showArchived, isSuperAdmin])

  const handleJoin = () => {
    const code = parseInviteCode(joinInput)
    if (!code || joining) {
      if (!code) setJoinError('Paste an invite link or code')
      return
    }
    runJoin(code)
  }

  useEffect(() => {
    if (inviteAttempted.current) return
    let code: string | null = null
    try { code = sessionStorage.getItem(INVITE_STORAGE_KEY) } catch { /* ignore */ }
    if (!code) return
    inviteAttempted.current = true
    runJoin(code)
  }, [runJoin])

  const handleArchive = async (e: React.MouseEvent, groupId: string) => {
    e.stopPropagation()
    if (archiving) return
    setArchiving(groupId)
    try {
      await archiveGroup(groupId, auth)
      setGroups(prev => prev.filter(g => g.id !== groupId))
    } catch (err) {
      console.error('Archive failed:', err)
    } finally {
      setArchiving(null)
    }
  }

  const handleRestore = async (e: React.MouseEvent, groupId: string) => {
    e.stopPropagation()
    if (archiving) return
    setArchiving(groupId)
    try {
      await restoreGroup(groupId, auth)
      setGroups(prev => prev.map(g =>
        g.id === groupId ? { ...g, archived_at: null, archived_by: null } : g
      ))
    } catch (err) {
      console.error('Restore failed:', err)
    } finally {
      setArchiving(null)
    }
  }

  function formatDate(ts: number): string {
    const d = new Date(ts)
    const now = new Date()
    if (d.toDateString() === now.toDateString()) {
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-white/10 flex-shrink-0">
        <h2 className="text-slate-900 dark:text-white font-semibold text-lg">Chats</h2>
        <button
          type="button"
          onClick={() => setShowCreate(!showCreate)}
          className="text-sky-400 hover:text-sky-300 text-sm font-medium"
        >
          + New
        </button>
      </div>

      {/* Join by invite */}
      <div className="px-4 py-2 border-b border-slate-200 dark:border-white/10 flex flex-col gap-1.5">
        <div className="flex gap-2">
          <input
            value={joinInput}
            onChange={e => { setJoinInput(e.target.value); if (joinError) setJoinError(null); }}
            onKeyDown={e => e.key === 'Enter' && handleJoin()}
            placeholder="Paste invite link or code..."
            disabled={joining}
            className="flex-1 bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg px-3 py-1.5 text-slate-900 dark:text-white text-xs focus:outline-none focus:border-sky-400/50 placeholder:text-slate-400 dark:placeholder:text-white/30 disabled:opacity-50"
          />
          <button
            type="button"
            onClick={handleJoin}
            disabled={joining || !joinInput.trim()}
            className="px-3 py-1.5 bg-violet-600 hover:bg-violet-500 text-slate-900 dark:text-white rounded-lg text-xs font-bold disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {joining ? '...' : 'Join'}
          </button>
        </div>
        {joinError && <p className="text-[11px] text-rose-300">{joinError}</p>}
      </div>

      {/* Superadmin: show archived toggle */}
      {isSuperAdmin && (
        <div className="px-4 py-1.5 border-b border-slate-200 dark:border-white/10 flex items-center gap-2">
          <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-500 dark:text-white/50 hover:text-slate-600 dark:hover:text-white/70 transition-colors">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={e => setShowArchived(e.target.checked)}
              className="rounded border-slate-300 dark:border-white/20 bg-slate-100 dark:bg-white/5 text-sky-500 focus:ring-sky-500/30"
            />
            Show archived groups
          </label>
        </div>
      )}

      {/* Create group */}
      {showCreate && (
        <div className="px-4 py-2 border-b border-slate-200 dark:border-white/10 flex gap-2">
          <input
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleCreate()}
            placeholder="Group name..."
            className="flex-1 bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg px-3 py-1.5 text-slate-900 dark:text-white text-sm focus:outline-none focus:border-sky-400/50"
            autoFocus
          />
          <button
            type="button"
            onClick={handleCreate}
            disabled={!newName.trim() || creating}
            className="px-3 py-1.5 bg-sky-600 text-slate-900 dark:text-white rounded-lg text-sm disabled:opacity-40"
          >
            {creating ? '...' : 'Create'}
          </button>
        </div>
      )}

      {/* Group list */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="text-center text-slate-400 dark:text-white/40 py-8">Loading groups...</div>
        ) : groups.length === 0 ? (
          <div className="text-center text-slate-400 dark:text-white/30 py-8 px-4">
            <p>No groups yet.</p>
            <p className="text-sm mt-1">Create one to start chatting!</p>
          </div>
        ) : (
          groups.map(g => {
            const isArchived = !!(g.archived_at && g.archived_at > 0)
            const hasUnread = !isArchived && g.updated_at > getLastRead(g.id) && selectedGroupId !== g.id
            return (
            <button
              type="button"
              key={g.id}
              onClick={() => { markGroupRead(g.id); onSelectGroup(g) }}
              className={`group w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors border-b border-slate-200 dark:border-white/5 ${
                selectedGroupId === g.id ? 'bg-slate-200 dark:bg-white/10' : ''
              } ${isArchived ? 'opacity-50' : ''}`}
            >
              {/* Avatar */}
              <div className="relative w-10 h-10 rounded-full bg-sky-600/30 flex items-center justify-center flex-shrink-0 text-sky-300 font-semibold text-sm">
                {g.image_url ? (
                  <img src={g.image_url} alt="" className="w-full h-full rounded-full object-cover" />
                ) : (
                  g.name.charAt(0).toUpperCase()
                )}
                {hasUnread && (
                  <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-sky-500 rounded-full border-2 border-slate-900" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className={`text-sm truncate ${hasUnread ? 'text-slate-900 dark:text-white font-semibold' : 'text-slate-900 dark:text-white font-medium'}`}>
                    {g.name}
                    {isArchived && <span className="ml-1.5 text-[10px] text-amber-400/70 font-normal">(archived)</span>}
                  </span>
                  <span className={`text-[11px] flex-shrink-0 ml-2 ${hasUnread ? 'text-sky-400' : 'text-slate-400 dark:text-white/30'}`}>
                    {formatDate(g.updated_at)}
                  </span>
                </div>
                {unansweredPolls[g.id] > 0 && (
                  <div className="flex items-center gap-1 mt-0.5">
                    <span className="text-[10px] text-amber-300/80 bg-amber-500/15 px-1.5 py-px rounded-full">
                      {unansweredPolls[g.id]} unanswered poll{unansweredPolls[g.id] > 1 ? 's' : ''}
                    </span>
                  </div>
                )}
              </div>
              {/* Superadmin: archive/restore button */}
              {isSuperAdmin && (
                isArchived ? (
                  <button
                    type="button"
                    onClick={e => handleRestore(e, g.id)}
                    disabled={archiving === g.id}
                    className="text-[10px] px-2 py-1 rounded bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 transition-colors flex-shrink-0"
                    title="Restore group"
                  >
                    {archiving === g.id ? '...' : 'Restore'}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={e => handleArchive(e, g.id)}
                    disabled={archiving === g.id}
                    className="text-[10px] px-2 py-1 rounded bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 transition-colors flex-shrink-0 opacity-0 group-hover:opacity-100"
                    title="Archive group"
                  >
                    {archiving === g.id ? '...' : 'Archive'}
                  </button>
                )
              )}
            </button>
            )
          }))
        }
      </div>
    </div>
  )
}
