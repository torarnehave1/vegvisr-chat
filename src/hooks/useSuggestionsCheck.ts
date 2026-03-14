import { useCallback, useEffect, useRef, useState } from 'react'

const KNOWLEDGE_BASE = 'https://knowledge.vegvisr.org'
const GRAPH_ID = 'graph_chat_user_suggestions'
const STORAGE_KEY = 'suggestions_seen_count'
const POLL_INTERVAL = 120_000 // 2 minutes

/**
 * Polls the User Suggestions knowledge graph to detect new entries.
 * Same pattern as useWhatsNewCheck — compares node count against localStorage baseline.
 */
export function useSuggestionsCheck() {
  const [hasNew, setHasNew] = useState(false)
  const [newCount, setNewCount] = useState(0)
  const currentTotal = useRef<number | null>(null)

  useEffect(() => {
    let timer: ReturnType<typeof setInterval>

    const check = async () => {
      try {
        const res = await fetch(
          `${KNOWLEDGE_BASE}/getknowgraph?id=${encodeURIComponent(GRAPH_ID)}`
        )
        if (!res.ok) return
        const data = await res.json()
        const nodes = (data.nodes || []).filter(
          (n: { label?: string; info?: string }) => n.label && n.info
        )
        const total = nodes.length
        currentTotal.current = total

        const seenStr = localStorage.getItem(STORAGE_KEY)
        if (seenStr === null) {
          localStorage.setItem(STORAGE_KEY, String(total))
          return
        }

        const seen = parseInt(seenStr, 10)
        if (total > seen) {
          setHasNew(true)
          setNewCount(total - seen)
        } else {
          setHasNew(false)
          setNewCount(0)
        }
      } catch {
        // Silently ignore — will retry next interval
      }
    }

    check()
    timer = setInterval(check, POLL_INTERVAL)
    return () => clearInterval(timer)
  }, [])

  const markSeen = useCallback(() => {
    if (currentTotal.current !== null) {
      localStorage.setItem(STORAGE_KEY, String(currentTotal.current))
    }
    setHasNew(false)
    setNewCount(0)
  }, [])

  return { hasNew, newCount, markSeen }
}
