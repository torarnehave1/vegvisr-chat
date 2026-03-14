import { useEffect, useRef, useState } from 'react'

const POLL_INTERVAL = 60_000 // 60 seconds

/**
 * Polls /version.json to detect new deployments.
 * Returns true when the build hash changes from the one loaded at startup.
 * Works independently of service workers — reliable on all browsers and CDN configs.
 */
export function useVersionCheck() {
  const [updateAvailable, setUpdateAvailable] = useState(false)
  const initialHash = useRef<string | null>(null)

  useEffect(() => {
    let timer: ReturnType<typeof setInterval>

    const check = async () => {
      try {
        const res = await fetch('/version.json', { cache: 'no-store' })
        if (!res.ok) return
        const data = await res.json()
        const hash = data.buildHash as string
        if (!hash) return

        if (initialHash.current === null) {
          // First check — store the hash we loaded with
          initialHash.current = hash
        } else if (hash !== initialHash.current) {
          // Hash changed — new deploy detected
          setUpdateAvailable(true)
        }
      } catch {
        // Network error — silently ignore, will retry next interval
      }
    }

    // Check immediately on mount, then every 60s
    check()
    timer = setInterval(check, POLL_INTERVAL)

    return () => clearInterval(timer)
  }, [])

  const reload = () => window.location.reload()

  return { updateAvailable, reload }
}
