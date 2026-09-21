import type {
  AuthParams,
  ChatTransport,
  Message,
  MessageUpdateFields,
  MessagesResponse,
} from './contract'

export interface ChatTransportOptions {
  baseUrl?: string
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

export function createChatTransport(options: ChatTransportOptions = {}): ChatTransport {
  const baseUrl = (options.baseUrl || 'https://group-chat-worker.torarnehave.workers.dev').replace(/\/$/, '')
  const request = options.fetch || globalThis.fetch

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
      const data = await responseJson(await request(`${baseUrl}/groups/${encodeURIComponent(groupId)}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...authBody(auth), ...payload }),
      }))
      return data.message as Message
    },

    async updateMessage(groupId, messageId, fields: MessageUpdateFields, auth): Promise<Message> {
      const data = await responseJson(await request(`${baseUrl}/groups/${encodeURIComponent(groupId)}/messages/${messageId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...authBody(auth), ...fields }),
      }))
      return data.message as Message
    },

    async deleteMessage(groupId, messageId, auth): Promise<void> {
      await responseJson(await request(`${baseUrl}/groups/${encodeURIComponent(groupId)}/messages/${messageId}?${authQuery(auth)}`, {
        method: 'DELETE',
      }))
    },
  }
}
