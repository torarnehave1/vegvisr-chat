import type {
  AuthParams,
  ChatTransport,
  ForwardTarget,
  Group,
  Message,
  MessageReactions,
  MessageUpdateFields,
  MessagesResponse,
  Poll,
  UploadResult,
} from './contract'

export interface ChatTransportOptions {
  baseUrl?: string
  /** Voice notes in group conversations are stored by voice-worker. */
  voiceBaseUrl?: string
  fetch?: typeof globalThis.fetch
}

function query(params: Record<string, string | number | undefined>): string {
  return Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== '')
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
    .join('&')
}

function authQuery(auth: AuthParams): string {
  return query({ user_id: auth.user_id, phone: auth.phone, email: auth.email })
}

function authBody(auth: AuthParams): Record<string, string> {
  const body: Record<string, string> = { user_id: auth.user_id, phone: auth.phone }
  if (auth.email) body.email = auth.email
  return body
}

async function responseJson(response: Response): Promise<Record<string, unknown>> {
  const data = await response.json().catch(() => ({})) as Record<string, unknown>
  if (!response.ok || data.success === false) {
    throw new Error(typeof data.error === 'string' ? data.error : `Chat request failed (${response.status})`)
  }
  return data
}

/** Object key of a voice-worker audio URL (…/audio?key=<key>). */
function voiceKey(audioUrl: string | undefined): string | null {
  if (!audioUrl) return null
  try {
    return new URL(audioUrl).searchParams.get('key')
  } catch {
    return null
  }
}

