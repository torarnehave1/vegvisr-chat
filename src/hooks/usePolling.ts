import { useEffect, useRef } from 'react'
import { fetchMessages } from '../services/chat-service'
import type { AuthParams, Message } from '../types/chat'

const POLL_INTERVAL = 5000

export function usePolling(
  groupId: string | null,
  auth: AuthParams | null,
  lastTimestamp: number,
  onMessages: (msgs: Message[]) => void,
) {
  const lastTsRef = useRef(lastTimestamp)
  const onMsgsRef = useRef(onMessages)

  // Keep refs current to avoid stale closures in the interval
  useEffect(() => { lastTsRef.current = lastTimestamp }, [lastTimestamp])
  useEffect(() => { onMsgsRef.current = onMessages }, [onMessages])

  useEffect(() => {
    if (!groupId || !auth) return
    let disposed = false
    let running = false

    const poll = async () => {
      if (disposed || running || document.hidden) return
      running = true
      try {
        const res = await fetchMessages(groupId, auth, {
          after: lastTsRef.current,
          latest: true,
          limit: 100,
        })
        if (!disposed && res.messages.length > 0) {
          onMsgsRef.current(res.messages)
        }
      } catch {
        // Silently retry on next poll
      } finally {
        running = false
      }
    }

    const id = setInterval(poll, POLL_INTERVAL)
    return () => { disposed = true; clearInterval(id) }
  }, [groupId, auth])
}
