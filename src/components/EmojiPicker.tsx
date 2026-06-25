import { useState, useRef, useEffect } from 'react'

const EMOJI_CATEGORIES: { label: string; emojis: string[] }[] = [
  {
    label: 'Smileys',
    emojis: ['😀','😂','🤣','😊','😍','🥰','😘','😎','🤩','🥳','😇','🤗','🤔','😏','😢','😭','😤','🤯','🥺','😱','🤮','🤧','😴','💀','👻','🤡','😈'],
  },
  {
    label: 'Gestures',
    emojis: ['👍','👎','👏','🙌','🤝','✌️','🤞','🤟','🤘','👌','🫶','💪','🙏','👋','🫡','🤙','👆','👇','👈','👉','✋','🖐️','🤚'],
  },
  {
    label: 'Hearts',
    emojis: ['❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','❣️','💕','💖','💗','💘','💝','💞'],
  },
  {
    label: 'Objects',
    emojis: ['🔥','⭐','✨','💡','🎉','🎊','🎁','🏆','🥇','💰','📱','💻','🎮','🎵','🎶','📸','🔔','📌','✅','❌','⚠️','💬','🗣️','📝','📚','🔗','⏰'],
  },
  {
    label: 'Nature',
    emojis: ['☀️','🌙','⭐','🌈','🌊','🌸','🌺','🌻','🍀','🌲','🐶','🐱','🐦','🦋','🐝','🐠','🦊','🐻','🐼','🦁','🐯','🐸','🐵'],
  },
  {
    label: 'Food',
    emojis: ['🍕','🍔','🌮','🍟','🍩','🍪','🎂','🍰','☕','🍺','🍷','🥂','🧃','🍎','🍊','🍋','🍓','🍑','🥑','🌶️'],
  },
  {
    label: 'Flags',
    emojis: ['🇳🇴','🇮🇸','🇩🇰','🇸🇪','🇫🇮','🇳🇱','🇩🇪','🇫🇷','🇬🇧','🇺🇸','🇪🇸','🇮🇹','🇵🇹','🇧🇷','🇯🇵','🇰🇷','🇨🇳','🇮🇳','🇦🇺','🏳️‍🌈'],
  },
]

interface Props {
  onSelect: (emoji: string) => void
}

export function EmojiPicker({ onSelect }: Props) {
  const [open, setOpen] = useState(false)
  const [activeCategory, setActiveCategory] = useState(0)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="px-2.5 py-2 rounded-xl text-slate-500 dark:text-white/50 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-white/10 transition-colors text-lg"
        title="Emoji"
      >
        😊
      </button>

      {open && (
        <div className="absolute bottom-12 left-0 w-72 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden">
          {/* Category tabs */}
          <div className="flex gap-0.5 px-1 py-1.5 border-b border-slate-200 dark:border-white/10 overflow-x-auto">
            {EMOJI_CATEGORIES.map((cat, i) => (
              <button
                key={cat.label}
                type="button"
                onClick={() => setActiveCategory(i)}
                className={`px-2 py-1 rounded-lg text-[11px] whitespace-nowrap transition-colors ${
                  activeCategory === i
                    ? 'bg-sky-600/30 text-sky-300'
                    : 'text-slate-400 dark:text-white/40 hover:text-slate-600 dark:hover:text-white/70 hover:bg-slate-100 dark:hover:bg-white/5'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Emoji grid */}
          <div className="p-2 h-48 overflow-y-auto">
            <div className="grid grid-cols-8 gap-0.5">
              {EMOJI_CATEGORIES[activeCategory].emojis.map(emoji => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => {
                    onSelect(emoji)
                    setOpen(false)
                  }}
                  className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-200 dark:hover:bg-white/10 transition-colors text-lg"
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
