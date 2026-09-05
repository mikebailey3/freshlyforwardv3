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
 * 2. Tier-based default (strong/good/weak).
 * 3. Fair tier splits on whether there are confirmed (not unknown) gaps
 *    worth closing first.
 */
export function computeRecommendation(
  tier: FreshFitTier,
  hardConstraints: FreshFitHardConstraint[],
  hasConfirmedGaps: boolean
): FreshFitRecommendation {
  const hasBlocker = hardConstraints.some((c) => c.status === 'hard_blocker')
  if (hasBlocker) {
    return {
      key: 'read_details_first',
      headline: 'Read the details before pursuing this one',
      detail: 'One or more requirements on this role conflict with what you\'ve told us -- worth a careful look before applying.',
    }
  }

  if (tier === 'strong') {
    return {
      key: 'strong_pursue',
      headline: 'Strong match -- worth pursuing',
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

  if (tier === 'fair') {
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

  return {
    key: 'likely_not_a_fit',
    headline: 'Likely not a strong fit',
    detail: 'This role scores low across most of the dimensions FreshFit checks.',
  }
}
