import { useState, useEffect, useRef } from 'react'
import type { AuthParams } from '../types/chat'
import { clearProfileCache } from '../services/chat-service'

const PROFILE_API = 'https://smsgway.vegvisr.org/api/auth/profile'
const UPLOAD_API = 'https://api.vegvisr.org/upload'

interface Props {
  auth: AuthParams
  onBack: () => void
}

interface Profile {
  email?: string
  phone?: string
  user_id?: string
  profile_image_url?: string
}

function readLocalDisplayName(): string {
  try {
    const stored = JSON.parse(localStorage.getItem('user') || '{}')
    return stored.display_name || ''
  } catch { return '' }
}

export function ProfileSettings({ auth, onBack }: Props) {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [displayName, setDisplayName] = useState(readLocalDisplayName())
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState<{ text: string; type: 'ok' | 'err' } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setLoading(true)
    fetch(`${PROFILE_API}?user_id=${encodeURIComponent(auth.user_id)}`)
      .then(r => r.json())
      .then(data => {
        if (data.success) {
          setProfile(data)
          // If no local display name, derive from email
          if (!displayName) {
            setDisplayName(data.email?.split('@')[0] || '')
          }
        }
      })
      .catch(() => setMessage({ text: 'Failed to load profile', type: 'err' }))
      .finally(() => setLoading(false))
  }, [auth.user_id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Display name is local-only (API doesn't support it — same as Flutter app)
  const handleSaveName = () => {
    if (!displayName.trim()) return
    setSaving(true)
    setMessage(null)
    try {
      const stored = JSON.parse(localStorage.getItem('user') || '{}')
      stored.display_name = displayName.trim()
      localStorage.setItem('user', JSON.stringify(stored))
      setMessage({ text: 'Display name saved', type: 'ok' })
    } catch {
      setMessage({ text: 'Failed to save', type: 'err' })
    } finally {
      setSaving(false)
    }
  }

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setMessage({ text: 'Image must be under 5MB', type: 'err' })
      return
    }

    setUploading(true)
    setMessage(null)
    try {
      // 1. Upload to R2
      const form = new FormData()
      form.append('file', file)
      const uploadRes = await fetch(UPLOAD_API, { method: 'POST', body: form })
      const uploadData = await uploadRes.json()
      if (!uploadRes.ok || !uploadData.url) throw new Error('Image upload failed')

      // 2. Update profile image via PUT
      const updateRes = await fetch(PROFILE_API, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: auth.user_id,
          phone: auth.phone,
          profile_image_url: uploadData.url,
        }),
      })
      const updateData = await updateRes.json()
      if (!updateRes.ok || !updateData.success) throw new Error(updateData.error || 'Profile update failed')

      setProfile(prev => prev ? { ...prev, profile_image_url: uploadData.url } : prev)
      // Update localStorage
      try {
        const stored = JSON.parse(localStorage.getItem('user') || '{}')
        stored.profileimage = uploadData.url
        localStorage.setItem('user', JSON.stringify(stored))
      } catch { /* ignore */ }
      // Invalidate profile cache so chat messages show new avatar
      clearProfileCache(auth.user_id)
      setMessage({ text: 'Profile image updated', type: 'ok' })
    } catch (err) {
      setMessage({ text: err instanceof Error ? err.message : 'Failed to upload', type: 'err' })
    } finally {
      setUploading(false)
    }
  }

  const initials = (profile?.email || auth.email || '?').charAt(0).toUpperCase()

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10 bg-slate-900/80 flex-shrink-0">
        <button type="button" onClick={onBack} className="text-white/60 hover:text-white text-lg">
          &#x2190;
        </button>
        <h2 className="text-white font-semibold">Profile Settings</h2>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        {loading ? (
          <div className="text-center text-white/40 py-8">Loading profile...</div>
        ) : (
          <div className="max-w-sm mx-auto space-y-8">
            {/* Avatar */}
            <div className="flex flex-col items-center">
              <div className="relative group">
                {profile?.profile_image_url ? (
                  <img
                    src={profile.profile_image_url}
                    alt="Profile"
                    className="w-24 h-24 rounded-full object-cover border-2 border-white/20"
                  />
                ) : (
                  <div className="w-24 h-24 rounded-full bg-sky-600/30 border-2 border-white/20 flex items-center justify-center text-3xl font-bold text-sky-300">
                    {initials}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-sky-600 border-2 border-slate-900 flex items-center justify-center text-white hover:bg-sky-500 transition-colors"
                  title="Change profile image"
                >
                  {uploading ? (
                    <span className="text-xs animate-spin">&#x21BB;</span>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                  )}
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                />
              </div>
              <p className="mt-2 text-xs text-white/40">Tap the camera to change your photo</p>
            </div>

            {/* Display Name (local only — same as Flutter) */}
            <div>
              <label className="block text-xs text-white/50 mb-1.5 uppercase tracking-wider">Display Name</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={displayName}
                  onChange={e => setDisplayName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleSaveName() }}
                  placeholder="Your display name"
                  className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-sky-400/50"
                />
                <button
                  type="button"
                  onClick={handleSaveName}
                  disabled={saving || !displayName.trim()}
                  className="px-4 py-2.5 bg-sky-600 text-white rounded-xl text-sm font-medium disabled:opacity-40 hover:bg-sky-500 transition-colors"
                >
                  {saving ? '...' : 'Save'}
                </button>
              </div>
              <p className="mt-1 text-[11px] text-white/30">Saved locally on this device</p>
            </div>

            {/* Account Info */}
            <div className="space-y-3">
              <label className="block text-xs text-white/50 uppercase tracking-wider">Account Info</label>

              <div className="bg-white/5 border border-white/10 rounded-xl px-4 py-3">
                <div className="text-[11px] text-white/40">Email</div>
                <div className="text-sm text-white/80">{profile?.email || auth.email || '-'}</div>
              </div>

              <div className="bg-white/5 border border-white/10 rounded-xl px-4 py-3">
                <div className="text-[11px] text-white/40">Phone</div>
                <div className="text-sm text-white/80">{profile?.phone || auth.phone || '-'}</div>
              </div>

              <div className="bg-white/5 border border-white/10 rounded-xl px-4 py-3">
                <div className="text-[11px] text-white/40">User ID</div>
                <div className="text-sm text-white/50 font-mono text-xs">{auth.user_id}</div>
              </div>
            </div>

            {/* Status message */}
            {message && (
              <div className={`text-sm px-4 py-2.5 rounded-xl ${
                message.type === 'ok'
                  ? 'bg-emerald-500/10 border border-emerald-400/20 text-emerald-300'
                  : 'bg-rose-500/10 border border-rose-400/20 text-rose-300'
              }`}>
                {message.text}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
