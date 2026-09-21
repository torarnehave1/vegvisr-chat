import { useEffect, useRef } from 'react'
import { fetchMessages } from '../services/chat-service'
import type { AuthParams, Message } from '../types/chat'
import type { ChatTransport } from '../../packages/shared-chat/src/contract'

const POLL_INTERVAL = 5000

export function usePolling(
  groupId: string | null,
  auth: AuthParams | null,
  lastTimestamp: number,
  onMessages: (msgs: Message[]) => void,
  transport?: ChatTransport,
  onError?: (error: Error) => void,
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
        const res = await (transport?.fetchMessages || fetchMessages)(groupId, auth, {
          after: lastTsRef.current,
          latest: !transport,
          limit: 100,
        })
        if (!disposed && res.messages.length > 0) {
          onMsgsRef.current(res.messages)
        }
      } catch (error) {
        if (!disposed && onError) onError(error instanceof Error ? error : new Error('Chatten kunne ikke oppdateres.'))
        // Silently retry on next poll
      } finally {
        running = false
      }
    }

    const id = setInterval(poll, POLL_INTERVAL)
    return () => { disposed = true; clearInterval(id) }
  }, [groupId, auth, transport, onError])
}
