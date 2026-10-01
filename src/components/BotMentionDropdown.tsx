import type { ChatBot } from '../types/chat'

interface Props {
  bots: ChatBot[]
  filter: string
  onSelect: (bot: ChatBot) => void
}

export function BotMentionDropdown({ bots, filter, onSelect }: Props) {
  const filtered = bots.filter(b =>
    b.username.toLowerCase().includes(filter.toLowerCase()) ||
    b.name.toLowerCase().includes(filter.toLowerCase())
  )

  if (filtered.length === 0) return null

  return (
    <div className="absolute bottom-full left-0 right-0 mb-1 mx-3 bg-surface-raised border border-line rounded-xl shadow-xl overflow-hidden max-h-48 overflow-y-auto z-10">
      {filtered.map(bot => (
        <button
          key={bot.id}
          onClick={() => onSelect(bot)}
          className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-surface-sunk transition-colors text-left"
        >
          {bot.avatar_url ? (
            <img src={bot.avatar_url} alt={bot.name} className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
          ) : (
            <div className="w-8 h-8 rounded-full bg-agent-soft text-agent flex items-center justify-center text-xs font-medium flex-shrink-0">
              B
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-ink truncate">{bot.name}</span>
              <span className="text-xs text-agent bg-agent-soft px-1.5 py-px rounded">BOT</span>
            </div>
            <span className="text-xs text-ink-faint">@{bot.username}</span>
          </div>
        </button>
      ))}
    </div>
  )
}
