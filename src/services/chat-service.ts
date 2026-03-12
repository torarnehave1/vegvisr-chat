import type { Group, Message, MessagesResponse, Member, AuthParams, MemberProfile, ChatBot, Poll } from '../types/chat'

const BASE = 'https://group-chat-worker.torarnehave.workers.dev'

function qs(params: Record<string, string | number | undefined>): string {
  const parts: string[] = []
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') {
      parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    }
  }
  return parts.join('&')
}

function authQuery(auth: AuthParams): string {
  return qs({ user_id: auth.user_id, phone: auth.phone, email: auth.email })
}

function authBody(auth: AuthParams): Record<string, string> {
  const body: Record<string, string> = { user_id: auth.user_id, phone: auth.phone }
  if (auth.email) body.email = auth.email
  return body
}

// ── Groups ──────────────────────────────────────────────────────

export async function fetchGroups(auth: AuthParams, opts?: { includeArchived?: boolean }): Promise<Group[]> {
  const extra = opts?.includeArchived ? '&include_archived=1' : ''
  const res = await fetch(`${BASE}/groups?${authQuery(auth)}${extra}`)
  const data = await res.json()
  if (!res.ok || !data.success) throw new Error(data.error || 'Failed to fetch groups')
  return data.groups || []
}

export async function archiveGroup(groupId: string, auth: AuthParams): Promise<void> {
  const res = await fetch(`${BASE}/groups/${groupId}/archive`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(authBody(auth)),
  })
  const data = await res.json()
  if (!res.ok || !data.success) throw new Error(data.error || 'Failed to archive group')
}

export async function restoreGroup(groupId: string, auth: AuthParams): Promise<void> {
  const res = await fetch(`${BASE}/groups/${groupId}/restore`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(authBody(auth)),
  })
  const data = await res.json()
  if (!res.ok || !data.success) throw new Error(data.error || 'Failed to restore group')
}

export async function createGroup(name: string, auth: AuthParams): Promise<Group> {
  const res = await fetch(`${BASE}/groups`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, created_by: auth.user_id, ...authBody(auth) }),
  })
  const data = await res.json()
  if (!res.ok || !data.success) throw new Error(data.error || 'Failed to create group')
  return data.group
}

export async function updateGroup(
  groupId: string,
  fields: { name?: string; image_url?: string },
  auth: AuthParams,
): Promise<Group> {
  const res = await fetch(`${BASE}/groups/${groupId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...authBody(auth), ...fields }),
  })
  const data = await res.json()
  if (!res.ok || !data.success) throw new Error(data.error || 'Failed to update group')
  return data.group
}

// ── Members ─────────────────────────────────────────────────────

export async function fetchMembers(groupId: string, auth: AuthParams): Promise<Member[]> {
  const res = await fetch(`${BASE}/groups/${groupId}/members?${authQuery(auth)}`)
  const data = await res.json()
  if (!res.ok || !data.success) throw new Error(data.error || 'Failed to fetch members')
  return data.members || []
}

// ── Messages ────────────────────────────────────────────────────

export async function fetchMessages(
  groupId: string,
  auth: AuthParams,
  opts: { after?: number; before?: number; limit?: number; latest?: boolean } = {},
): Promise<MessagesResponse> {
  const params = qs({
    ...{ user_id: auth.user_id, phone: auth.phone, email: auth.email },
    after: opts.after ?? 0,
    limit: opts.limit ?? 50,
    latest: opts.latest ? 1 : undefined,
    before: opts.before,
  })
  const res = await fetch(`${BASE}/groups/${groupId}/messages?${params}`)
  const data = await res.json()
  if (!res.ok || !data.success) throw new Error(data.error || 'Failed to fetch messages')
  return { success: true, messages: data.messages || [], paging: data.paging }
}

export async function sendMessage(
  groupId: string,
  payload: {
    body?: string
    message_type?: string
    audio_url?: string
    audio_duration_ms?: number
    transcript_text?: string
    transcript_lang?: string
    transcription_status?: string
    media_url?: string
    media_object_key?: string
    media_content_type?: string
    media_size?: number
    video_thumbnail_url?: string
    video_duration_ms?: number
  },
  auth: AuthParams,
): Promise<Message> {
  const res = await fetch(`${BASE}/groups/${groupId}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...authBody(auth), ...payload }),
  })
  const data = await res.json()
  if (!res.ok || !data.success) throw new Error(data.error || 'Failed to send message')
  return data.message
}

