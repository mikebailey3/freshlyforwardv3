// src/hooks/useTopJobMatch.ts
import { useEffect, useState } from 'react'
import { getJobMatches } from '@/lib/opportunityEngine'
import type { JobMatchWithJob } from '@/types'

export interface UseTopJobMatchResult {
  topMatch: JobMatchWithJob | null
  loading: boolean
}

/**
 * Fetches the single strongest active (non-dismissed) job match for the
 * Dashboard's Opportunity Engine teaser card. Reuses `getJobMatches`
 * as-is (already sorted by fresh_fit_score desc) rather than adding a
 * second, competing query -- the "top" match is simply its first result.
 *
 * Deliberately its own small hook (mirroring useForwardScore's
 * fetch-hook pattern) instead of folding into DashboardPage's own
 * combined data-loading effect, so that already-large file doesn't grow
 * further -- this is the entire footprint DashboardPage.tsx needs to
 * carry for Phase 1's "light" Dashboard integration.
 */
export function useTopJobMatch(userId: string | undefined): UseTopJobMatchResult {
  const [topMatch, setTopMatch] = useState<JobMatchWithJob | null>(null)
  const [loading, setLoading] = useState(!!userId)

  useEffect(() => {
    if (!userId) {
      setTopMatch(null)
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)

    getJobMatches(userId)
      .then((matches) => {
        if (cancelled) return
        setTopMatch(matches[0] ?? null)
        setLoading(false)
      })
      .catch(() => {
        // Fail-closed: an unexpected rejection degrades to "no teaser
        // card" rather than leaving loading stuck true forever.
        if (cancelled) return
        setTopMatch(null)
        setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [userId])

  return { topMatch, loading }
}
