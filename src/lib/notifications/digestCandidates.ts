import { getFreshFitTier } from '@/lib/freshFitScore'

/**
 * OE 2.0 Phase 10 -- digest candidate selection (duplicate suppression
 * + "is this even digest-worthy" filtering), independent of the
 * heavier `JobMatchWithJob`/ranking shapes used by the member-facing
 * feed -- a digest only ever needs a handful of display fields, so this
 * takes the lightest input shape that does the job.
 */

export interface DigestCandidateMatch {
  id: string
  freshFitScore: number
  title: string
  company: string
  postingUrl: string | null
  dismissedAt: string | null
  promotedOpportunityId: string | null
}

/** Digests stay short and glanceable -- a distinct concern from `TOP_N_PER_MEMBER` (jobMatchPersistence.ts), which governs how many matches are persisted for on-site browsing, not how many belong in one email. */
export const MAX_MATCHES_PER_DIGEST = 5

/**
 * Selects which of a member's current matches belong in their next
 * digest:
 * - never dismissed, never already promoted (both already have their
 *   own dedicated surfaces -- a digest is for *new*, still-actionable
 *   matches only)
 * - 'fair' tier is excluded -- not exciting enough to justify an email;
 *   the on-site feed remains the place to see everything
 * - never a match_id already present in `previouslySentMatchIds`
 *   (duplicate suppression via `match_digest_log`)
 * - sorted by score descending, capped at `MAX_MATCHES_PER_DIGEST`
 */
export function selectDigestCandidates(
  matches: DigestCandidateMatch[],
  previouslySentMatchIds: string[]
): DigestCandidateMatch[] {
  const alreadySent = new Set(previouslySentMatchIds)

  return matches
    .filter((m) => m.dismissedAt === null)
    .filter((m) => m.promotedOpportunityId === null)
    .filter((m) => getFreshFitTier(m.freshFitScore) !== 'fair')
    .filter((m) => !alreadySent.has(m.id))
    .sort((a, b) => b.freshFitScore - a.freshFitScore)
    .slice(0, MAX_MATCHES_PER_DIGEST)
}
