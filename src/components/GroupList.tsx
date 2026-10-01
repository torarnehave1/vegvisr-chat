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
      <div className="flex flex-shrink-0 items-center justify-between border-b border-line px-4 py-3">
        <h2 className="text-lg font-semibold text-ink">Chats</h2>
        <button
          type="button"
          onClick={() => setShowCreate(!showCreate)}
          className="flex h-11 items-center rounded-lg px-3 text-sm font-semibold text-brand hover:bg-brand-soft"
        >
          + New
        </button>
      </div>

      {/* Join by invite */}
      <div className="flex flex-col gap-1.5 border-b border-line px-4 py-2">
        <div className="flex gap-2">
          <input
            value={joinInput}
            onChange={e => { setJoinInput(e.target.value); if (joinError) setJoinError(null); }}
            onKeyDown={e => e.key === 'Enter' && handleJoin()}
            placeholder="Paste invite link or code..."
            disabled={joining}
            className="h-11 flex-1 rounded-lg border border-line bg-surface-sunk px-3 text-xs text-ink placeholder:text-ink-faint focus:border-brand focus:outline-none disabled:opacity-50"
          />
          <button
            type="button"
            onClick={handleJoin}
            disabled={joining || !joinInput.trim()}
            className="flex h-11 flex-shrink-0 items-center rounded-lg bg-agent px-4 text-xs font-bold text-agent-ink hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {joining ? '...' : 'Join'}
          </button>
        </div>
        {joinError && <p className="text-[11px] text-danger">{joinError}</p>}
      </div>

      {/* Superadmin: show archived toggle */}
      {isSuperAdmin && (
        <div className="flex items-center gap-2 border-b border-line px-4 py-1.5">
          <label className="flex min-h-11 cursor-pointer items-center gap-2 text-xs text-ink-soft transition-colors hover:text-ink">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={e => setShowArchived(e.target.checked)}
              className="h-4 w-4 rounded border-line bg-surface-sunk text-brand focus:ring-brand/30"
            />
            Show archived groups
          </label>
        </div>
      )}

      {/* Create group */}
      {showCreate && (
        <div className="flex gap-2 border-b border-line px-4 py-2">
          <input
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleCreate()}
            placeholder="Group name..."
            className="h-11 flex-1 rounded-lg border border-line bg-surface-sunk px-3 text-sm text-ink focus:border-brand focus:outline-none"
            autoFocus
          />
          <button
            type="button"
            onClick={handleCreate}
            disabled={!newName.trim() || creating}
            className="flex h-11 flex-shrink-0 items-center rounded-lg bg-brand px-4 text-sm font-semibold text-brand-ink disabled:opacity-40"
          >
            {creating ? '...' : 'Create'}
          </button>
        </div>
      )}

      {/* Group list */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="py-8 text-center text-ink-faint">Loading groups...</div>
        ) : groups.length === 0 ? (
          <div className="px-4 py-8 text-center text-ink-faint">
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
              className={`group flex min-h-[68px] w-full items-center gap-3 border-b border-line px-4 py-3 text-left transition-colors hover:bg-surface-sunk ${
                selectedGroupId === g.id ? 'bg-brand-soft' : ''
              } ${isArchived ? 'opacity-50' : ''}`}
            >
              {/* Avatar */}
              <div className="relative flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-brand-soft text-sm font-semibold text-brand">
                {g.image_url ? (
                  <img src={g.image_url} alt="" className="w-full h-full rounded-full object-cover" />
                ) : (
                  g.name.charAt(0).toUpperCase()
                )}
                {hasUnread && (
                  <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-surface bg-brand" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <span className={`break-words text-sm text-ink ${hasUnread ? 'font-semibold' : 'font-medium'}`}>
                    {g.name}
                    {isArchived && <span className="ml-1.5 text-[10px] font-normal text-notice">(archived)</span>}
                  </span>
                  <span className={`flex-shrink-0 text-[11px] ${hasUnread ? 'font-semibold text-brand' : 'text-ink-faint'}`}>
                    {formatDate(g.updated_at)}
                  </span>
                </div>
                {unansweredPolls[g.id] > 0 && (
                  <div className="flex items-center gap-1 mt-0.5">
                    <span className="rounded-full bg-notice-soft px-1.5 py-px text-[10px] font-semibold text-notice">
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
                    className="flex h-11 min-w-11 flex-shrink-0 items-center justify-center rounded bg-success-soft px-2 text-[10px] font-semibold text-success transition-colors hover:opacity-80"
                    title="Restore group"
                  >
                    {archiving === g.id ? '...' : 'Restore'}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={e => handleArchive(e, g.id)}
                    disabled={archiving === g.id}
                    className="flex h-11 min-w-11 flex-shrink-0 items-center justify-center rounded bg-danger-soft px-2 text-[10px] font-semibold text-danger opacity-0 transition-colors hover:opacity-80 group-hover:opacity-100"
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
