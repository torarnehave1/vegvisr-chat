import { useState, useEffect, useRef, useCallback } from 'react'
import { fetchMessages, sendMessage, deleteMessage, fetchMemberProfiles } from '../services/chat-service'
import { uploadAudio, transcribeAudio, extractObjectKey } from '../services/voice-service'
import { updateMessage } from '../services/chat-service'
import { sendAiMessage } from '../services/ai-service'
import type { AiProvider, AiMessage } from '../services/ai-service'
import { usePolling } from '../hooks/usePolling'
import { MessageBubble } from './MessageBubble'
import { VoiceRecorder } from './VoiceRecorder'
import type { VoiceRecording } from '../hooks/useVoiceRecorder'
import type { AuthParams, Message, MemberProfile } from '../types/chat'

interface Props {
  groupId: string
  groupName: string
  auth: AuthParams
  currentUserId: string
  onBack: () => void
  onInfo: () => void
}

function dayLabel(ts: number): string {
  const d = new Date(ts)
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const msgDay = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const diff = (today.getTime() - msgDay.getTime()) / 86400000
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Yesterday'
  return d.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })
}

export function GroupChat({ groupId, groupName, auth, currentUserId, onBack, onInfo }: Props) {
  const [messages, setMessages] = useState<Map<number, Message>>(new Map())
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)
  const [hasMore, setHasMore] = useState(false)
  const [nextBefore, setNextBefore] = useState<number | null>(null)
  const [loadingOlder, setLoadingOlder] = useState(false)
  const [aiMode, setAiMode] = useState(false)
  const [aiProvider, setAiProvider] = useState<AiProvider>('grok')
  const [aiHistory, setAiHistory] = useState<AiMessage[]>([])
  const [profiles, setProfiles] = useState<Map<string, MemberProfile>>(new Map())
  const scrollRef = useRef<HTMLDivElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const atBottomRef = useRef(true)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const sortedMessages = Array.from(messages.values()).sort((a, b) => a.created_at - b.created_at)
  const lastTimestamp = sortedMessages.length > 0 ? sortedMessages[sortedMessages.length - 1].created_at : 0

  // Merge new messages into map (dedup)
  const mergeMessages = useCallback((msgs: Message[]) => {
    setMessages(prev => {
      const next = new Map(prev)
      for (const m of msgs) next.set(m.id, m)
      return next
    })
  }, [])

  // Initial load
  useEffect(() => {
    setMessages(new Map())
    setLoading(true)
    setHasMore(false)
    setNextBefore(null)

    fetchMessages(groupId, auth, { latest: true, limit: 50 })
      .then(res => {
        mergeMessages(res.messages)
        if (res.paging) {
          setHasMore(res.paging.has_more)
          setNextBefore(res.paging.next_before)
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [groupId, auth, mergeMessages])

  // Fetch member profiles
  useEffect(() => {
    fetchMemberProfiles(groupId, auth)
      .then(setProfiles)
      .catch(console.error)
  }, [groupId, auth])

  // Poll for new messages
  usePolling(groupId, auth, lastTimestamp, mergeMessages)

  // Scroll to bottom helper
  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      bottomRef.current?.scrollIntoView({ block: 'end' })
    })
  }, [])

  // Auto-scroll to bottom on new messages (if already at bottom)
  useEffect(() => {
    if (atBottomRef.current) {
      scrollToBottom()
    }
  }, [sortedMessages.length, scrollToBottom])

  // Scroll to bottom after initial load completes
  useEffect(() => {
    if (!loading && sortedMessages.length > 0) {
      scrollToBottom()
    }
  }, [loading, scrollToBottom]) // eslint-disable-line react-hooks/exhaustive-deps

  // Track if at bottom
  const handleScroll = () => {
    const el = scrollRef.current
    if (!el) return
    atBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40

    // Load older messages when scrolled to top
    if (el.scrollTop < 50 && hasMore && !loadingOlder && nextBefore) {
      setLoadingOlder(true)
      const prevHeight = el.scrollHeight
      fetchMessages(groupId, auth, { before: nextBefore, limit: 50, latest: true })
        .then(res => {
          mergeMessages(res.messages)
          if (res.paging) {
            setHasMore(res.paging.has_more)
            setNextBefore(res.paging.next_before)
          } else {
            setHasMore(false)
          }
          // Preserve scroll position
          requestAnimationFrame(() => {
            if (el) el.scrollTop = el.scrollHeight - prevHeight
          })
        })
        .catch(console.error)
        .finally(() => setLoadingOlder(false))
    }
  }

  const handleSend = async () => {
    const text = input.trim()
    if (!text || sending) return
    setSending(true)
    setInput('')

    if (aiMode) {
      // AI mode: send to AI, then post AI response as a message
      const userMsg: AiMessage = { role: 'user', content: text }
      const history = [...aiHistory, userMsg]
      try {
        // Post user text as a normal message first
        const userSent = await sendMessage(groupId, { body: text }, auth)
        mergeMessages([userSent])
        atBottomRef.current = true

        const aiRes = await sendAiMessage(history, auth.phone, aiProvider, auth.user_id)
        const assistantMsg: AiMessage = { role: 'assistant', content: aiRes.message }
        setAiHistory([...history, assistantMsg])

        // Post AI response as a message with AI prefix
        const aiSent = await sendMessage(
          groupId,
          { body: `[AI ${aiProvider}] ${aiRes.message}` },
          auth,
        )
        mergeMessages([aiSent])
        atBottomRef.current = true
      } catch (err) {
        console.error('AI send failed:', err)
        setInput(text)
      }
    } else {
      try {
        const msg = await sendMessage(groupId, { body: text }, auth)
        mergeMessages([msg])
        atBottomRef.current = true
      } catch (err) {
        console.error('Send failed:', err)
        setInput(text)
      }
    }
    setSending(false)
  }

  const handleDelete = async (id: number) => {
    try {
      await deleteMessage(groupId, id, auth)
      setMessages(prev => {
        const next = new Map(prev)
        next.delete(id)
        return next
      })
    } catch (err) {
      console.error('Delete failed:', err)
    }
  }

  const handleVoiceSend = async (recording: VoiceRecording) => {
    try {
      setSending(true)
      const ext = recording.mimeType.includes('mp4') ? 'm4a' : 'webm'
      const fileName = `voice_${Date.now()}.${ext}`
      const { audioUrl, objectKey } = await uploadAudio(recording.blob, fileName, groupId)

      // Transcribe before sending (like the Flutter app does)
      let transcriptText: string | undefined
      let transcriptLang: string | undefined
      let transcriptionStatus = 'pending'
      try {
        const tr = await transcribeAudio(objectKey)
        transcriptText = tr.text
        transcriptLang = tr.language
        transcriptionStatus = transcriptText ? 'complete' : 'none'
      } catch {
        transcriptionStatus = 'none'
      }

      const msg = await sendMessage(
        groupId,
        {
          message_type: 'voice',
          audio_url: audioUrl,
          audio_duration_ms: recording.durationMs,
          transcript_text: transcriptText,
          transcript_lang: transcriptLang,
          transcription_status: transcriptionStatus,
        },
        auth,
      )
      mergeMessages([msg])
      atBottomRef.current = true
    } catch (err) {
      console.error('Voice send failed:', err)
    } finally {
      setSending(false)
    }
  }

  // Manual transcribe for existing voice messages
  const handleTranscribe = async (message: Message) => {
    if (!message.audio_url) return
    const objectKey = extractObjectKey(message.audio_url)
    if (!objectKey) return

    try {
      const tr = await transcribeAudio(objectKey)
      // Update the message on the server via PATCH
      const updated = await updateMessage(
        groupId,
        message.id,
        {
          transcript_text: tr.text,
          transcript_lang: tr.language,
          transcription_status: 'complete',
        },
        auth,
      )
      mergeMessages([updated])
    } catch (err) {
      console.error('Transcribe failed:', err)
      // Update status to failed locally so UI shows retry
      mergeMessages([{ ...message, transcription_status: 'failed' }])
    }
  }

  const handleMediaSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = '' // Reset input

    const { uploadMedia } = await import('../services/chat-service')
    try {
      setSending(true)
      const { media_url, content_type } = await uploadMedia(groupId, file, auth)
      const isVideo = content_type.startsWith('video/')
      const msg = await sendMessage(
        groupId,
        {
          message_type: isVideo ? 'video' : 'image',
          media_url,
          media_content_type: content_type,
          media_size: file.size,
        },
        auth,
      )
      mergeMessages([msg])
      atBottomRef.current = true
    } catch (err) {
      console.error('Media upload failed:', err)
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10 bg-slate-900/80 flex-shrink-0">
        <button onClick={onBack} className="md:hidden text-white/60 hover:text-white text-lg">
          &#x2190;
        </button>
        <h2
          className="text-white font-semibold truncate flex-1 cursor-pointer hover:text-sky-300 transition-colors"
          onClick={onInfo}
        >
          {groupName}
        </h2>
        <button
          onClick={() => {
            setAiMode(prev => !prev)
            if (!aiMode) setAiHistory([])
          }}
          className={`text-sm px-2.5 py-1 rounded-lg transition-colors ${
            aiMode
              ? 'bg-violet-500/20 text-violet-300 border border-violet-400/30'
              : 'text-white/50 hover:text-white hover:bg-white/10'
          }`}
          title={aiMode ? `AI on (${aiProvider}) — click to disable` : 'Enable AI mode'}
        >
          AI
        </button>
        {aiMode && (
          <select
            value={aiProvider}
            onChange={e => setAiProvider(e.target.value as AiProvider)}
            title="AI provider"
            className="text-xs bg-slate-800 border border-white/10 text-white/70 rounded px-1.5 py-0.5"
          >
            <option value="grok">Grok</option>
            <option value="openai">OpenAI</option>
          </select>
        )}
        <button
          onClick={onInfo}
          className="text-white/50 hover:text-white text-sm"
          title="Group info"
        >
          &#x2139;
        </button>
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-3 py-3"
      >
        {loadingOlder && (
          <div className="text-center text-white/40 text-sm py-2">Loading older...</div>
        )}
        {loading ? (
          <div className="text-center text-white/40 py-8">Loading messages...</div>
        ) : sortedMessages.length === 0 ? (
          <div className="text-center text-white/30 py-8">No messages yet. Say hello!</div>
        ) : (
          sortedMessages.map((msg, i) => {
            const prev = i > 0 ? sortedMessages[i - 1] : null
            const showDay =
              !prev ||
              new Date(msg.created_at).toDateString() !== new Date(prev.created_at).toDateString()

            return (
              <div key={msg.id}>
                {showDay && (
                  <div className="text-center text-white/30 text-xs py-2 my-1">
                    {dayLabel(msg.created_at)}
                  </div>
                )}
                <MessageBubble
                  message={msg}
                  isOwn={msg.user_id === currentUserId}
                  profile={profiles.get(msg.user_id)}
                  onDelete={msg.user_id === currentUserId ? handleDelete : undefined}
                  onTranscribe={msg.message_type === 'voice' && !msg.transcript_text ? handleTranscribe : undefined}
                />
              </div>
            )
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="flex-shrink-0 border-t border-white/10 bg-slate-900/80 px-3 py-2">
        <div className="flex gap-2 items-end max-w-3xl mx-auto">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-2.5 py-2 rounded-xl text-white/50 hover:text-white hover:bg-white/10 transition-colors"
            title="Attach image or video"
          >
            &#x1F4CE;
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/*"
            onChange={handleMediaSelect}
            className="hidden"
          />
          <VoiceRecorder onSend={handleVoiceSend} />
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSend()
              }
            }}
            placeholder="Type a message..."
            rows={1}
            className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm resize-none max-h-32 overflow-y-auto focus:outline-none focus:border-sky-400/50"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || sending}
            className="px-4 py-2 bg-sky-600 text-white rounded-xl text-sm font-medium disabled:opacity-40 hover:bg-sky-500 transition-colors"
          >
            {sending ? '...' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  )
}