/** Group conversations: the existing /groups, /polls and /messages endpoints plus voice-worker. */
export function createChatTransport(options: ChatTransportOptions = {}): ChatTransport {
  const baseUrl = (options.baseUrl || 'https://group-chat-worker.torarnehave.workers.dev').replace(/\/$/, '')
  const voiceBaseUrl = (options.voiceBaseUrl || 'https://voice.vegvisr.org').replace(/\/$/, '')
  const request = options.fetch || globalThis.fetch
  const post = (url: string, body: Record<string, unknown>) => request(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  async function updateMessage(groupId: string, messageId: number, fields: MessageUpdateFields, auth: AuthParams): Promise<Message> {
    const data = await responseJson(await request(`${baseUrl}/groups/${encodeURIComponent(groupId)}/messages/${messageId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...authBody(auth), ...fields }),
    }))
    return data.message as Message
  }

  return {
    baseUrl,
    async fetchMessages(groupId, auth, opts = {}): Promise<MessagesResponse> {
      const params = query({
        ...auth,
        after: opts.after ?? 0,
        before: opts.before,
        limit: opts.limit ?? 50,
        latest: opts.latest ? 1 : undefined,
      })
      const data = await responseJson(await request(`${baseUrl}/groups/${encodeURIComponent(groupId)}/messages?${params}`))
      return {
        success: true,
        messages: Array.isArray(data.messages) ? data.messages as Message[] : [],
        paging: data.paging as MessagesResponse['paging'],
      }
    },

    async sendMessage(groupId, payload, auth): Promise<Message> {
      const data = await responseJson(await post(`${baseUrl}/groups/${encodeURIComponent(groupId)}/messages`, { ...authBody(auth), ...payload }))
      return data.message as Message
    },

    updateMessage,

    async deleteMessage(groupId, messageId, auth): Promise<void> {
      await responseJson(await request(`${baseUrl}/groups/${encodeURIComponent(groupId)}/messages/${messageId}?${authQuery(auth)}`, {
        method: 'DELETE',
      }))
    },

    async uploadMedia(groupId, file, fileName, auth): Promise<UploadResult> {
      const data = await responseJson(await request(`${baseUrl}/groups/${encodeURIComponent(groupId)}/media?${authQuery(auth)}`, {
        method: 'POST',
        headers: { 'Content-Type': file.type || 'application/octet-stream', 'X-File-Name': fileName },
        body: file,
      }))
      const contentType = String(data.contentType || file.type)
      const mediaUrl = String(data.mediaUrl)
      return { payload: { media_url: mediaUrl, media_content_type: contentType, media_size: file.size }, objectKey: String(data.objectKey), contentType, mediaUrl }
    },

    async uploadVoice(groupId, audio, fileName): Promise<UploadResult> {
      const data = await responseJson(await request(`${voiceBaseUrl}/upload`, {
        method: 'POST',
        headers: { 'Content-Type': audio.type || 'audio/webm', 'X-File-Name': fileName, 'X-Chat-Id': groupId },
        body: audio,
      }))
      const audioUrl = String(data.audioUrl)
      return { payload: { audio_url: audioUrl }, objectKey: String(data.objectKey), contentType: audio.type || 'audio/webm', mediaUrl: audioUrl }
    },

    async transcribe(groupId, source, auth) {
      const objectKey = source.upload?.objectKey || voiceKey(source.message?.audio_url)
      if (!objectKey) throw new Error('No recording to transcribe.')
      const data = await responseJson(await post(`${voiceBaseUrl}/transcribe`, { objectKey, model: 'whisper-1', language: source.language || null }))
      const text = typeof data.text === 'string' ? data.text : ''
      const language = typeof data.language === 'string' ? data.language : null
      if (!source.message) return { text, language }
      const message = await updateMessage(groupId, source.message.id, {
        transcript_text: text,
        ...(language ? { transcript_lang: language } : {}),
        transcription_status: text ? 'complete' : 'none',
      }, auth)
      return { text, language, message }
    },

    async toggleReaction(_groupId, messageId, reaction, auth) {
      const data = await responseJson(await post(`${baseUrl}/messages/${messageId}/reactions`, { ...authBody(auth), reaction }))
      return { reactions: data.reactions as Record<string, number>, my_reactions: data.my_reactions as string[], added: Boolean(data.added) }
    },

    async fetchReactions(groupId, messageIds, auth) {
      if (messageIds.length === 0) return {}
      const data = await responseJson(await request(`${baseUrl}/groups/${encodeURIComponent(groupId)}/reactions?${authQuery(auth)}&message_ids=${messageIds.join(',')}`))
      return (data.reactions || {}) as Record<number, MessageReactions>
    },

    async createPoll(groupId, question, options, auth) {
      const data = await responseJson(await post(`${baseUrl}/groups/${encodeURIComponent(groupId)}/polls`, { ...authBody(auth), question, options }))
      return { poll: data.poll as Poll }
    },

    async fetchPoll(_groupId, pollId, auth) {
      const data = await responseJson(await request(`${baseUrl}/polls/${encodeURIComponent(pollId)}?${authQuery(auth)}`))
      return data.poll as Poll
    },

    async votePoll(_groupId, pollId, optionIndex, auth) {
      const data = await responseJson(await post(`${baseUrl}/polls/${encodeURIComponent(pollId)}/vote`, { ...authBody(auth), option_index: optionIndex }))
      return { my_vote: data.my_vote as number, votes: data.votes as Record<number, number>, total_votes: data.total_votes as number }
    },

    async closePoll(_groupId, pollId, auth) {
      await responseJson(await post(`${baseUrl}/polls/${encodeURIComponent(pollId)}/close`, authBody(auth)))
    },

    async forwardMessage(sourceGroupId, messageId, targetGroupId, authorName, auth) {
      const data = await responseJson(await post(`${baseUrl}/groups/${encodeURIComponent(sourceGroupId)}/messages/${messageId}/forward`, {
        ...authBody(auth),
        target_group_id: targetGroupId,
        forwarded_from_user_name: authorName,
      }))
      return data.message as Message
    },

    async listForwardTargets(auth): Promise<ForwardTarget[]> {
      const data = await responseJson(await request(`${baseUrl}/groups?${authQuery(auth)}`))
      return ((data.groups || []) as Group[]).map(group => ({ ...group, kind: 'group' as const }))
    },
  }
}
