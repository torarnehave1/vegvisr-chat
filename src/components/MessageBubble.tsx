import { useState } from 'react'
import type { Message, MemberProfile, AuthParams } from '../types/chat'
import { KnowledgeGraphCard } from './KnowledgeGraphCard'
import { YouTubeCard } from './YouTubeCard'
import { PollCardWithFetch } from './PollCard'
import type { MessageReactions, ReactionType } from '../services/chat-service'

const REACTION_EMOJI: Record<string, string> = {
  thumbs_up: '\uD83D\uDC4D',
  heart: '\u2764\uFE0F',
  smile: '\uD83D\uDE0A',
}

interface Props {
  message: Message
  isOwn: boolean
  profile?: MemberProfile
  onDelete?: (id: number) => void
  onTranscribe?: (message: Message) => Promise<void>
  auth?: AuthParams
  currentUserId?: string
  reactions?: MessageReactions
  onReact?: (messageId: number, reaction: ReactionType) => void
  onReply?: (message: Message) => void
  replyToMessage?: Message | null
  replyToProfile?: MemberProfile
  /** True when this message's author is the group's owner. Renders an OWNER
   * badge next to the display name and an amber accent ring on the avatar so
   * announcements stand out from regular member chatter (locked groups). */
  isOwner?: boolean
  /** Open the "forward to another group" picker. Shown to anyone who can read
   * the message. */
  onForward?: (message: Message) => void
  /** Open the "move to another group" picker. Shown only to the group owner
   * and Superadmins — caller decides. */
  onMove?: (message: Message) => void
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function formatDuration(ms: number): string {
  const totalSec = Math.round(ms / 1000)
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  if (m > 0) return `${m}:${s.toString().padStart(2, '0')}`
  return `${s}s`
}

// Extract YouTube video ID from various URL formats
function extractYouTubeId(url: string): string | null {
  try {
    const u = new URL(url)
    if (u.hostname === 'youtu.be') return u.pathname.slice(1).split('/')[0] || null
    if (u.hostname.includes('youtube.com') || u.hostname.includes('youtube-nocookie.com')) {
      if (u.pathname === '/watch') return u.searchParams.get('v')
      const embedMatch = u.pathname.match(/\/(?:embed|v|shorts)\/([^/?]+)/)
      if (embedMatch) return embedMatch[1]
    }
    return null
  } catch {
    return null
  }
}

// Extract graphId from vegvisr knowledge graph URLs
function extractGraphId(url: string): string | null {
  try {
    const u = new URL(url)
    if (!u.hostname.endsWith('vegvisr.org')) return null
    // /gnew-viewer?graphId=xxx
    if (u.pathname.startsWith('/gnew-viewer')) {
      const gid = u.searchParams.get('graphId')
      if (gid) return gid
      // /gnew-viewer/graphs/seo-slug — slug IS the graphId
      const slugMatch = u.pathname.match(/\/gnew-viewer\/graphs\/([^/]+)/)
      if (slugMatch) return slugMatch[1]
    }
    return null
  } catch {
    return null
  }
}

// URL regex for splitting text into parts
const URL_RE = /https?:\/\/[^\s<>"]+/g

interface TextPart {
  type: 'text' | 'link' | 'graph' | 'youtube'
  value: string
  graphId?: string
  youtubeId?: string
}

function parseTextWithLinks(text: string): TextPart[] {
  const parts: TextPart[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null
  URL_RE.lastIndex = 0
  while ((match = URL_RE.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: 'text', value: text.slice(lastIndex, match.index) })
    }
    const url = match[0]
    const graphId = extractGraphId(url)
    const youtubeId = extractYouTubeId(url)
    if (graphId) {
      parts.push({ type: 'graph', value: url, graphId })
    } else if (youtubeId) {
      parts.push({ type: 'youtube', value: url, youtubeId })
    } else {
      parts.push({ type: 'link', value: url })
    }
    lastIndex = match.index + url.length
  }
  if (lastIndex < text.length) {
    parts.push({ type: 'text', value: text.slice(lastIndex) })
  }
  return parts
}

export function MessageBubble({ message, isOwn, profile, onDelete, onTranscribe, auth, currentUserId, reactions, onReact, onReply, replyToMessage, replyToProfile, isOwner, onForward, onMove }: Props) {
  const msgType = message.message_type || 'text'
  const [transcribing, setTranscribing] = useState(false)
  const isBot = message.user_id?.startsWith('bot:')
  const displayName = profile?.displayName || message.email || message.phone || message.user_id?.slice(0, 8) || '?'
  const avatarUrl = profile?.profileimage

  const handleTranscribe = async () => {
    if (!onTranscribe || transcribing) return
    setTranscribing(true)
    try {
      await onTranscribe(message)
    } finally {
      setTranscribing(false)
    }
  }

  return (
    <div id={`msg-${message.id}`} className={`flex ${isOwn ? 'justify-end' : 'justify-start'} mb-1.5 group transition-all`}>
      {/* Avatar for other users */}
      {!isOwn && (
        <div className="flex-shrink-0 mr-2 mt-1">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={displayName}
              className={`w-7 h-7 rounded-full object-cover ${isOwner ? 'ring-2 ring-amber-400/60' : ''}`}
            />
          ) : (
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-medium ${
              isBot ? 'bg-violet-500/30 text-violet-300' : 'bg-white/10 text-white/60'
            } ${isOwner ? 'ring-2 ring-amber-400/60' : ''}`}>
              {isBot ? 'B' : displayName.charAt(0).toUpperCase()}
            </div>
          )}
        </div>
      )}
      <div
        className={`max-w-[75%] rounded-2xl px-3.5 py-2 ${
          isOwn
            ? 'bg-sky-600 text-white rounded-br-md'
            : 'bg-white/10 text-white rounded-bl-md'
        }`}
      >
        {!isOwn && (
          <div className="text-[11px] text-white/50 mb-0.5 flex items-center gap-1.5">
            <span>{displayName}</span>
            {isBot && <span className="text-[9px] bg-violet-500/30 text-violet-300 px-1 py-px rounded font-medium">BOT</span>}
            {isOwner && !isBot && <span className="text-[9px] bg-amber-500/30 text-amber-300 px-1 py-px rounded font-medium">OWNER</span>}
          </div>
        )}

        {/* Reply-to preview */}
        {replyToMessage && (
          <div
            className={`mb-1.5 px-2.5 py-1.5 rounded-lg border-l-2 cursor-pointer ${
              isOwn ? 'bg-sky-700/40 border-sky-300/50' : 'bg-white/5 border-sky-400/50'
            }`}
            onClick={() => {
              const el = document.getElementById(`msg-${replyToMessage.id}`)
              if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'center' })
                el.classList.add('ring-2', 'ring-sky-400/50', 'rounded-2xl')
                setTimeout(() => el.classList.remove('ring-2', 'ring-sky-400/50', 'rounded-2xl'), 2000)
              }
            }}
          >
            <div className="text-[10px] text-sky-300/80 font-medium">
              {replyToProfile?.displayName || replyToMessage.user_id?.slice(0, 8)}
            </div>
            <div className="text-[11px] text-white/50 truncate max-w-[200px]">
              {replyToMessage.message_type === 'voice' ? (replyToMessage.body || 'Voice message') :
               replyToMessage.message_type === 'image' ? 'Photo' :
               replyToMessage.message_type === 'video' ? 'Video' :
               replyToMessage.message_type === 'poll' ? 'Poll' :
               replyToMessage.body?.slice(0, 60) || '...'}
            </div>
          </div>
        )}

        {/* Forward attribution — small italic label above the body when this
            message was forwarded from another group. Name is denormalised on
            the worker side (forwarded_from_user_name) so we don't have to
            cross-resolve a profile that may not be a member of this group. */}
        {message.forwarded_from_message_id != null && (
          <div className="flex items-center gap-1 text-[10px] italic text-white/50 mb-1">
            <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 17 20 12 15 7" />
              <path d="M4 18v-2a4 4 0 0 1 4-4h12" />
            </svg>
            <span>Forwarded{message.forwarded_from_user_name ? ` from ${message.forwarded_from_user_name}` : ''}</span>
          </div>
        )}

        {/* Text */}
        {/* Bot 'thinking' placeholder — the worker inserts this before firing
            bot-respond and updates the row in place when the real reply lands. */}
        {msgType === 'bot_thinking' && (
          <div className="flex items-center gap-2 text-sm italic text-white/60">
            <span>{message.body || 'Thinking…'}</span>
            <span className="inline-flex gap-0.5">
              <span className="h-1.5 w-1.5 rounded-full bg-white/60 animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="h-1.5 w-1.5 rounded-full bg-white/60 animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="h-1.5 w-1.5 rounded-full bg-white/60 animate-bounce" style={{ animationDelay: '300ms' }} />
            </span>
          </div>
        )}

        {/* Bot error — when bot-respond failed or timed out and the placeholder
            got finalized as an error instead of a real reply. */}
        {msgType === 'bot_error' && (
          <p className="text-sm text-rose-300/90 italic">
            {message.body || 'Bot couldn’t reply — please try again.'}
          </p>
        )}

        {msgType === 'text' && message.body && (() => {
          const parts = parseTextWithLinks(message.body)
          const richCards = parts.filter(p => p.type === 'graph' || p.type === 'youtube')
          return (
            <div>
              <p className="text-sm whitespace-pre-wrap break-words">
                {parts.map((part, i) => {
                  if (part.type === 'text') return <span key={i}>{part.value}</span>
                  return (
                    <a key={i} href={part.value} target="_blank" rel="noopener noreferrer" className="text-sky-300 underline break-all hover:text-sky-200">
                      {part.value}
                    </a>
                  )
                })}
              </p>
              {richCards.map((p, i) =>
                p.type === 'graph' && p.graphId ? (
                  <KnowledgeGraphCard key={`g-${i}`} graphId={p.graphId} url={p.value} />
                ) : p.type === 'youtube' && p.youtubeId ? (
                  <YouTubeCard key={`yt-${i}`} videoId={p.youtubeId} url={p.value} />
                ) : null
              )}
            </div>
          )
        })()}

        {/* Voice */}
        {msgType === 'voice' && (
          <div>
            {/* Voice title / subject */}
            {message.body && (
              <p className="text-sm font-semibold mb-1.5 text-sky-300/90">
                {message.body}
              </p>
            )}
            <div className="flex items-center gap-2">
              <audio src={message.audio_url} controls className="max-w-full h-8" />
              {message.audio_duration_ms != null && (
                <span className="text-[11px] opacity-60 whitespace-nowrap">
                  {formatDuration(message.audio_duration_ms)}
                </span>
              )}
            </div>

            {/* Transcript display */}
            {message.transcript_text && (
              <p className="text-xs opacity-70 mt-1.5 italic leading-relaxed">
                {message.transcript_text}
              </p>
            )}

            {/* Transcription status / action */}
            {!message.transcript_text && (
              <div className="mt-1.5">
                {message.transcription_status === 'pending' || message.transcription_status === 'transcribing' ? (
                  <span className="text-[11px] opacity-50 italic">Transcribing...</span>
                ) : message.transcription_status === 'failed' ? (
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] text-rose-300/70">Transcription failed</span>
                    {onTranscribe && (
                      <button
                        onClick={handleTranscribe}
                        disabled={transcribing}
                        className="text-[11px] text-sky-300/80 hover:text-sky-200 underline"
                      >
                        Retry
                      </button>
                    )}
                  </div>
                ) : onTranscribe ? (
                  <button
                    onClick={handleTranscribe}
                    disabled={transcribing}
                    className="text-[11px] text-sky-300/70 hover:text-sky-200 underline transition-colors"
                  >
                    {transcribing ? 'Transcribing...' : 'Transcribe'}
                  </button>
                ) : null}
              </div>
            )}
          </div>
        )}

        {/* Image */}
        {msgType === 'image' && message.media_url && (
          <div>
            <img
              src={message.media_url}
              alt={message.body || 'Image'}
              className="rounded-lg max-w-full max-h-60 object-cover cursor-pointer"
              onClick={() => window.open(message.media_url, '_blank')}
            />
            {message.body && <p className="text-sm mt-1">{message.body}</p>}
          </div>
        )}

        {/* Video */}
        {msgType === 'video' && message.media_url && (
          <div>
            <video
              src={message.media_url}
              poster={message.video_thumbnail_url}
              controls
              className="rounded-lg max-w-full max-h-60"
            />
            {message.body && <p className="text-sm mt-1">{message.body}</p>}
          </div>
        )}

        {/* Poll */}
        {msgType === 'poll' && message.body && auth && currentUserId && (() => {
          const match = message.body.match(/^poll::([^:]+)::(.+)$/)
          if (!match) return <p className="text-sm">{message.body}</p>
          const pollId = match[1]
          return <PollCardWithFetch pollId={pollId} auth={auth} currentUserId={currentUserId} />
        })()}

        {/* Existing reactions display */}
        {reactions && Object.keys(reactions.counts).length > 0 && (
          <div className="flex gap-1 mt-1 flex-wrap">
            {Object.entries(reactions.counts).map(([r, count]) => {
              const isMine = reactions.mine.includes(r)
              return (
                <button
                  key={r}
                  type="button"
                  onClick={() => onReact?.(message.id, r as ReactionType)}
                  className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-xs transition-colors ${
                    isMine
                      ? 'bg-sky-500/20 border border-sky-400/30'
                      : 'bg-white/5 border border-white/10 hover:bg-white/10'
                  }`}
                >
                  <span>{REACTION_EMOJI[r]}</span>
                  <span className="text-[10px] text-white/60">{count}</span>
                </button>
              )
            })}
          </div>
        )}

        <div className="flex items-center justify-end gap-1.5 mt-0.5">
          {/* Reply + Reaction picker — visible on hover */}
          {onReply && (
            <button
              type="button"
              onClick={() => onReply(message)}
              className="text-[11px] opacity-0 group-hover:opacity-60 hover:!opacity-100 transition-opacity mr-0.5"
              title="Reply"
            >
              &#8617;
            </button>
          )}
          {onReact && (
            <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
              {(['thumbs_up', 'heart', 'smile'] as ReactionType[]).map(r => (
                <button
                  key={r}
                  type="button"
                  onClick={() => onReact(message.id, r)}
                  className="text-sm hover:scale-125 transition-transform px-0.5"
                  title={r.replace('_', ' ')}
                >
                  {REACTION_EMOJI[r]}
                </button>
              ))}
            </div>
          )}
          <span className="text-[10px] opacity-50">{formatTime(message.created_at)}</span>
          {onForward && (
            <button
              onClick={() => onForward(message)}
              className="p-1 rounded-md text-white/60 opacity-0 group-hover:opacity-70 hover:!opacity-100 hover:bg-sky-500/20 hover:text-sky-300 transition-all"
              title="Forward to another group"
              aria-label="Forward message"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 17 20 12 15 7" />
                <path d="M4 18v-2a4 4 0 0 1 4-4h12" />
              </svg>
            </button>
          )}
          {onMove && (
            <button
              onClick={() => onMove(message)}
              className="p-1 rounded-md text-white/60 opacity-0 group-hover:opacity-70 hover:!opacity-100 hover:bg-amber-500/20 hover:text-amber-300 transition-all"
              title="Move to another group (owner / Superadmin)"
              aria-label="Move message"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 9l4-4 4 4" />
                <path d="M9 5v8a4 4 0 0 0 4 4h6" />
                <polyline points="15 13 19 17 15 21" />
              </svg>
            </button>
          )}
          {onDelete && (
            <button
              onClick={() => onDelete(message.id)}
              className={`p-1 rounded-md text-white/60 opacity-0 group-hover:opacity-70 hover:!opacity-100 hover:bg-rose-500/20 hover:text-rose-300 transition-all ${isOwn ? '' : 'hover:bg-amber-500/20 hover:text-amber-300'}`}
              title={isOwn ? 'Delete message' : 'Delete (owner)'}
              aria-label={isOwn ? 'Delete message' : 'Delete message (owner)'}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                <path d="M10 11v6M14 11v6" />
                <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
