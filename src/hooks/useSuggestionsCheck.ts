import { useCallback, useEffect, useRef, useState } from 'react'

const KNOWLEDGE_BASE = 'https://knowledge.vegvisr.org'
const POLL_INTERVAL = 120_000 // 2 minutes

/** Global suggestions graph — all groups share one feed. */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function graphIdFor(_groupId: string): string {
  return 'graph_chat_user_suggestions'
}
function storageKeyFor(_groupId: string): string {
  return 'suggestions_seen_count'
}

/**
 * Polls a group's Suggestions knowledge graph to detect new entries.
 * Same pattern as useWhatsNewCheck — compares node count against a per-group
 * localStorage baseline. No-ops when groupId is undefined (e.g. on the group
 * list, where no group is open).
 */
export function useSuggestionsCheck(groupId?: string) {
  const [hasNew, setHasNew] = useState(false)
  const [newCount, setNewCount] = useState(0)
  const currentTotal = useRef<number | null>(null)

  useEffect(() => {
    if (!groupId) return

    const GRAPH_ID = graphIdFor(groupId)
    const STORAGE_KEY = storageKeyFor(groupId)

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
    const timer = setInterval(check, POLL_INTERVAL)
    // On group switch (or unmount) clear the badge so a stale count from the
    // previous group doesn't carry over before the next poll lands.
    return () => {
      clearInterval(timer)
      setHasNew(false)
      setNewCount(0)
      currentTotal.current = null
    }
  }, [groupId])

  const markSeen = useCallback(() => {
    if (groupId && currentTotal.current !== null) {
      localStorage.setItem(storageKeyFor(groupId), String(currentTotal.current))
    }
    setHasNew(false)
    setNewCount(0)
  }, [groupId])

  return { hasNew, newCount, markSeen }
}
