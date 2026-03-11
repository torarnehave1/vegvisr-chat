import { useState, useEffect } from 'react'
import { fetchMembers, createInvite, updateGroup } from '../services/chat-service'
import type { AuthParams, Member, Group } from '../types/chat'

interface Props {
  group: Group
  auth: AuthParams
  onBack: () => void
}

export function GroupInfo({ group, auth, onBack }: Props) {
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [inviteCode, setInviteCode] = useState<string | null>(null)
  const [inviteLoading, setInviteLoading] = useState(false)
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(group.name)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetchMembers(group.id, auth)
      .then(setMembers)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [group.id, auth])

  const handleInvite = async () => {
    setInviteLoading(true)
    try {
      const invite = await createInvite(group.id, auth)
      setInviteCode(invite.code)
    } catch (err) {
      console.error('Create invite failed:', err)
    } finally {
      setInviteLoading(false)
    }
  }

  const handleSaveName = async () => {
    if (!name.trim() || saving) return
    setSaving(true)
    try {
      await updateGroup(group.id, { name: name.trim() }, auth)
      setEditing(false)
    } catch (err) {
      console.error('Update group failed:', err)
    } finally {
      setSaving(false)
    }
  }

  const inviteUrl = inviteCode
    ? `${window.location.origin}?invite=${inviteCode}`
    : null

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10 flex-shrink-0">
        <button onClick={onBack} className="text-white/60 hover:text-white text-lg">&#x2190;</button>
        <h2 className="text-white font-semibold">Group Info</h2>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6">
        {/* Group name */}
        <div>
          <label className="text-white/40 text-xs uppercase tracking-wider">Name</label>
          {editing ? (
            <div className="flex gap-2 mt-1">
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:border-sky-400/50"
              />
              <button onClick={handleSaveName} disabled={saving} className="text-sky-400 text-sm">
                {saving ? '...' : 'Save'}
              </button>
              <button onClick={() => { setEditing(false); setName(group.name) }} className="text-white/40 text-sm">
                Cancel
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 mt-1">
              <span className="text-white text-lg">{name}</span>
              {group.created_by === auth.user_id && (
                <button onClick={() => setEditing(true)} className="text-white/30 hover:text-white text-sm">
                  &#x270E;
                </button>
              )}
            </div>
          )}
        </div>

        {/* Invite */}
        <div>
          <label className="text-white/40 text-xs uppercase tracking-wider">Invite Link</label>
          {inviteUrl ? (
            <div className="mt-1 flex items-center gap-2">
              <code className="text-sky-300 text-sm bg-white/5 px-2 py-1 rounded flex-1 truncate">
                {inviteUrl}
              </code>
              <button
                onClick={() => navigator.clipboard.writeText(inviteUrl)}
                className="text-sky-400 text-sm hover:text-sky-300"
              >
                Copy
              </button>
            </div>
          ) : (
            <button
              onClick={handleInvite}
              disabled={inviteLoading}
              className="mt-1 px-4 py-2 bg-sky-600/20 text-sky-300 rounded-lg text-sm hover:bg-sky-600/30 transition-colors"
            >
              {inviteLoading ? 'Creating...' : 'Create Invite Link'}
            </button>
          )}
        </div>

        {/* Members */}
        <div>
          <label className="text-white/40 text-xs uppercase tracking-wider">
            Members ({members.length})
          </label>
          {loading ? (
            <p className="text-white/30 text-sm mt-2">Loading...</p>
          ) : (
            <div className="mt-2 space-y-2">
              {members.map(m => (
                <div key={m.user_id} className="flex items-center gap-3 py-1.5">
                  <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white/50 text-sm">
                    {(m.email || m.phone || '?').charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-white text-sm truncate">{m.email || m.phone}</div>
                    <div className="text-white/30 text-xs">{m.role}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
