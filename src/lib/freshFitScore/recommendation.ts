import type { FreshFitHardConstraint, FreshFitRecommendation, FreshFitTier } from './types'

/**
 * FreshFit's "is this worth pursuing / what should I do next" answer --
 * a deterministic rule table, mirroring forwardScore/nextBestMove.ts's
 * exact shape and technique (fixed rule order, one matched result, no
 * free-text generation, no AI/LLM call). Every possible output is one of
 * a small, fixed, enumerable set.
 *
 * Rule order (checked top to bottom, first match wins):
 * 1. Any hard constraint confirmed BLOCKED -> always surface that first,
 *    regardless of how high the score is -- a blocked constraint means
 *    there's something the member needs to read before deciding.
 * 2. Tier-based default (excellent/good).
 * 3. Fair tier (OE 2.0 locked band: score < 50) splits further by raw
 *    score AND confirmed gaps -- see FAIR_LOW_CONFIDENCE_THRESHOLD below.
 *
 * Reconciliation note (OE 2.0 tier-band change,
 * docs/superpowers/plans/2026-09-10-opportunity-engine-2.0-plan.md):
 * the legacy 4-tier scheme had a distinct "Weak" tier (score < 40) whose
 * whole purpose was to produce 'likely_not_a_fit' for genuinely low
 * scores. Folding Weak into the new, wider Fair band (score < 50) must
 * not silently delete that signal -- a 5/100 match and a 45/100 match
 * are not the same "worth a look." So this module takes the raw score
 * as an explicit param and re-derives that same low-confidence signal
 * *within* Fair, using the legacy Weak boundary's value (40) as
 * FAIR_LOW_CONFIDENCE_THRESHOLD -- the displayed tier badge only ever
 * shows "Fair," but the recommendation underneath keeps its original
 * nuance.
 */
const FAIR_LOW_CONFIDENCE_THRESHOLD = 40

export function computeRecommendation(
  tier: FreshFitTier,
  hardConstraints: FreshFitHardConstraint[],
  hasConfirmedGaps: boolean,
  score: number
): FreshFitRecommendation {
  const hasBlocker = hardConstraints.some((c) => c.status === 'hard_blocker')
  if (hasBlocker) {
    return {
      key: 'read_details_first',
      headline: 'Read the details before pursuing this one',
      detail: 'One or more requirements on this role conflict with what you\'ve told us -- worth a careful look before applying.',
    }
  }

  if (tier === 'excellent') {
    return {
      key: 'strong_pursue',
      headline: 'Excellent match -- worth pursuing',
      detail: 'This role lines up well across the dimensions FreshFit checks.',
    }
  }

  if (tier === 'good') {
    return {
      key: 'worth_a_look',
      headline: 'Worth a look',
      detail: 'This role is a reasonably good fit overall.',
    }
  }

  // tier === 'fair' (score < 50)
  if (score < FAIR_LOW_CONFIDENCE_THRESHOLD) {
    return {
      key: 'likely_not_a_fit',
      headline: 'Likely not a strong fit',
      detail: 'This role scores low across most of the dimensions FreshFit checks.',
    }
  }

  if (hasConfirmedGaps) {
    return {
      key: 'close_the_gap_first',
      headline: 'Worth a look, but close a gap first',
      detail: 'This role could work, but there are a few confirmed gaps worth addressing before you apply.',
    }
  }

  return {
    key: 'worth_a_look',
    headline: 'Worth a look',
    detail: 'This role is a fair fit, with no confirmed disqualifying gaps.',
  }
}
