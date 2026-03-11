import type { Group, Message, MessagesResponse, Member, AuthParams } from '../types/chat'

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

export async function fetchGroups(auth: AuthParams): Promise<Group[]> {
  const res = await fetch(`${BASE}/groups?${authQuery(auth)}`)
  const data = await res.json()
  if (!res.ok || !data.success) throw new Error(data.error || 'Failed to fetch groups')
  return data.groups || []
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
