/**
 * Persistence & ranking policy for FreshFit 2.0's per-member job matches.
 * Pure functions, no Supabase/DB dependency -- scripts/syncFreshFitScores.ts
 * calls these after scoring, and they're independently unit-testable
 * without a database.
 *
 * Replaces the old engine's single hard cutoff (`MIN_SCORE_TO_STORE = 35`,
 * which silently dropped anything below it with no ranking) per the
 * owner's explicit requirement: score everything, keep a low noise floor,
 * persist a member's Top N regardless of the old cutoff, re-rank on every
 * run, and prune only the rows this sync script itself owns.
 */

/** Below this score, a match isn't worth persisting at all for anyone --
 * distinct from and much lower than the old MIN_SCORE_TO_STORE=35 cutoff,
 * which conflated "not top-tier" with "not worth keeping." */
export const NOISE_FLOOR = 20

/** Per member, keep at most this many ranked matches -- re-ranked fresh
 * on every sync run, not persisted as a stored rank. */
export const TOP_N_PER_MEMBER = 25

export interface ScoredCandidate {
  scrapedJobId: string
  score: number
}

/**
 * Given every scored (member, job) candidate for one member, returns the
 * set of scraped_job_ids that should be persisted this run: above the
 * noise floor, ranked by score, capped at the Top N. Ties broken by
 * original order (stable sort) -- good enough for V1; nothing in the
 * product requires deterministic tie-breaking beyond "don't crash."
 */
export function selectMatchesToPersist(
  candidates: ScoredCandidate[],
  noiseFloor: number = NOISE_FLOOR,
  topN: number = TOP_N_PER_MEMBER
): Set<string> {
  const aboveFloor = candidates.filter((c) => c.score >= noiseFloor)
  const ranked = [...aboveFloor].sort((a, b) => b.score - a.score)
  return new Set(ranked.slice(0, topN).map((c) => c.scrapedJobId))
}

export interface ExistingMatchRow {
  id: string
  scrapedJobId: string
  engineVersion: number
  dismissedAt: string | null
  promotedOpportunityId: string | null
}

/**
 * Given a member's existing persisted job_matches rows and the freshly
 * computed set of scrapedJobIds that should survive this run, returns the
 * row ids that are safe to delete: this sync script only ever prunes rows
 * it owns (`engineVersion === 2`) that a member/strategist hasn't acted
 * on (`dismissedAt` and `promotedOpportunityId` both null) and that fell
 * out of the new Top N. Action history (dismissed/promoted) and any
 * legacy engine_version=1 row are never touched by this function --
 * they're either meaningful history or someone else's data to manage.
 */
export function selectStaleMatchesToPrune(existingRows: ExistingMatchRow[], keepJobIds: Set<string>): string[] {
  return existingRows
    .filter(
      (row) =>
        row.engineVersion === 2 &&
        row.dismissedAt === null &&
        row.promotedOpportunityId === null &&
        !keepJobIds.has(row.scrapedJobId)
    )
    .map((row) => row.id)
}
