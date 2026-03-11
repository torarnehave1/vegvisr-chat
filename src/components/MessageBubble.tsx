import type { Message } from '../types/chat'

interface Props {
  message: Message
  isOwn: boolean
  onDelete?: (id: number) => void
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export function MessageBubble({ message, isOwn, onDelete }: Props) {
  const msgType = message.type || 'text'

  return (
    <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'} mb-1.5 group`}>
      <div
        className={`max-w-[75%] rounded-2xl px-3.5 py-2 ${
          isOwn
            ? 'bg-sky-600 text-white rounded-br-md'
            : 'bg-white/10 text-white rounded-bl-md'
        }`}
      >
        {!isOwn && (
          <div className="text-[11px] text-white/50 mb-0.5">
            {message.email || message.phone || message.user_id}
          </div>
        )}

        {/* Text */}
        {msgType === 'text' && (
          <p className="text-sm whitespace-pre-wrap break-words">{message.body}</p>
        )}

        {/* Voice */}
        {msgType === 'voice' && (
          <div>
            <audio src={message.audio_url} controls className="max-w-full h-8" />
            {message.audio_duration_ms && (
              <span className="text-[11px] opacity-60 ml-1">
                {Math.round(message.audio_duration_ms / 1000)}s
              </span>
            )}
            {message.transcript_text && (
              <p className="text-xs opacity-70 mt-1 italic">{message.transcript_text}</p>
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
