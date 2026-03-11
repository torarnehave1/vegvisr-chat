import { useState, useEffect } from 'react'
import { fetchGroups, createGroup } from '../services/chat-service'
import type { AuthParams, Group } from '../types/chat'

interface Props {
  auth: AuthParams
  onSelectGroup: (group: Group) => void
  selectedGroupId?: string
}

export function GroupList({ auth, onSelectGroup, selectedGroupId }: Props) {
  const [groups, setGroups] = useState<Group[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [showCreate, setShowCreate] = useState(false)

  useEffect(() => {
    fetchGroups(auth)
      .then(g => setGroups(g.sort((a, b) => b.updated_at - a.updated_at)))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [auth])

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
          onClick={() => setShowCreate(!showCreate)}
          className="text-sky-400 hover:text-sky-300 text-sm font-medium"
        >
          + New
        </button>
      </div>

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
          groups.map(g => (
            <button
              key={g.id}
              onClick={() => onSelectGroup(g)}
              className={`w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-white/5 transition-colors border-b border-white/5 ${
                selectedGroupId === g.id ? 'bg-white/10' : ''
              }`}
            >
              {/* Avatar */}
              <div className="w-10 h-10 rounded-full bg-sky-600/30 flex items-center justify-center flex-shrink-0 text-sky-300 font-semibold text-sm">
                {g.image_url ? (
                  <img src={g.image_url} alt="" className="w-full h-full rounded-full object-cover" />
                ) : (
                  g.name.charAt(0).toUpperCase()
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="text-white font-medium text-sm truncate">{g.name}</span>
                  <span className="text-white/30 text-[11px] flex-shrink-0 ml-2">
                    {formatDate(g.updated_at)}
                  </span>
                </div>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  )
}
