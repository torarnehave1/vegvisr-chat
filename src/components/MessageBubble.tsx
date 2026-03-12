import { useState } from 'react'
import type { Message, MemberProfile, AuthParams } from '../types/chat'
import { KnowledgeGraphCard } from './KnowledgeGraphCard'
import { YouTubeCard } from './YouTubeCard'
import { PollCardWithFetch } from './PollCard'

interface Props {
  message: Message
  isOwn: boolean
  profile?: MemberProfile
  onDelete?: (id: number) => void
  onTranscribe?: (message: Message) => Promise<void>
  auth?: AuthParams
  currentUserId?: string
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

export function MessageBubble({ message, isOwn, profile, onDelete, onTranscribe, auth, currentUserId }: Props) {
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
    <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'} mb-1.5 group`}>
      {/* Avatar for other users */}
      {!isOwn && (
        <div className="flex-shrink-0 mr-2 mt-1">
          {avatarUrl ? (
            <img src={avatarUrl} alt={displayName} className="w-7 h-7 rounded-full object-cover" />
          ) : (
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-medium ${
              isBot ? 'bg-violet-500/30 text-violet-300' : 'bg-white/10 text-white/60'
            }`}>
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
          </div>
        )}

        {/* Text */}
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

        <div className="flex items-center justify-end gap-1.5 mt-0.5">
          <span className="text-[10px] opacity-50">{formatTime(message.created_at)}</span>
          {isOwn && onDelete && (
            <button
              onClick={() => onDelete(message.id)}
              className="text-[10px] opacity-0 group-hover:opacity-50 hover:!opacity-100 transition-opacity"
              title="Delete"
            >
              &#x2715;
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
