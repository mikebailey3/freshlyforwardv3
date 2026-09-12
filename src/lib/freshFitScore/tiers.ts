import type { FreshFitTier } from './types'

/**
 * FreshFit score tiers -- reconciled for Opportunity Engine 2.0
 * (docs/superpowers/plans/2026-09-10-opportunity-engine-2.0-plan.md) to
 * the locked product decision: Excellent 75-100, Good 50-74, Fair
 * below 50.
 *
 * SUPERSEDES the FreshFit 2.0 (2026-09-05) 4-tier scheme
 * (Strong>=80/Good>=60/Fair>=40/Weak<40) -- that scheme is legacy and no
 * longer live. See the OE 2.0 plan's tier-reconciliation section for the
 * full list of every file this change touched and why persisted scores
 * are safe (tier is always recomputed from the numeric 0-100 score at
 * display time -- see opportunityEngine.ts::buildWhyItMatches -- never
 * trusted from a possibly-stale persisted `score_breakdown.v2.tier`
 * snapshot, so a historical row's *number* never needs to change for
 * its displayed tier to update correctly under the new bands).
 */
const EXCELLENT_THRESHOLD = 75
const GOOD_THRESHOLD = 50

export function getFreshFitTier(score: number): FreshFitTier {
  if (score >= EXCELLENT_THRESHOLD) return 'excellent'
  if (score >= GOOD_THRESHOLD) return 'good'
  return 'fair'
}

export const FRESHFIT_TIER_LABELS: Record<FreshFitTier, string> = {
  excellent: 'Excellent Match',
  good: 'Good Match',
  fair: 'Fair Match',
}

/** Tailwind classes for the score badge per tier -- shared so the member
 * and strategist Opportunity Engine pages never drift out of sync again. */
export const FRESHFIT_TIER_STYLES: Record<FreshFitTier, string> = {
  excellent: 'border-success-700 text-success-300',
  good: 'border-primary-700 text-primary-300',
  fair: 'border-warning-700 text-warning-300',
}
