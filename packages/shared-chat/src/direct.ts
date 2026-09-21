import type { ChatTransport, Group } from './contract'

export interface DirectConversation extends Group { kind: 'direct'; peer_id: string }

/** Participant-scoped API. Never substitute the legacy group endpoints on failure. */
export function createDirectChat(token: string, sourceGroupId: string) {
  if (!token || !sourceGroupId) throw new Error('Private samtaler krever innlogging og fellesskaps-ID.')
  const base = 'https://group-chat-worker.torarnehave.workers.dev'
  async function request(path: string, body?: { body: string }) {
    const response = await fetch(base + path, {
      method: body ? 'POST' : 'GET',
      headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    })
    const data = await response.json()
    if (!response.ok || data.success === false) throw new Error(data.error || `Private chat request failed (${response.status})`)
    return data
  }
  const transport: ChatTransport = {
    async fetchMessages(groupId, _auth, options = {}) {
      const params = new URLSearchParams({ limit: String(options.limit ?? 50) })
      if (options.latest) params.set('latest', '1')
      if (options.after !== undefined) params.set('after', String(options.after))
      if (options.before !== undefined) params.set('before', String(options.before))
      const data = await request(`/direct/${encodeURIComponent(groupId)}/messages?${params}`)
      return { success: true, messages: data.messages || [], paging: data.paging }
    },
    async sendMessage(groupId, payload) {
      const body = typeof payload.body === 'string' ? payload.body.trim() : ''
      if (!body || body.length > 10000) throw new Error('Meldingen må være mellom 1 og 10000 tegn.')
      const data = await request(`/direct/${encodeURIComponent(groupId)}/messages`, { body })
      if (!data.message) throw new Error('Meldingssvaret mangler message.')
      return data.message
    },
    async updateMessage() { throw new Error('Private chat API does not support editing.') },
    async deleteMessage() { throw new Error('Private chat API does not support deletion.') },
  }
  return {
    transport,
    async fetchConversations(): Promise<DirectConversation[]> {
      const data = await request('/direct/conversations?source_group_id=' + encodeURIComponent(sourceGroupId))
      return data.groups || []
    },
  }
}
