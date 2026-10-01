import type { ReactNode } from 'react'

interface Props {
  sidebar: ReactNode
  main: ReactNode | null
  showMain: boolean // On mobile: true = show main, false = show sidebar
}

export function ChatLayout({ sidebar, main, showMain }: Props) {
  return (
    <div className="flex h-full bg-surface">
      {/* Sidebar — always visible on desktop, hidden when chat open on mobile */}
      <div
        className={`w-full md:w-80 lg:w-[22rem] xl:w-[26rem] md:border-r md:border-line flex-shrink-0 ${
 showMain ? 'hidden md:flex md:flex-col' : 'flex flex-col'
 }`}
      >
        {sidebar}
      </div>

      {/* Main area — always visible on desktop, hidden when no chat on mobile */}
      <div
        className={`flex-1 min-w-0 ${
 showMain ? 'flex flex-col' : 'hidden md:flex md:flex-col'
 }`}
      >
        {main || (
          <div className="flex-1 flex items-center justify-center text-ink-faint">
            <p>Select a group to start chatting</p>
          </div>
        )}
      </div>
    </div>
  )
}
