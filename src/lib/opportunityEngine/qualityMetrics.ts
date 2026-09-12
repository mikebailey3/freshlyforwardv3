import type { FreshFitTier } from '@/lib/freshFitScore'
import { getFreshFitTier } from '@/lib/freshFitScore'

/**
 * OE 2.0 Phase 11 -- pure aggregation core for "does FreshFit's tier
 * actually correlate with real outcomes?" Deliberately reads only
 * already-existing, already-scored data (no new table, no new PII):
 * `job_matches.fresh_fit_score` -> tier (recomputed via the canonical
 * `getFreshFitTier`, never trusted from a possibly-stale persisted
 * breakdown snapshot -- same rule tiers.ts itself documents) ->
 * `job_matches.promoted_opportunity_id` -> whether that opportunity has
 * at least one row in `applications`.
 */

export interface MatchOutcomeInput {
  freshFitScore: number
  promotedOpportunityId: string | null
}

export interface TierQualityMetrics {
  tier: FreshFitTier
  totalMatches: number
  promotedCount: number
  /** null when totalMatches is 0 -- an undefined rate is never fabricated as 0%. */
  promotionRate: number | null
  appliedCount: number
  /** null when promotedCount is 0 -- same "never fabricate a rate from zero denominator" rule. */
  applicationRate: number | null
}

const TIER_ORDER: FreshFitTier[] = ['excellent', 'good', 'fair']

/**
 * `opportunityIdsWithApplications` is a Set for O(1) lookups -- the
 * caller (the script's `main`) builds it once from a bulk
 * `applications` fetch rather than this function querying anything
 * itself, keeping this pure and independently testable.
 */
export function computeQualityMetrics(
  matches: MatchOutcomeInput[],
  opportunityIdsWithApplications: Set<string>
): TierQualityMetrics[] {
  return TIER_ORDER.map((tier) => {
    const tierMatches = matches.filter((m) => getFreshFitTier(m.freshFitScore) === tier)
    const promoted = tierMatches.filter((m) => m.promotedOpportunityId !== null)
    const applied = promoted.filter(
      (m) => m.promotedOpportunityId !== null && opportunityIdsWithApplications.has(m.promotedOpportunityId)
    )

    return {
      tier,
      totalMatches: tierMatches.length,
      promotedCount: promoted.length,
      promotionRate: tierMatches.length > 0 ? promoted.length / tierMatches.length : null,
      appliedCount: applied.length,
      applicationRate: promoted.length > 0 ? applied.length / promoted.length : null,
    }
  })
}
