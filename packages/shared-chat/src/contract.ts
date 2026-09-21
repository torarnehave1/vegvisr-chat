export type MessageType = 'text' | 'voice' | 'image' | 'video' | 'pdf' | 'poll' | 'contact_request' | 'bot_thinking' | 'bot_error'

export interface ChatUser {
  userId: string
  email: string
  role: string
  phone: string | null
}

export interface Group {
  id: string
  name: string
  created_by: string
  phone?: string
  email?: string
  image_url?: string
  graph_id?: string
  alert_sender_email?: string | null
  archived_at?: number | null
  archived_by?: string | null
  posting_locked?: number
  created_at: number
  updated_at: number
}

export interface Member {
  user_id: string
  phone: string
  email?: string
  role: string
  joined_at: number
  alerts_enabled?: number
}

export interface AuthParams {
  user_id: string
  phone: string
  email?: string
}

export interface Message {
  id: number
  group_id: string
  user_id: string
  phone?: string
  email?: string
  body?: string
  message_type?: MessageType
  created_at: number
  updated_at?: number
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
  reply_to_id?: number | null
  forwarded_from_message_id?: number | null
  forwarded_from_user_id?: string | null
  forwarded_from_user_name?: string | null
}

export interface PagingInfo {
  has_more: boolean
  next_before: number
}

export interface MessagesResponse {
  success: boolean
  messages: Message[]
  paging?: PagingInfo
}

export interface MessageUpdateFields {
  body?: string
  transcript_text?: string
  transcript_lang?: string
  transcription_status?: string
  [key: string]: string | undefined
}

export interface MemberProfile {
  user_id: string
  email?: string
  phone?: string
  profileimage?: string
  displayName: string
}

export interface Poll {
  id: string
  message_id: number
  group_id: string
  question: string
  options: string[]
  created_by: string
  created_at: number
  closed_at?: number | null
  votes: Record<number, number>
  total_votes: number
  my_vote: number | null
}

export interface ChatBot {
  id: string
  name: string
  username: string
  avatar_url?: string
  system_prompt?: string
  graph_id?: string
  tools?: string
  model?: string
}

export type ReactionType = 'thumbs_up' | 'heart' | 'smile'

export interface MessageReactions {
  counts: Record<string, number>
  mine: string[]
}

export interface ReactionResult {
  reactions: Record<string, number>
  my_reactions: string[]
  added: boolean
}

export interface PollVoteResult {
  my_vote: number
  votes: Record<number, number>
  total_votes: number
}

/**
 * An uploaded attachment or recording. `payload` holds the fields to merge into the
 * sendMessage payload; its shape belongs to the transport (group: public URLs,
 * private: an object key the server resolves), so the renderer never builds it.
 */
export interface UploadResult {
  payload: Record<string, unknown>
  objectKey: string
  contentType: string
  mediaUrl: string | null
}

export interface TranscriptionResult {
  text: string
  language: string | null
  /** The stored message, when a sent voice message was transcribed. */
  message?: Message
}

export interface ForwardTarget extends Group {
  kind?: 'group' | 'direct'
}

/**
 * Every message operation of the chat workspace. Group and private conversations
 * implement the same set; they differ in endpoints and authorization, not in tools.
 */
export interface ChatTransport {
  readonly baseUrl?: string
  fetchMessages: (groupId: string, auth: AuthParams, options?: { after?: number; before?: number; limit?: number; latest?: boolean }) => Promise<MessagesResponse>
  sendMessage: (groupId: string, payload: Record<string, unknown>, auth: AuthParams) => Promise<Message>
  updateMessage: (groupId: string, messageId: number, fields: MessageUpdateFields, auth: AuthParams) => Promise<Message>
  deleteMessage: (groupId: string, messageId: number, auth: AuthParams) => Promise<void>
  uploadMedia: (groupId: string, file: Blob, fileName: string, auth: AuthParams) => Promise<UploadResult>
  uploadVoice: (groupId: string, audio: Blob, fileName: string, auth: AuthParams) => Promise<UploadResult>
  transcribe: (groupId: string, source: { upload?: UploadResult; message?: Message; language?: string }, auth: AuthParams) => Promise<TranscriptionResult>
  toggleReaction: (groupId: string, messageId: number, reaction: ReactionType, auth: AuthParams) => Promise<ReactionResult>
  fetchReactions: (groupId: string, messageIds: number[], auth: AuthParams) => Promise<Record<number, MessageReactions>>
  createPoll: (groupId: string, question: string, options: string[], auth: AuthParams) => Promise<{ poll: Poll; message?: Message }>
  fetchPoll: (groupId: string, pollId: string, auth: AuthParams) => Promise<Poll>
  votePoll: (groupId: string, pollId: string, optionIndex: number, auth: AuthParams) => Promise<PollVoteResult>
  closePoll: (groupId: string, pollId: string, auth: AuthParams) => Promise<void>
  forwardMessage: (sourceGroupId: string, messageId: number, targetGroupId: string, authorName: string | null, auth: AuthParams) => Promise<Message>
  listForwardTargets: (auth: AuthParams) => Promise<ForwardTarget[]>
}
