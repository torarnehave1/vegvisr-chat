import { useState, useEffect, useRef, useCallback } from 'react'
import { fetchMessages, sendMessage, deleteMessage, fetchMemberProfiles, fetchGroupBots } from '../services/chat-service'
import { uploadAudio, transcribeAudio, extractObjectKey } from '../services/voice-service'
import { updateMessage } from '../services/chat-service'
import { sendAiMessage } from '../services/ai-service'
import type { AiProvider, AiMessage } from '../services/ai-service'
import { usePolling } from '../hooks/usePolling'
import { MessageBubble } from './MessageBubble'
import { VoiceRecorder } from './VoiceRecorder'
import type { VoiceRecording } from '../hooks/useVoiceRecorder'
import { BotMentionDropdown } from './BotMentionDropdown'
import type { AuthParams, Message, MemberProfile, ChatBot } from '../types/chat'

interface Props {
  groupId: string
  groupName: string
  auth: AuthParams
  currentUserId: string
  profileVersion?: number
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

export function GroupChat({ groupId, groupName, auth, currentUserId, profileVersion, onBack, onInfo }: Props) {
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
  const [bots, setBots] = useState<ChatBot[]>([])
  const [mentionFilter, setMentionFilter] = useState<string | null>(null) // null = dropdown hidden
  const [activeBotBanner, setActiveBotBanner] = useState<ChatBot | null>(null)
  const [pendingMedia, setPendingMedia] = useState<{ file: File; previewUrl: string } | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const atBottomRef = useRef(true)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

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

  // Fetch member profiles (re-fetch when profileVersion changes, e.g. after settings save)
  useEffect(() => {
    fetchMemberProfiles(groupId, auth)
      .then(setProfiles)
      .catch(console.error)
  }, [groupId, auth, profileVersion])

  // Fetch bots in group
  useEffect(() => {
    fetchGroupBots(groupId, auth).then(setBots).catch(() => setBots([]))
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

  // Detect @mention while typing
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value
    setInput(val)

    // Find if cursor is inside an @mention
    const cursorPos = e.target.selectionStart ?? val.length
    const textBeforeCursor = val.slice(0, cursorPos)
    const mentionMatch = textBeforeCursor.match(/@([a-z0-9_-]*)$/i)

    if (mentionMatch && bots.length > 0) {
      setMentionFilter(mentionMatch[1])
    } else {
      setMentionFilter(null)
    }

    // Update bot banner based on full input
    const allMentions = val.match(/@([a-z0-9_-]+)/gi) || []
    const mentionedBot = allMentions.length > 0
      ? bots.find(b => allMentions.some(m => m.slice(1).toLowerCase() === b.username.toLowerCase()))
      : null
    setActiveBotBanner(mentionedBot || null)
  }

  const handleBotSelect = (bot: ChatBot) => {
    const textarea = inputRef.current
    if (!textarea) return

    const cursorPos = textarea.selectionStart ?? input.length
    const textBeforeCursor = input.slice(0, cursorPos)
    const textAfterCursor = input.slice(cursorPos)

    // Replace the partial @mention with the full @username
    const replaced = textBeforeCursor.replace(/@[a-z0-9_-]*$/i, `@${bot.username} `)
    setInput(replaced + textAfterCursor)
    setMentionFilter(null)
    setActiveBotBanner(bot)

    // Refocus textarea
    requestAnimationFrame(() => {
      textarea.focus()
      const newPos = replaced.length
      textarea.setSelectionRange(newPos, newPos)
    })
  }

  const handleMediaFile = async (file: File) => {
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

  const stageMedia = (file: File) => {
    const previewUrl = URL.createObjectURL(file)
    setPendingMedia({ file, previewUrl })
  }

  const confirmMedia = () => {
    if (!pendingMedia) return
    handleMediaFile(pendingMedia.file)
    URL.revokeObjectURL(pendingMedia.previewUrl)
    setPendingMedia(null)
  }

  const cancelMedia = () => {
    if (!pendingMedia) return
    URL.revokeObjectURL(pendingMedia.previewUrl)
    setPendingMedia(null)
  }

  const handleMediaSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    stageMedia(file)
  }

  // Paste image from clipboard
  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items
    if (!items) return
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault()
        const file = item.getAsFile()
        if (file) stageMedia(file)
        return
      }
    }
  }

  // Drag & drop
  const [dragOver, setDragOver] = useState(false)

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
    setDragOver(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
  }

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)

    // Case 1: Dropped file(s) from desktop or file picker
    const file = e.dataTransfer.files[0]
    if (file && (file.type.startsWith('image/') || file.type.startsWith('video/'))) {
      stageMedia(file)
      return
    }

    // Case 2: Dropped image URL from another web app (e.g. photos app)
    // Try to extract image URL from HTML or plain text
    const html = e.dataTransfer.getData('text/html')
    const plainUrl = e.dataTransfer.getData('text/uri-list') || e.dataTransfer.getData('text/plain')

    let imageUrl: string | null = null
    if (html) {
      const match = html.match(/<img[^>]+src=["']([^"']+)["']/)
      if (match) imageUrl = match[1]
    }
    if (!imageUrl && plainUrl && /^https?:\/\/.+\.(png|jpe?g|gif|webp|svg|mp4|webm|mov)/i.test(plainUrl)) {
      imageUrl = plainUrl.trim()
    }

    if (imageUrl) {
      try {
        const res = await fetch(imageUrl)
        const blob = await res.blob()
        if (blob.type.startsWith('image/') || blob.type.startsWith('video/')) {
          const ext = blob.type.split('/')[1]?.split(';')[0] || 'png'
          const droppedFile = new File([blob], `dropped_${Date.now()}.${ext}`, { type: blob.type })
          stageMedia(droppedFile)
        }
      } catch (err) {
        console.error('Failed to fetch dropped image URL:', err)
      }
    }
  }

  return (
    <div
      className="flex flex-col h-full relative"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
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

      {/* Bot description banner */}
      {activeBotBanner && (
        <div className="flex-shrink-0 border-t border-violet-400/20 bg-violet-500/10 px-4 py-2 flex items-center gap-3">
          {activeBotBanner.avatar_url ? (
            <img src={activeBotBanner.avatar_url} alt={activeBotBanner.name} className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
          ) : (
            <div className="w-8 h-8 rounded-full bg-violet-500/30 text-violet-300 flex items-center justify-center text-xs font-medium flex-shrink-0">B</div>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-violet-200">{activeBotBanner.name}</span>
              <span className="text-[10px] text-violet-300 bg-violet-500/20 px-1.5 py-px rounded">@{activeBotBanner.username}</span>
            </div>
            {activeBotBanner.system_prompt && (
              <p className="text-xs text-white/40 truncate mt-0.5">{activeBotBanner.system_prompt}</p>
            )}
          </div>
          <button
            onClick={() => setActiveBotBanner(null)}
            className="text-white/30 hover:text-white/60 text-sm flex-shrink-0"
          >&#x2715;</button>
        </div>
      )}

      {/* Media preview before sending */}
      {pendingMedia && (
        <div className="flex-shrink-0 border-t border-white/10 bg-slate-900/80 px-3 py-2">
          <div className="max-w-3xl mx-auto flex items-center gap-3">
            {pendingMedia.file.type.startsWith('video/') ? (
              <video src={pendingMedia.previewUrl} className="h-20 rounded-lg object-cover" />
            ) : (
              <img src={pendingMedia.previewUrl} alt="Preview" className="h-20 rounded-lg object-cover" />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm text-white/70 truncate">{pendingMedia.file.name}</p>
              <p className="text-[11px] text-white/40">{(pendingMedia.file.size / 1024).toFixed(0)} KB</p>
            </div>
            <button
              onClick={confirmMedia}
              disabled={sending}
              className="px-4 py-2 bg-sky-600 text-white rounded-xl text-sm font-medium disabled:opacity-40 hover:bg-sky-500 transition-colors"
            >
              {sending ? '...' : 'Send'}
            </button>
            <button
              onClick={cancelMedia}
              disabled={sending}
              className="px-3 py-2 text-white/50 hover:text-rose-400 rounded-xl text-sm transition-colors"
              title="Cancel"
            >
              &#x2715;
            </button>
          </div>
        </div>
      )}

      {/* Input */}
      <div className="flex-shrink-0 border-t border-white/10 bg-slate-900/80 px-3 py-2 relative">
        {/* @mention dropdown */}
        {mentionFilter !== null && bots.length > 0 && (
          <BotMentionDropdown
            bots={bots}
            filter={mentionFilter}
            onSelect={handleBotSelect}
          />
        )}
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
            ref={inputRef}
            value={input}
            onChange={handleInputChange}
            onPaste={handlePaste}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                setMentionFilter(null)
                handleSend()
              }
              if (e.key === 'Escape') {
                setMentionFilter(null)
              }
            }}
            placeholder={bots.length > 0 ? 'Type @ to mention a bot...' : 'Type a message...'}
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

      {/* Drag overlay */}
      {dragOver && (
        <div className="absolute inset-0 bg-sky-600/20 border-2 border-dashed border-sky-400 rounded-xl flex flex-col items-center justify-center z-50 pointer-events-none">
          <span className="text-sky-200 text-lg font-medium bg-slate-900/80 px-6 py-3 rounded-xl">Drop image or video here</span>
          <span className="text-sky-200/50 text-xs mt-2 bg-slate-900/80 px-4 py-1 rounded-lg">From desktop, file picker, or another app</span>
        </div>
      )}
    </div>
  )
}
