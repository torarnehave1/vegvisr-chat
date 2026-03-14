import { useCallback, useEffect, useRef, useState } from 'react'

const KNOWLEDGE_BASE = 'https://knowledge.vegvisr.org'
const GRAPH_ID = 'graph_chat_new_features'
const STORAGE_KEY = 'whatsnew_seen_count'
const POLL_INTERVAL = 120_000 // 2 minutes (content changes are less urgent than code deploys)

/**
 * Polls the What's New knowledge graph to detect new feature entries.
 *
 * Compares the current node count against the last-seen count in localStorage.
 * Returns `hasNew: true` when new entries exist that the user hasn't seen.
 *
 * Scenarios:
 * - Agent adds a feature via add_whats_new → node count increases → hasNew = true
 * - User opens What's New page → call markSeen() → hasNew = false, count saved
 * - User returns next day → localStorage has the old count, new poll detects more → hasNew = true
 * - First visit ever → no localStorage entry → treats current count as baseline → hasNew = false
 */
export function useWhatsNewCheck() {
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
          // First ever check — save current count as baseline (no notification)
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

  /** Call when user opens the What's New page — marks all entries as seen */
  const markSeen = useCallback(() => {
    if (currentTotal.current !== null) {
      localStorage.setItem(STORAGE_KEY, String(currentTotal.current))
    }
    setHasNew(false)
    setNewCount(0)
  }, [])

  return { hasNew, newCount, markSeen }
}