export async function deleteMessage(
  groupId: string,
  messageId: number,
  auth: AuthParams,
): Promise<void> {
  const res = await fetch(
    `${BASE}/groups/${groupId}/messages/${messageId}?${authQuery(auth)}`,
    { method: 'DELETE' },
  )
  const data = await res.json()
  if (!res.ok || !data.success) throw new Error(data.error || 'Failed to delete message')
}

export async function updateMessage(
  groupId: string,
  messageId: number,
  fields: Record<string, string | undefined>,
  auth: AuthParams,
): Promise<Message> {
  const res = await fetch(`${BASE}/groups/${groupId}/messages/${messageId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...authBody(auth), ...fields }),
  })
  const data = await res.json()
  if (!res.ok || !data.success) throw new Error(data.error || 'Failed to update message')
  return data.message
}

// ── Media Upload ────────────────────────────────────────────────

export async function uploadMedia(
  groupId: string,
  file: File,
  auth: AuthParams,
): Promise<{ media_url: string; object_key: string; content_type: string }> {
  const res = await fetch(
    `${BASE}/groups/${groupId}/media?${authQuery(auth)}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': file.type,
        'X-File-Name': file.name,
      },
      body: file,
    },
  )
  const data = await res.json()
  if (!res.ok || !data.success) throw new Error(data.error || 'Failed to upload media')
  return { media_url: data.mediaUrl, object_key: data.objectKey, content_type: data.contentType }
}

// ── Member Profiles ────────────────────────────────────────────

const PROFILE_BASE = 'https://smsgway.vegvisr.org/api/auth/profile'

// Cache profiles in memory to avoid repeated fetches
const profileCache = new Map<string, MemberProfile>()

/** Clear a specific user from the profile cache (e.g. after profile image update) */
export function clearProfileCache(userId?: string) {
  if (userId) {
    profileCache.delete(userId)
  } else {
    profileCache.clear()
  }
}

export async function fetchMemberProfiles(
  groupId: string,
  auth: AuthParams,
): Promise<Map<string, MemberProfile>> {
  const members = await fetchMembers(groupId, auth)
  const profiles = new Map<string, MemberProfile>()

  // Fetch profiles for human members via SMS gateway
  await Promise.allSettled(
    members
      .filter(m => !m.user_id.startsWith('bot:'))
      .map(async (m) => {
        if (profileCache.has(m.user_id)) {
          profiles.set(m.user_id, profileCache.get(m.user_id)!)
          return
        }
        try {
          const res = await fetch(`${PROFILE_BASE}?user_id=${encodeURIComponent(m.user_id)}`)
          if (res.ok) {
            const data = await res.json()
            if (data.success) {
              const profile: MemberProfile = {
                user_id: m.user_id,
                email: data.email,
                phone: data.phone,
                profileimage: data.profile_image_url || undefined,
                displayName: data.display_name || data.email?.split('@')[0] || m.user_id.slice(0, 8),
              }
              profiles.set(m.user_id, profile)
              profileCache.set(m.user_id, profile)
            }
          }
        } catch { /* ignore */ }
      }),
  )

  // Bot members — fetch bot details for names/avatars
  const botMembers = members.filter(m => m.user_id.startsWith('bot:'))
  if (botMembers.length > 0) {
    try {
      const bots = await fetchGroupBots(groupId, auth)
      for (const m of botMembers) {
        const botId = m.user_id.replace('bot:', '')
        const bot = bots.find(b => b.id === botId)
        profiles.set(m.user_id, {
          user_id: m.user_id,
          profileimage: bot?.avatar_url,
          displayName: bot ? `${bot.name}` : 'BOT',
        })
      }
    } catch {
      for (const m of botMembers) {
        if (!profiles.has(m.user_id)) {
          profiles.set(m.user_id, { user_id: m.user_id, displayName: 'BOT' })
        }
      }
    }
  }

  // Fallback for members without profiles
  for (const m of members) {
    if (!profiles.has(m.user_id)) {
      profiles.set(m.user_id, {
        user_id: m.user_id,
        displayName: m.user_id.slice(0, 8),
      })
    }
  }

  return profiles
}

// ── Bots ───────────────────────────────────────────────────────

