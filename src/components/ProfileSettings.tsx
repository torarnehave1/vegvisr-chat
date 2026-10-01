import { useState, useEffect, useRef } from 'react'
import type { AuthParams } from '../types/chat'
import { clearProfileCache } from '../services/chat-service'
import { getThemePref, setThemePref, type ThemePref } from '../services/theme-service'

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
  const [theme, setTheme] = useState<ThemePref>(() => getThemePref())
  const fileRef = useRef<HTMLInputElement>(null)

  const handleThemeChange = (next: ThemePref) => {
    setTheme(next)
    setThemePref(next)
  }

  useEffect(() => {
    setLoading(true)
    fetch(`${PROFILE_API}?user_id=${encodeURIComponent(auth.user_id)}`)
      .then(r => r.json())
      .then(data => {
        if (data.success) {
          setProfile(data)
          // Use server display_name, then local, then derive from email
          if (!displayName) {
            setDisplayName(data.display_name || data.email?.split('@')[0] || '')
          }
        }
      })
      .catch(() => setMessage({ text: 'Failed to load profile', type: 'err' }))
      .finally(() => setLoading(false))
  }, [auth.user_id]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSaveName = async () => {
    if (!displayName.trim()) return
    setSaving(true)
    setMessage(null)
    try {
      // Save to server
      const res = await fetch(PROFILE_API, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: auth.user_id,
          phone: auth.phone,
          display_name: displayName.trim(),
        }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to save')

      // Also save locally for fast access
      const stored = JSON.parse(localStorage.getItem('user') || '{}')
      stored.display_name = displayName.trim()
      localStorage.setItem('user', JSON.stringify(stored))

      // Invalidate profile cache so chat picks up the new name
      clearProfileCache(auth.user_id)
      setMessage({ text: 'Display name saved', type: 'ok' })
    } catch (err) {
      setMessage({ text: err instanceof Error ? err.message : 'Failed to save', type: 'err' })
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
      const imageUrl = uploadData.urls?.[0] || uploadData.url
      if (!uploadRes.ok || !imageUrl) throw new Error('Image upload failed')

      // 2. Update profile image via PUT
      const updateRes = await fetch(PROFILE_API, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: auth.user_id,
          phone: auth.phone,
          profile_image_url: imageUrl,
        }),
      })
      const updateData = await updateRes.json()
      if (!updateRes.ok || !updateData.success) throw new Error(updateData.error || 'Profile update failed')

      setProfile(prev => prev ? { ...prev, profile_image_url: imageUrl } : prev)
      // Update localStorage
      try {
        const stored = JSON.parse(localStorage.getItem('user') || '{}')
        stored.profileimage = imageUrl
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
      <div className="flex items-center gap-3 px-4 py-3 border-b border-line bg-surface flex-shrink-0">
        <button type="button" onClick={onBack} className="text-ink-soft hover:text-ink text-lg">
          &#x2190;
        </button>
        <h2 className="text-ink font-semibold">Profile Settings</h2>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        {loading ? (
          <div className="text-center text-ink-faint py-8">Loading profile...</div>
        ) : (
          <div className="max-w-sm mx-auto space-y-8">
            {/* Avatar */}
            <div className="flex flex-col items-center">
              <div className="relative group">
                {profile?.profile_image_url ? (
                  <img
                    src={profile.profile_image_url}
                    alt="Profile"
                    className="w-24 h-24 rounded-full object-cover border-2 border-line"
                  />
                ) : (
                  <div className="w-24 h-24 rounded-full bg-brand/30 border-2 border-line flex items-center justify-center text-3xl font-bold text-brand">
                    {initials}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-brand border-2 border-line flex items-center justify-center text-white hover:bg-brand-strong transition-colors"
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
              <p className="mt-2 text-xs text-ink-faint">Tap the camera to change your photo</p>
            </div>

            {/* Display Name (local only — same as Flutter) */}
            <div>
              <label className="block text-xs text-ink-soft mb-1.5 uppercase tracking-wider">Display Name</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={displayName}
                  onChange={e => setDisplayName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleSaveName() }}
                  placeholder="Your display name"
                  className="flex-1 bg-surface-sunk border border-line rounded-xl px-3 py-2.5 text-ink text-sm focus:outline-none focus:border-brand"
                />
                <button
                  type="button"
                  onClick={handleSaveName}
                  disabled={saving || !displayName.trim()}
                  className="px-4 py-2.5 bg-brand text-brand-ink rounded-xl text-sm font-medium disabled:opacity-40 hover:bg-brand-strong transition-colors"
                >
                  {saving ? '...' : 'Save'}
                </button>
              </div>
              <p className="mt-1 text-[11px] text-ink-faint">Visible to other group members</p>
            </div>

            {/* Account Info */}
            <div className="space-y-3">
              <label className="block text-xs text-ink-soft uppercase tracking-wider">Account Info</label>

              <div className="bg-surface-sunk border border-line rounded-xl px-4 py-3">
                <div className="text-[11px] text-ink-faint">Email</div>
                <div className="text-sm text-ink-soft">{profile?.email || auth.email || '-'}</div>
              </div>

              <div className="bg-surface-sunk border border-line rounded-xl px-4 py-3">
                <div className="text-[11px] text-ink-faint">Phone</div>
                <div className="text-sm text-ink-soft">{profile?.phone || auth.phone || '-'}</div>
              </div>

              <div className="bg-surface-sunk border border-line rounded-xl px-4 py-3">
                <div className="text-[11px] text-ink-faint">User ID</div>
                <div className="text-sm text-ink-soft font-mono text-xs">{auth.user_id}</div>
              </div>
            </div>

            {/* Appearance — Light / Dark / System theme picker. The actual
                class toggle happens in theme-service.setThemePref; this
                section is just the UI shell. */}
            <div className="space-y-2">
              <label className="block text-xs text-ink-soft uppercase tracking-wider">Appearance</label>
              <div className="grid grid-cols-3 gap-2">
                {(['light', 'dark', 'system'] as const).map(opt => {
                  const active = theme === opt
                  const label = opt === 'system' ? 'System' : opt === 'light' ? 'Light' : 'Dark'
                  return (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => handleThemeChange(opt)}
                      className={`px-3 py-2.5 rounded-xl text-sm font-medium transition-colors border ${
 active
 ? 'bg-brand text-brand-ink border-brand'
 : 'bg-surface-sunk border-line text-ink-soft hover:bg-surface-sunk'
 }`}
                    >
                      {label}
                    </button>
                  )
                })}
              </div>
              <p className="text-[11px] text-ink-faint">System follows your OS preference.</p>
            </div>

            {/* Status message */}
            {message && (
              <div className={`text-sm px-4 py-2.5 rounded-xl ${
 message.type === 'ok'
 ? 'bg-success-soft border border-success/30 text-success'
 : 'bg-danger-soft border border-danger/30 text-danger'
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
