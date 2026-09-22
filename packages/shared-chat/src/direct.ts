import type { ChatTransport, ForwardTarget, Group, Message, MessageReactions, Poll, UploadResult } from './contract'

export interface DirectConversation extends Group { kind: 'direct'; peer_id: string }

/** The other participant's card. phone/email are null unless they chose to share them. */
export interface DirectPeer {
  user_id: string
  name: string
  avatar_url: string | null
  phone: string | null
  email: string | null
  shares: { phone: boolean; email: boolean }
}

/** What I share with members of this community (opt-in, default false). */
export interface ContactSharing { phone: boolean; email: boolean; has_phone: boolean; has_email: boolean }

export interface DirectChatOptions {
  baseUrl?: string
  fetch?: typeof globalThis.fetch
}

export const isDirectConversation = (groupId: string) => groupId.startsWith('dm_')

/** A refused private-chat request. `status` 401/403 means access is gone: clear private content. */
export class DirectChatError extends Error {
  readonly status: number
  constructor(message: string, status: number) {
    super(message)
    this.name = 'DirectChatError'
    this.status = status
  }
}

/**
 * Participant-scoped API for private conversations: the same message tools as groups,
 * authorized by the member session token. Never substitute the group endpoints on failure.
 */
export function createDirectChat(token: string, sourceGroupId: string, options: DirectChatOptions = {}) {
  if (!token || !sourceGroupId) throw new Error('Private samtaler krever innlogging og fellesskaps-ID.')
  const base = (options.baseUrl || 'https://group-chat-worker.torarnehave.workers.dev').replace(/\/$/, '')
  const request = options.fetch || globalThis.fetch

  async function call(path: string, init: { method?: string; json?: unknown; body?: Blob; headers?: Record<string, string> } = {}) {
    const response = await request(base + path, {
      method: init.method || (init.json !== undefined || init.body ? 'POST' : 'GET'),
      headers: { Authorization: `Bearer ${token}`, ...(init.json !== undefined ? { 'Content-Type': 'application/json' } : {}), ...init.headers },
      ...(init.json !== undefined ? { body: JSON.stringify(init.json) } : init.body ? { body: init.body } : {}),
    })
    const data = await response.json().catch(() => ({})) as Record<string, unknown>
    if (!response.ok || data.success === false) {
      throw new DirectChatError(typeof data.error === 'string' ? data.error : `Private chat request failed (${response.status})`, response.status)
    }
    return data
  }
  const conversation = (groupId: string, suffix = '') => `/direct/${encodeURIComponent(groupId)}${suffix}`
  const message = (data: Record<string, unknown>) => {
    if (!data.message) throw new Error('Meldingssvaret mangler message.')
    return data.message as Message
  }

  async function upload(groupId: string, file: Blob, fileName: string): Promise<UploadResult> {
    const data = await call(conversation(groupId, '/media'), {
      body: file,
      headers: { 'Content-Type': file.type || 'application/octet-stream', 'X-File-Name': fileName },
    })
    const objectKey = String(data.objectKey)
    return { payload: { media_object_key: objectKey }, objectKey, contentType: String(data.contentType || file.type), mediaUrl: typeof data.mediaUrl === 'string' ? data.mediaUrl : null }
  }

  async function forwardMessage(sourceGroupId: string, messageId: number, targetGroupId: string): Promise<Message> {
    return message(await call('/direct/forward', { json: { source_group_id: sourceGroupId, message_id: messageId, target_group_id: targetGroupId } }))
  }

  async function listForwardTargets(): Promise<ForwardTarget[]> {
    const data = await call('/direct/forward-targets?source_group_id=' + encodeURIComponent(sourceGroupId))
    return (data.groups || []) as ForwardTarget[]
  }

  const transport: ChatTransport = {
    baseUrl: base,
    async fetchMessages(groupId, _auth, opts = {}) {
      const params = new URLSearchParams({ limit: String(opts.limit ?? 50) })
      if (opts.latest) params.set('latest', '1')
      if (opts.after !== undefined) params.set('after', String(opts.after))
      if (opts.before !== undefined) params.set('before', String(opts.before))
      const data = await call(conversation(groupId, `/messages?${params}`))
      return { success: true, messages: (data.messages || []) as Message[], paging: data.paging as { has_more: boolean; next_before: number } | undefined }
    },
    async sendMessage(groupId, payload) {
      // The server derives sender, media URLs, type and size itself; only these fields are sent.
      const allowed = ['body', 'message_type', 'media_object_key', 'reply_to_id', 'audio_duration_ms', 'video_duration_ms', 'transcript_text', 'transcript_lang', 'transcription_status']
      const body = Object.fromEntries(Object.entries(payload).filter(([key, value]) => allowed.includes(key) && value !== undefined && value !== null))
      const type = typeof body.message_type === 'string' ? body.message_type : 'text'
      const text = typeof body.body === 'string' ? body.body.trim() : ''
      if (type === 'text' && (!text || text.length > 10000)) throw new Error('Meldingen må være mellom 1 og 10000 tegn.')
      return message(await call(conversation(groupId, '/messages'), { json: body }))
    },
    async updateMessage(groupId, messageId, fields) {
      return message(await call(conversation(groupId, `/messages/${messageId}`), { method: 'PATCH', json: fields }))
    },
    async deleteMessage(groupId, messageId) {
      await call(conversation(groupId, `/messages/${messageId}`), { method: 'DELETE' })
    },
    uploadMedia: (groupId, file, fileName) => upload(groupId, file, fileName),
    uploadVoice: (groupId, audio, fileName) => upload(groupId, audio, fileName),
    async transcribe(groupId, source) {
      const json = source.message ? { message_id: source.message.id } : { object_key: source.upload?.objectKey }
      if (!source.message && !source.upload) throw new Error('No recording to transcribe.')
      const data = await call(conversation(groupId, '/transcribe'), { json: { ...json, ...(source.language ? { language: source.language } : {}) } })
      return { text: String(data.text || ''), language: typeof data.language === 'string' ? data.language : null, ...(data.message ? { message: data.message as Message } : {}) }
    },
    async toggleReaction(groupId, messageId, reaction) {
      const data = await call(conversation(groupId, `/messages/${messageId}/reactions`), { json: { reaction } })
      return { reactions: data.reactions as Record<string, number>, my_reactions: data.my_reactions as string[], added: Boolean(data.added) }
    },
    async fetchReactions(groupId, messageIds) {
      if (messageIds.length === 0) return {}
      const data = await call(conversation(groupId, `/reactions?message_ids=${messageIds.join(',')}`))
      return (data.reactions || {}) as Record<number, MessageReactions>
    },
    async createPoll(groupId, question, options) {
      const data = await call(conversation(groupId, '/polls'), { json: { question, options } })
      return { poll: data.poll as Poll, message: data.message as Message | undefined }
    },
    async fetchPoll(groupId, pollId) {
      return (await call(conversation(groupId, `/polls/${encodeURIComponent(pollId)}`))).poll as Poll
    },
    async votePoll(groupId, pollId, optionIndex) {
      const data = await call(conversation(groupId, `/polls/${encodeURIComponent(pollId)}/vote`), { json: { option_index: optionIndex } })
      return { my_vote: data.my_vote as number, votes: data.votes as Record<number, number>, total_votes: data.total_votes as number }
    },
    async closePoll(groupId, pollId) {
      await call(conversation(groupId, `/polls/${encodeURIComponent(pollId)}/close`), { json: {} })
    },
    forwardMessage: (sourceGroupId, messageId, targetGroupId) => forwardMessage(sourceGroupId, messageId, targetGroupId),
    listForwardTargets: () => listForwardTargets(),
  }
  return {
    transport,
    forwardMessage,
    listForwardTargets,
    async fetchPeer(groupId: string): Promise<DirectPeer> {
      return await call(conversation(groupId, '/peer')) as unknown as DirectPeer
    },
    async getContactSharing(): Promise<ContactSharing> {
      return await call('/direct/contact-sharing?source_group_id=' + encodeURIComponent(sourceGroupId)) as unknown as ContactSharing
    },
    async setContactSharing(next: { phone?: boolean; email?: boolean }): Promise<ContactSharing> {
      return await call('/direct/contact-sharing', { method: 'PUT', json: { source_group_id: sourceGroupId, ...next } }) as unknown as ContactSharing
    },
    async fetchConversations(): Promise<DirectConversation[]> {
      const data = await call('/direct/conversations?source_group_id=' + encodeURIComponent(sourceGroupId))
      return (data.groups || []) as DirectConversation[]
    },
  }
}

/**
 * A group transport that forwards into and out of private conversations through the
 * participant-checked /direct/forward route, and offers private conversations as targets.
 */
export function withDirectForwarding(group: ChatTransport, direct: Pick<ReturnType<typeof createDirectChat>, 'forwardMessage' | 'listForwardTargets'>): ChatTransport {
  return {
    ...group,
    forwardMessage: (sourceGroupId, messageId, targetGroupId, authorName, auth) =>
      isDirectConversation(sourceGroupId) || isDirectConversation(targetGroupId)
        ? direct.forwardMessage(sourceGroupId, messageId, targetGroupId)
        : group.forwardMessage(sourceGroupId, messageId, targetGroupId, authorName, auth),
    listForwardTargets: () => direct.listForwardTargets(),
  }
}