export async function fetchGroupBots(groupId: string, auth: AuthParams): Promise<ChatBot[]> {
  const res = await fetch(`${BASE}/groups/${groupId}/bots?${authQuery(auth)}`)
  const data = await res.json()
  if (!res.ok || !data.success) return [] // graceful — no bots or no permission
  return data.bots || []
}

// ── Invites ─────────────────────────────────────────────────────

export async function createInvite(
  groupId: string,
  auth: AuthParams,
): Promise<{ code: string; expires_at: string }> {
  const res = await fetch(`${BASE}/groups/${groupId}/invite`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(authBody(auth)),
  })
  const data = await res.json()
  if (!res.ok || !data.success) throw new Error(data.error || 'Failed to create invite')
  return data.invite
}

export async function getInvite(code: string): Promise<{ code: string; group_id: string; group_name: string; expires_at: string }> {
  const res = await fetch(`${BASE}/invite/${code}`)
  const data = await res.json()
  if (!res.ok || !data.success) throw new Error(data.error || 'Invalid invite')
  return data.invite
}

export async function joinInvite(code: string, auth: AuthParams): Promise<Group> {
  const res = await fetch(`${BASE}/invite/${code}/join`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(authBody(auth)),
  })
  const data = await res.json()
  if (!res.ok || !data.success) throw new Error(data.error || 'Failed to join group')
  return data.group
}

// ── Polls ───────────────────────────────────────────────────────

export async function createPoll(
  groupId: string,
  question: string,
  options: string[],
  auth: AuthParams,
): Promise<Poll> {
  const res = await fetch(`${BASE}/groups/${groupId}/polls`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...authBody(auth), question, options }),
  })
  const data = await res.json()
  if (!res.ok || !data.success) throw new Error(data.error || 'Failed to create poll')
  return data.poll
}

export async function votePoll(
  pollId: string,
  optionIndex: number,
  auth: AuthParams,
): Promise<{ my_vote: number; votes: Record<number, number>; total_votes: number }> {
  const res = await fetch(`${BASE}/polls/${pollId}/vote`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...authBody(auth), option_index: optionIndex }),
  })
  const data = await res.json()
  if (!res.ok || !data.success) throw new Error(data.error || 'Failed to vote')
  return { my_vote: data.my_vote, votes: data.votes, total_votes: data.total_votes }
}

export async function fetchPoll(pollId: string, auth: AuthParams): Promise<Poll> {
  const res = await fetch(`${BASE}/polls/${pollId}?${authQuery(auth)}`)
  const data = await res.json()
  if (!res.ok || !data.success) throw new Error(data.error || 'Failed to fetch poll')
  return data.poll
}

export async function fetchUnansweredPollCount(
  groupId: string,
  auth: AuthParams,
): Promise<number> {
  const res = await fetch(`${BASE}/groups/${groupId}/polls/unanswered?${authQuery(auth)}`)
  const data = await res.json()
  if (!res.ok || !data.success) return 0
  return data.unanswered_count || 0
}

export async function closePoll(pollId: string, auth: AuthParams): Promise<void> {
  const res = await fetch(`${BASE}/polls/${pollId}/close`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(authBody(auth)),
  })
  const data = await res.json()
  if (!res.ok || !data.success) throw new Error(data.error || 'Failed to close poll')
}

// ── Reactions ───────────────────────────────────────────────────

export type ReactionType = 'thumbs_up' | 'heart' | 'smile'

export interface MessageReactions {
  counts: Record<string, number>
  mine: string[]
}

export async function toggleReaction(
  messageId: number,
  reaction: ReactionType,
  auth: AuthParams,
): Promise<{ reactions: Record<string, number>; my_reactions: string[]; added: boolean }> {
  const res = await fetch(`${BASE}/messages/${messageId}/reactions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...authBody(auth), reaction }),
  })
  const data = await res.json()
  if (!res.ok || !data.success) throw new Error(data.error || 'Failed to toggle reaction')
  return { reactions: data.reactions, my_reactions: data.my_reactions, added: data.added }
}

export async function fetchReactions(
  groupId: string,
  messageIds: number[],
  auth: AuthParams,
): Promise<Record<number, MessageReactions>> {
  if (messageIds.length === 0) return {}
  const ids = messageIds.join(',')
  const res = await fetch(`${BASE}/groups/${groupId}/reactions?${authQuery(auth)}&message_ids=${ids}`)
  const data = await res.json()
  if (!res.ok || !data.success) return {}
  return data.reactions || {}
}
