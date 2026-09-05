import type { FreshFitTier } from './types'

/**
 * FreshFit score tiers -- replaces the old presentation-only 3-tier
 * grouping (`highest`/`stronger`/`other` at 75/50, previously duplicated
 * inline as `scoreColor()` in both OpportunityEnginePage.tsx and
 * StrategistOpportunityEnginePage.tsx) with one shared 4-tier scheme
 * matching the owner's specified examples exactly:
 *   82 -> Strong, 74/63 -> Good, 51/42 -> Fair, 31 -> Weak.
 * Thresholds are provisional pending real production score-distribution
 * data (same caveat the original tiers carried) -- see the design spec.
 */
const STRONG_THRESHOLD = 80
const GOOD_THRESHOLD = 60
const FAIR_THRESHOLD = 40

export function getFreshFitTier(score: number): FreshFitTier {
  if (score >= STRONG_THRESHOLD) return 'strong'
  if (score >= GOOD_THRESHOLD) return 'good'
  if (score >= FAIR_THRESHOLD) return 'fair'
  return 'weak'
}

export const FRESHFIT_TIER_LABELS: Record<FreshFitTier, string> = {
  strong: 'Strong Match',
  good: 'Good Match',
  fair: 'Fair Match',
  weak: 'Weak Match / Lower Confidence',
}

/** Tailwind classes for the score badge per tier -- shared so the member
 * and strategist Opportunity Engine pages never drift out of sync again. */
export const FRESHFIT_TIER_STYLES: Record<FreshFitTier, string> = {
  strong: 'border-success-300 text-success-700',
  good: 'border-primary-300 text-primary-700',
  fair: 'border-warning-300 text-warning-700',
  weak: 'border-neutral-300 text-neutral-600',
}
