import { useEffect, useState } from 'react'

/**
 * Browser-fired "Add to Home Screen" event. Only Chromium fires this; Safari
 * does not — iOS users have to use the Share menu manually.
 */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const DISMISS_KEY = 'install_prompt_dismissed_at'
const DISMISS_TTL_MS = 1000 * 60 * 60 * 24 * 30 // 30 days

function isIosSafari(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  const isIos = /iphone|ipad|ipod/i.test(ua)
  // Exclude in-app Chrome (crios), Firefox (fxios), Edge (edgios), Opera (opios)
  const isOtherBrowser = /crios|fxios|edgios|opios/i.test(ua)
  return isIos && !isOtherBrowser
}

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  if (window.matchMedia('(display-mode: standalone)').matches) return true
  // iOS-specific flag
  return (navigator as Navigator & { standalone?: boolean }).standalone === true
}

function isDismissed(): boolean {
  try {
    const raw = localStorage.getItem(DISMISS_KEY)
    if (!raw) return false
    const ts = Number(raw)
    if (!ts) return false
    return Date.now() - ts < DISMISS_TTL_MS
  } catch {
    return false
  }
}

export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null)
  const [showIosTip, setShowIosTip] = useState(false)
  const [hidden, setHidden] = useState(false)

  useEffect(() => {
    if (isStandalone() || isDismissed()) return

    if (isIosSafari()) {
      setShowIosTip(true)
      return
    }

    const handler = (e: Event) => {
      e.preventDefault()
      setDeferred(e as BeforeInstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', handler)

    const installedHandler = () => {
      setDeferred(null)
      setHidden(true)
    }
    window.addEventListener('appinstalled', installedHandler)

    return () => {
      window.removeEventListener('beforeinstallprompt', handler)
      window.removeEventListener('appinstalled', installedHandler)
    }
  }, [])

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()))
    } catch {
      /* ignore */
    }
    setHidden(true)
  }

  const handleInstall = async () => {
    if (!deferred) return
    try {
      await deferred.prompt()
      const choice = await deferred.userChoice
      if (choice.outcome === 'accepted') {
        setHidden(true)
      } else {
        dismiss()
      }
    } catch {
      dismiss()
    } finally {
      setDeferred(null)
    }
  }

  if (hidden) return null

  // Android / desktop Chrome: native prompt is available
  if (deferred) {
    return (
      <div
        className="fixed left-0 right-0 z-40 flex items-center justify-center gap-3 border-t border-violet-400/30 bg-white/95 dark:bg-slate-900/95 px-4 py-3 backdrop-blur-sm"
        style={{ bottom: 0, paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
      >
        <span className="text-sm text-slate-700 dark:text-white/80">Install Vegvisr Chat for a faster, full-screen experience.</span>
        <button
          type="button"
          onClick={handleInstall}
          className="rounded-lg bg-violet-500 px-3 py-1 text-xs font-semibold text-slate-900 dark:text-white hover:bg-violet-400 transition-colors"
        >
          Install
        </button>
        <button
          type="button"
          onClick={dismiss}
          className="ml-1 p-1 text-slate-400 dark:text-white/40 hover:text-slate-700 dark:hover:text-white/80 transition-colors"
          aria-label="Dismiss"
        >
          ✕
        </button>
      </div>
    )
  }

  // iOS Safari: instructional tip (no programmatic install)
  if (showIosTip) {
    return (
      <div
        className="fixed left-0 right-0 z-40 flex items-center justify-center gap-3 border-t border-violet-400/30 bg-white/95 dark:bg-slate-900/95 px-4 py-3 backdrop-blur-sm"
        style={{ bottom: 0, paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
      >
        <span className="text-xs text-slate-700 dark:text-white/80 text-center">
          To install: tap <span className="inline-block px-1.5 py-0.5 rounded bg-slate-200 dark:bg-white/10 text-slate-900 dark:text-white">Share</span> then <strong>Add to Home Screen</strong>.
        </span>
        <button
          type="button"
          onClick={dismiss}
          className="ml-1 p-1 text-slate-400 dark:text-white/40 hover:text-slate-700 dark:hover:text-white/80 transition-colors"
          aria-label="Dismiss"
        >
          ✕
        </button>
      </div>
    )
  }

  return null
}
