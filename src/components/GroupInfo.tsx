import { useState, useEffect, useRef, useCallback } from 'react'
import { fetchMembers, fetchMemberProfiles, createInvite, updateGroup, uploadMedia, removeMember, removeBotFromGroup, setMyAlerts } from '../services/chat-service'
import type { AuthParams, Member, MemberProfile, Group } from '../types/chat'

interface Props {
  group: Group
  auth: AuthParams
  onBack: () => void
  onGroupUpdated?: (group: Group) => void
}

export function GroupInfo({ group, auth, onBack, onGroupUpdated }: Props) {
  const [members, setMembers] = useState<Member[]>([])
  const [profiles, setProfiles] = useState<Map<string, MemberProfile>>(new Map())
  const [loading, setLoading] = useState(true)
  const [removing, setRemoving] = useState<string | null>(null)
  const [removeError, setRemoveError] = useState<string | null>(null)
  const [myAlerts, setMyAlertsState] = useState(false)
  const [savingAlerts, setSavingAlerts] = useState(false)
  const [inviteCode, setInviteCode] = useState<string | null>(null)
  const [inviteLoading, setInviteLoading] = useState(false)
  // "Members can post" toggle. The truthy axis is inverted vs the DB column
  // (posting_locked) — checked == unlocked == members can post.
  const [membersCanPost, setMembersCanPost] = useState(!group.posting_locked)
  const [savingPostingLock, setSavingPostingLock] = useState(false)
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(group.name)
  const [saving, setSaving] = useState(false)
  const [imageUrl, setImageUrl] = useState(group.image_url || '')
  const [uploadingImage, setUploadingImage] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const avatarRef = useRef<HTMLDivElement>(null)

  const isOwner = group.created_by === auth.user_id

  const uploadGroupImage = useCallback(async (file: File) => {
    if (uploadingImage || !file.type.startsWith('image/')) return
    setUploadingImage(true)
    try {
      const { media_url } = await uploadMedia(group.id, file, auth)
      const updated = await updateGroup(group.id, { image_url: media_url }, auth)
      setImageUrl(media_url)
      onGroupUpdated?.(updated)
    } catch (err) {
      console.error('Upload group image failed:', err)
    } finally {
      setUploadingImage(false)
    }
  }, [group.id, auth, uploadingImage, onGroupUpdated])

  useEffect(() => {
    let mounted = true
    setLoading(true)
    Promise.all([
      fetchMembers(group.id, auth),
      fetchMemberProfiles(group.id, auth),
    ])
      .then(([m, p]) => {
        if (!mounted) return
        setMembers(m)
        setProfiles(p)
        const me = m.find(x => x.user_id === auth.user_id)
        setMyAlertsState(!!me?.alerts_enabled)
      })
      .catch(err => { console.error('Load members failed:', err) })
      .finally(() => { if (mounted) setLoading(false) })
    return () => { mounted = false }
  }, [group.id, auth])

  const handleTogglePostingLock = async () => {
    if (savingPostingLock) return
    const next = !membersCanPost
    setMembersCanPost(next)  // optimistic
    setSavingPostingLock(true)
    try {
      const updated = await updateGroup(group.id, { posting_locked: !next }, auth)
      onGroupUpdated?.(updated)
    } catch (err) {
      console.error('Save posting lock failed:', err)
      setMembersCanPost(!next)  // revert
    } finally {
      setSavingPostingLock(false)
    }
  }

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

  const handleRemoveMember = async (targetUserId: string, displayName: string) => {
    if (removing) return
    if (!window.confirm(`Remove ${displayName} from this group?`)) return
    setRemoving(targetUserId)
    setRemoveError(null)
    try {
      if (targetUserId.startsWith('bot:')) {
        // Bots live in two tables — group_members (for listing) and
        // group_bot_members (for bot-specific metadata). The bot-remove
        // endpoint cleans up both. Strip the 'bot:' prefix to get the raw id.
        const botId = targetUserId.slice('bot:'.length)
        await removeBotFromGroup(group.id, botId, auth)
      } else {
        await removeMember(group.id, targetUserId, auth)
      }
      setMembers(prev => prev.filter(m => m.user_id !== targetUserId))
      setProfiles(prev => {
        const next = new Map(prev)
        next.delete(targetUserId)
        return next
      })
    } catch (err) {
      setRemoveError(err instanceof Error ? err.message : 'Failed to remove member')
    } finally {
      setRemoving(null)
    }
  }

  const handleToggleAlerts = async () => {
    if (savingAlerts) return
    const next = !myAlerts
    setSavingAlerts(true)
    setMyAlertsState(next)  // optimistic
    try {
      await setMyAlerts(group.id, next, auth)
      // Keep the members list in sync so the owner's view is accurate.
      setMembers(prev => prev.map(m =>
        m.user_id === auth.user_id ? { ...m, alerts_enabled: next ? 1 : 0 } : m
      ))
    } catch (err) {
      console.error('Update alert preference failed:', err)
      setMyAlertsState(!next)  // revert
    } finally {
      setSavingAlerts(false)
    }
  }

  const handleSaveName = async () => {
    if (!name.trim() || saving) return
    setSaving(true)
    try {
      const updated = await updateGroup(group.id, { name: name.trim() }, auth)
      setEditing(false)
      onGroupUpdated?.(updated)
    } catch (err) {
      console.error('Update group failed:', err)
    } finally {
      setSaving(false)
    }
  }

  const handleImagePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    await uploadGroupImage(file)
    if (imageInputRef.current) imageInputRef.current.value = ''
  }

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOver(false)
    if (!isOwner || uploadingImage) return

    // Direct file drop (from Finder/desktop/Photos app)
    const file = e.dataTransfer.files?.[0]
    if (file && file.type.startsWith('image/')) {
      await uploadGroupImage(file)
      return
    }

    // Dropped image URL from browser (e.g. drag from web page)
    const html = e.dataTransfer.getData('text/html')
    if (html) {
      const match = html.match(/<img[^>]+src=["']([^"']+)["']/)
      if (match?.[1]) {
        try {
          const resp = await fetch(match[1])
          const blob = await resp.blob()
          const ext = blob.type.split('/')[1] || 'png'
          const imgFile = new File([blob], `group-image.${ext}`, { type: blob.type })
          await uploadGroupImage(imgFile)
        } catch (err) {
          console.error('Failed to fetch dropped image URL:', err)
        }
        return
      }
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (isOwner) setDragOver(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOver(false)
  }

  // Paste handler — listen on the whole component when owner
  useEffect(() => {
    if (!isOwner) return
    const handlePaste = async (e: ClipboardEvent) => {
      const items = e.clipboardData?.items
      if (!items) return
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          e.preventDefault()
          const file = item.getAsFile()
          if (file) await uploadGroupImage(file)
          return
        }
      }
    }
    document.addEventListener('paste', handlePaste)
    return () => document.removeEventListener('paste', handlePaste)
  }, [isOwner, uploadGroupImage])

  const handleRemoveImage = async () => {
    if (uploadingImage) return
    setUploadingImage(true)
    try {
      const updated = await updateGroup(group.id, { image_url: '' }, auth)
      setImageUrl('')
      onGroupUpdated?.(updated)
    } catch (err) {
      console.error('Remove group image failed:', err)
    } finally {
      setUploadingImage(false)
    }
  }

  const inviteUrl = inviteCode
    ? `${window.location.origin}?invite=${inviteCode}`
    : null

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-line flex-shrink-0">
        <button onClick={onBack} className="text-ink-soft hover:text-ink text-lg">&#x2190;</button>
        <h2 className="text-ink font-semibold">Group Info</h2>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6">
        {/* Group avatar */}
        <div className="flex flex-col items-center">
          <div
            ref={avatarRef}
            className="relative"
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
          >
            <div className={`w-20 h-20 rounded-full bg-brand/30 flex items-center justify-center text-brand text-2xl font-semibold overflow-hidden transition-all ${
 dragOver ? 'ring-2 ring-brand ring-offset-2 ring-offset-slate-900 scale-110' : ''
 }`}>
              {imageUrl ? (
                <img src={imageUrl} alt={group.name} className="w-full h-full object-cover" />
              ) : (
                group.name.charAt(0).toUpperCase()
              )}
              {uploadingImage && (
                <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center">
                  <span className="text-ink text-xs">...</span>
                </div>
              )}
              {dragOver && !uploadingImage && (
                <div className="absolute inset-0 bg-brand/30 rounded-full flex items-center justify-center">
                  <span className="text-ink text-xs font-medium">Drop</span>
                </div>
              )}
            </div>
            {isOwner && (
              <button
                type="button"
                onClick={() => imageInputRef.current?.click()}
                disabled={uploadingImage}
                className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-brand flex items-center justify-center text-white text-xs hover:bg-brand-strong transition-colors border-2 border-line"
                title="Change group photo"
              >
                &#x1F4F7;
              </button>
            )}
          </div>
          <input
            ref={imageInputRef}
            type="file"
            accept="image/*"
            onChange={handleImagePick}
            className="hidden"
            title="Choose group photo"
          />
          {isOwner && (
            <div className="flex flex-col items-center">
              <span className="text-[10px] text-ink-faint mt-1.5">Drop or paste an image</span>
              {imageUrl && (
                <button
                  type="button"
                  onClick={handleRemoveImage}
                  disabled={uploadingImage}
                  className="text-[11px] text-danger/70 hover:text-danger mt-1 transition-colors"
                >
                  Remove photo
                </button>
              )}
            </div>
          )}
        </div>

        {/* Group name */}
        <div>
          <label className="text-ink-faint text-xs uppercase tracking-wider">Name</label>
          {editing ? (
            <div className="flex gap-2 mt-1">
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                className="flex-1 bg-surface-sunk border border-line rounded-lg px-3 py-1.5 text-ink text-sm focus:outline-none focus:border-brand"
              />
              <button onClick={handleSaveName} disabled={saving} className="text-brand text-sm">
                {saving ? '...' : 'Save'}
              </button>
              <button onClick={() => { setEditing(false); setName(group.name) }} className="text-ink-faint text-sm">
                Cancel
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 mt-1">
              <span className="text-ink text-lg">{name}</span>
              {isOwner && (
                <button onClick={() => setEditing(true)} className="text-ink-faint hover:text-ink text-sm">
                  &#x270E;
                </button>
              )}
            </div>
          )}
        </div>

        {/* Invite */}
        <div>
          <label className="text-ink-faint text-xs uppercase tracking-wider">Invite Link</label>
          {inviteUrl ? (
            <div className="mt-1 flex items-center gap-2">
              <code className="text-brand text-sm bg-surface-sunk px-2 py-1 rounded flex-1 truncate">
                {inviteUrl}
              </code>
              <button
                onClick={() => navigator.clipboard.writeText(inviteUrl)}
                className="text-brand text-sm hover:text-brand"
              >
                Copy
              </button>
            </div>
          ) : (
            <button
              onClick={handleInvite}
              disabled={inviteLoading}
              className="mt-1 px-4 py-2 bg-brand/20 text-brand rounded-lg text-sm hover:bg-brand/30 transition-colors"
            >
              {inviteLoading ? 'Creating...' : 'Create Invite Link'}
            </button>
          )}
        </div>

        {/* Email alerts opt-in (per-user, per-group) */}
        <div>
          <label className="text-ink-faint text-xs uppercase tracking-wider">Email Alerts</label>
          <button
            type="button"
            onClick={handleToggleAlerts}
            disabled={savingAlerts}
            className="mt-2 w-full flex items-center justify-between gap-3 bg-surface-sunk border border-line rounded-xl px-4 py-3 text-left hover:bg-white/[0.07] transition-colors disabled:opacity-50"
          >
            <span className="min-w-0">
              <span className="block text-sm text-ink-soft">Receive email alerts</span>
              <span className="block text-[11px] text-ink-faint">
                Let the group owner email you when there's new activity here.
              </span>
            </span>
            <span
              className={`relative inline-flex h-6 w-11 flex-shrink-0 rounded-full transition-colors ${
 myAlerts ? 'bg-brand' : 'bg-white/15'
 }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
 myAlerts ? 'translate-x-5' : 'translate-x-0'
 }`}
              />
            </span>
          </button>
        </div>

        {/* Owner-only: lock posting for a broadcast / announcement channel */}
        {isOwner && (
          <div>
            <label className="text-ink-faint text-xs uppercase tracking-wider">Posting</label>
            <button
              type="button"
              onClick={handleTogglePostingLock}
              disabled={savingPostingLock}
              className="mt-2 w-full flex items-center justify-between gap-3 bg-surface-sunk border border-line rounded-xl px-4 py-3 text-left hover:bg-white/[0.07] transition-colors disabled:opacity-50"
            >
              <span className="min-w-0">
                <span className="block text-sm text-ink-soft">Members can post</span>
                <span className="block text-[11px] text-ink-faint">
                  Turn off to make this an announcement channel — only you can send messages. Members still react and can submit questions.
                </span>
              </span>
              <span
                className={`relative inline-flex h-6 w-11 flex-shrink-0 rounded-full transition-colors ${
 membersCanPost ? 'bg-brand' : 'bg-notice'
 }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
 membersCanPost ? 'translate-x-5' : 'translate-x-0'
 }`}
                />
              </span>
            </button>
          </div>
        )}

        {/* Members */}
        <div>
          <label className="text-ink-faint text-xs uppercase tracking-wider">
            Members ({members.length})
          </label>
          {removeError && (
            <p className="text-xs text-danger mt-1">{removeError}</p>
          )}
          {loading ? (
            <p className="text-ink-faint text-sm mt-2">Loading...</p>
          ) : (
            <div className="mt-2 space-y-2">
              {members.map(m => {
                const profile = profiles.get(m.user_id)
                const displayName = profile?.displayName || m.email || m.phone || m.user_id.slice(0, 8)
                const subtitle = profile?.email || m.email || profile?.phone || m.phone || ''
                const initial = displayName.charAt(0).toUpperCase()
                const canRemove =
                  isOwner &&
                  m.user_id !== auth.user_id &&
                  m.role !== 'owner'
                return (
                  <div key={m.user_id} className="flex items-center gap-3 py-1.5">
                    <div className="w-8 h-8 rounded-full bg-surface-sunk flex items-center justify-center text-ink-soft text-sm overflow-hidden flex-shrink-0">
                      {profile?.profileimage ? (
                        <img src={profile.profileimage} alt="" className="w-full h-full object-cover" />
                      ) : (
                        initial
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-ink text-sm truncate">
                        {displayName}
                        {subtitle && subtitle !== displayName && (
                          <span className="text-ink-faint text-xs ml-2">{subtitle}</span>
                        )}
                      </div>
                      <div className="text-ink-faint text-xs">{m.role}</div>
                    </div>
                    {canRemove && (
                      <button
                        type="button"
                        onClick={() => handleRemoveMember(m.user_id, displayName)}
                        disabled={removing === m.user_id}
                        className="text-[10px] px-2 py-1 rounded bg-danger-soft text-danger hover:opacity-90 transition-colors flex-shrink-0 disabled:opacity-50"
                        title={`Remove ${displayName}`}
                      >
                        {removing === m.user_id ? '...' : 'Remove'}
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
