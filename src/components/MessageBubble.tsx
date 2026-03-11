import { useState } from 'react'
import type { Message, MemberProfile } from '../types/chat'

interface Props {
  message: Message
  isOwn: boolean
  profile?: MemberProfile
  onDelete?: (id: number) => void
  onTranscribe?: (message: Message) => Promise<void>
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

export function MessageBubble({ message, isOwn, profile, onDelete, onTranscribe }: Props) {
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
        {msgType === 'text' && (
          <p className="text-sm whitespace-pre-wrap break-words">{message.body}</p>
        )}

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
