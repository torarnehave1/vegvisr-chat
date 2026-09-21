import { createContext, useContext } from 'react'
import type { ChatTransport } from '../../packages/shared-chat/src/contract'

/** The open conversation's transport, for nested cards (polls) that call the backend themselves. */
export interface ChatOps {
  transport: ChatTransport
  groupId: string
}

export const ChatOpsContext = createContext<ChatOps | null>(null)

export const useChatOps = () => useContext(ChatOpsContext)
