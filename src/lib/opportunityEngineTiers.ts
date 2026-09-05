/**
 * Presentation-only FreshFit grouping for the Opportunity Engine UI.
 *
 * IMPORTANT: These thresholds and labels are a Phase 1 UI convenience for
 * grouping an already-sorted list -- they are NOT validated business or
 * scoring thresholds. FreshFit's score distribution hasn't been calibrated
 * yet (a recent production run persisted zero matches at the real >=35
 * scoring/persistence threshold, which lives entirely separately in
 * `scripts/syncFreshFitScores.ts` and must never be confused with this
 * file). Nothing here changes what FreshFit computes or what gets written
 * to `job_matches` -- it only decides which of three neutral visual
 * buckets an already-computed score falls into on screen.
 *
 * The default numbers (75/50) match the existing `scoreColor()` split
 * already used elsewhere in the Opportunity Engine UI, kept only for
 * presentation consistency -- not because they're "correct." Both are
 * plain parameters, not constants baked into logic, so they can move
 * freely once real score distribution data exists.
 */

export type PresentationTier = 'highest' | 'stronger' | 'other'

export interface PresentationTierThresholds {
  highest: number
  stronger: number
}

export const DEFAULT_PRESENTATION_TIERS: PresentationTierThresholds = {
  highest: 75,
  stronger: 50,
}

/** Deliberately neutral, non-absolute copy -- avoids implying a validated
 * confidence level ("Excellent"/"Good") that FreshFit hasn't earned yet. */
export const PRESENTATION_TIER_LABELS: Record<PresentationTier, string> = {
  highest: 'Highest Fit',
  stronger: 'Stronger Fits',
  other: 'Other Matches',
}

export function getFreshFitTier(
  score: number,
  thresholds: PresentationTierThresholds = DEFAULT_PRESENTATION_TIERS
): PresentationTier {
  if (score >= thresholds.highest) return 'highest'
  if (score >= thresholds.stronger) return 'stronger'
  return 'other'
}
