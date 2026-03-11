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

    const poll = async () => {
      try {
        const res = await fetchMessages(groupId, auth, {
          after: lastTsRef.current,
          latest: true,
          limit: 100,
        })
        if (res.messages.length > 0) {
          onMsgsRef.current(res.messages)
        }
      } catch {
        // Silently retry on next poll
      }
    }

    const id = setInterval(poll, POLL_INTERVAL)
    return () => clearInterval(id)
  }, [groupId, auth])
}
