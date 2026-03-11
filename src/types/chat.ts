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
  created_at: number
  updated_at: number
}

export interface Member {
  user_id: string
  phone: string
  email?: string
  role: string
  joined_at: number
}

export type MessageType = 'text' | 'voice' | 'image' | 'video'

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
  // Voice
  audio_url?: string
  audio_duration_ms?: number
  transcript_text?: string
  transcript_lang?: string
  transcription_status?: string
  // Media
  media_url?: string
  media_object_key?: string
  media_content_type?: string
  media_size?: number
  video_thumbnail_url?: string
  video_duration_ms?: number
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

export interface AuthParams {
  user_id: string
  phone: string
  email?: string
}

export interface MemberProfile {
  user_id: string
  email?: string
  phone?: string
  profileimage?: string
  displayName: string
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
