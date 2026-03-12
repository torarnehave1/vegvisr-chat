import { useState, useEffect, useCallback } from 'react'
import { fetchGroups, createGroup, archiveGroup, restoreGroup } from '../services/chat-service'
import type { AuthParams, Group } from '../types/chat'

interface Props {
  auth: AuthParams
  userRole?: string | null
  onSelectGroup: (group: Group) => void
  selectedGroupId?: string
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

export function GroupList({ auth, userRole, onSelectGroup, selectedGroupId }: Props) {
  const [groups, setGroups] = useState<Group[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [showArchived, setShowArchived] = useState(false)
  const [archiving, setArchiving] = useState<string | null>(null)

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
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 flex-shrink-0">
        <h2 className="text-white font-semibold text-lg">Chats</h2>
        <button
          type="button"
          onClick={() => setShowCreate(!showCreate)}
          className="text-sky-400 hover:text-sky-300 text-sm font-medium"
        >
          + New
        </button>
      </div>

      {/* Superadmin: show archived toggle */}
      {isSuperAdmin && (
        <div className="px-4 py-1.5 border-b border-white/10 flex items-center gap-2">
          <label className="flex items-center gap-2 cursor-pointer text-xs text-white/50 hover:text-white/70 transition-colors">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={e => setShowArchived(e.target.checked)}
              className="rounded border-white/20 bg-white/5 text-sky-500 focus:ring-sky-500/30"
            />
            Show archived groups
          </label>
        </div>
      )}

      {/* Create group */}
      {showCreate && (
        <div className="px-4 py-2 border-b border-white/10 flex gap-2">
          <input
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleCreate()}
            placeholder="Group name..."
            className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:border-sky-400/50"
            autoFocus
          />
          <button
            type="button"
            onClick={handleCreate}
            disabled={!newName.trim() || creating}
            className="px-3 py-1.5 bg-sky-600 text-white rounded-lg text-sm disabled:opacity-40"
          >
            {creating ? '...' : 'Create'}
          </button>
        </div>
      )}

      {/* Group list */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="text-center text-white/40 py-8">Loading groups...</div>
        ) : groups.length === 0 ? (
          <div className="text-center text-white/30 py-8 px-4">
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
              className={`group w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-white/5 transition-colors border-b border-white/5 ${
                selectedGroupId === g.id ? 'bg-white/10' : ''
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
                  <span className={`text-sm truncate ${hasUnread ? 'text-white font-semibold' : 'text-white font-medium'}`}>
                    {g.name}
                    {isArchived && <span className="ml-1.5 text-[10px] text-amber-400/70 font-normal">(archived)</span>}
                  </span>
                  <span className={`text-[11px] flex-shrink-0 ml-2 ${hasUnread ? 'text-sky-400' : 'text-white/30'}`}>
                    {formatDate(g.updated_at)}
                  </span>
                </div>
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
