import { useState, useRef, useEffect, useCallback } from 'react'
import { fetchMembers, fetchMemberProfiles, sendGroupAlert } from '../services/chat-service'
import type { AuthParams, Member, MemberProfile } from '../types/chat'

interface Props {
  groupId: string
  auth: AuthParams
  currentUserId: string
}

type SendState = 'idle' | 'sending' | 'sent' | 'error'

export function AlertMenu({ groupId, auth, currentUserId }: Props) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [members, setMembers] = useState<Member[]>([])
  const [profiles, setProfiles] = useState<Map<string, MemberProfile>>(new Map())
  const [isOwner, setIsOwner] = useState(false)
  const [sendState, setSendState] = useState<Record<string, SendState>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const containerRef = useRef<HTMLDivElement>(null)

  const load = useCallback(() => {
    setLoading(true)
    Promise.all([
      fetchMembers(groupId, auth),
      fetchMemberProfiles(groupId, auth),
    ])
      .then(([m, p]) => {
        setMembers(m)
        setProfiles(p)
        setIsOwner(m.find(x => x.user_id === currentUserId)?.role === 'owner')
      })
      .catch(err => console.error('Load members for alerts failed:', err))
      .finally(() => setLoading(false))
  }, [groupId, auth, currentUserId])

  // Load when the menu opens
  useEffect(() => {
    if (open) load()
  }, [open, load])

  // Close on outside click / Escape
  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const handleSend = async (targetUserId: string) => {
    if (sendState[targetUserId] === 'sending') return
    setSendState(prev => ({ ...prev, [targetUserId]: 'sending' }))
    setErrors(prev => { const n = { ...prev }; delete n[targetUserId]; return n })
    try {
      await sendGroupAlert(groupId, targetUserId, auth)
      setSendState(prev => ({ ...prev, [targetUserId]: 'sent' }))
    } catch (err) {
      setSendState(prev => ({ ...prev, [targetUserId]: 'error' }))
      setErrors(prev => ({ ...prev, [targetUserId]: err instanceof Error ? err.message : 'Failed to send' }))
    }
  }

  const alertable = members.filter(m => m.alerts_enabled && m.user_id !== currentUserId)

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => setOpen(o => !o)}
        className="relative text-slate-500 dark:text-white/50 hover:text-slate-900 dark:hover:text-white transition-colors p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-white/10"
        title="Send email alert"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-72 max-h-96 overflow-y-auto bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-xl shadow-xl z-50 p-2">
          <div className="px-2 py-1.5 text-xs uppercase tracking-wider text-slate-400 dark:text-white/40">Email alerts</div>
          {loading ? (
            <div className="px-2 py-3 text-sm text-slate-400 dark:text-white/40">Loading...</div>
          ) : !isOwner ? (
            <div className="px-2 py-3 text-sm text-slate-400 dark:text-white/40">Only the group owner can send email alerts.</div>
          ) : alertable.length === 0 ? (
            <div className="px-2 py-3 text-sm text-slate-400 dark:text-white/40">No members have enabled email alerts yet.</div>
          ) : (
            <div className="space-y-1">
              {alertable.map(m => {
                const profile = profiles.get(m.user_id)
                const displayName = profile?.displayName || m.email || m.user_id.slice(0, 8)
                const initial = displayName.charAt(0).toUpperCase()
                const state = sendState[m.user_id] || 'idle'
                return (
                  <div key={m.user_id} className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5">
                    <div className="w-7 h-7 rounded-full bg-slate-200 dark:bg-white/10 flex items-center justify-center text-slate-500 dark:text-white/50 text-xs overflow-hidden flex-shrink-0">
                      {profile?.profileimage ? (
                        <img src={profile.profileimage} alt="" className="w-full h-full object-cover" />
                      ) : (
                        initial
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-slate-900 dark:text-white text-sm truncate">{displayName}</div>
                      {state === 'error' && errors[m.user_id] && (
                        <div className="text-[11px] text-rose-300 truncate">{errors[m.user_id]}</div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleSend(m.user_id)}
                      disabled={state === 'sending' || state === 'sent'}
                      className={`text-[11px] px-2.5 py-1 rounded-lg flex-shrink-0 transition-colors disabled:opacity-60 ${
                        state === 'sent'
                          ? 'bg-emerald-500/20 text-emerald-300'
                          : state === 'error'
                            ? 'bg-rose-500/20 text-rose-300 hover:bg-rose-500/30'
                            : 'bg-sky-600/20 text-sky-300 hover:bg-sky-600/30'
                      }`}
                    >
                      {state === 'sending' ? '...' : state === 'sent' ? 'Sent' : state === 'error' ? 'Retry' : 'Send alert'}
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
