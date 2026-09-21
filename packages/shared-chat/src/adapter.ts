import type {
  AuthParams,
  ChatTransport,
  Group,
  Member,
  Message,
  MessageUpdateFields,
  MessagesResponse,
} from './contract'

export interface ChatAdapter {
  readonly transport: ChatTransport
  fetchGroups: (auth: AuthParams, opts?: { includeArchived?: boolean }) => Promise<Group[]>
  fetchMembers: (groupId: string, auth: AuthParams) => Promise<Member[]>
  fetchMessages: (groupId: string, auth: AuthParams, options?: { after?: number; before?: number; limit?: number; latest?: boolean }) => Promise<MessagesResponse>
  sendMessage: (groupId: string, payload: Record<string, unknown>, auth: AuthParams) => Promise<Message>
  updateMessage: (groupId: string, messageId: number, fields: MessageUpdateFields, auth: AuthParams) => Promise<Message>
  deleteMessage: (groupId: string, messageId: number, auth: AuthParams) => Promise<void>
}

const DEFAULT_BASE_URL = 'https://group-chat-worker.torarnehave.workers.dev'

function getBaseUrl(transport: ChatTransport): string {
  return (transport.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, '')
}

export function createChatAdapter(transport: ChatTransport): ChatAdapter {
  return {
    transport,
    async fetchGroups(auth, opts) {
      const query = new URLSearchParams({
        user_id: auth.user_id,
        phone: auth.phone,
        ...(auth.email ? { email: auth.email } : {}),
      })
      if (opts?.includeArchived) query.set('include_archived', '1')

      const res = await fetch(`${getBaseUrl(transport)}/groups?${query.toString()}`)
      const data = await res.json() as { success?: boolean; groups?: Group[]; error?: string }
      if (!res.ok || data.success === false) {
        throw new Error(data.error || 'Failed to fetch groups')
      }
      return data.groups ?? []
    },
    async fetchMembers(groupId, auth) {
      const query = new URLSearchParams({
        user_id: auth.user_id,
        phone: auth.phone,
        ...(auth.email ? { email: auth.email } : {}),
      })
      const res = await fetch(`${getBaseUrl(transport)}/groups/${encodeURIComponent(groupId)}/members?${query.toString()}`)
      const data = await res.json() as { success?: boolean; members?: Member[]; error?: string }
      if (!res.ok || data.success === false) {
        throw new Error(data.error || 'Failed to fetch members')
      }
      return data.members ?? []
    },
    async fetchMessages(groupId, auth, options) {
      return transport.fetchMessages(groupId, auth, options)
    },
    async sendMessage(groupId, payload, auth) {
      return transport.sendMessage(groupId, payload, auth)
    },
    async updateMessage(groupId, messageId, fields, auth) {
      return transport.updateMessage(groupId, messageId, fields, auth)
    },
    async deleteMessage(groupId, messageId, auth) {
      return transport.deleteMessage(groupId, messageId, auth)
    },
  }
}
