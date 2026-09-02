// src/lib/forwardScore/nextBestMove.ts
import type {
  ForwardScorePillarKey, ForwardScoreResult, NextBestMove, NextBestMoveKey,
} from '@/types/forwardScore'

/** Below this score (0-100), a pillar is considered "needs attention". */
const THRESHOLD = 40

/**
 * Fixed left-to-right rule-check / tie-break order. Mirrors
 * careerCompass/readinessEngine.ts's BARRIER_PRIORITY pattern -- a
 * hardcoded array establishing priority order, never reordered based on
 * data. This is also, deliberately, the exact order rules 1-4 below are
 * described in (Evidence Quality first, Career Momentum last).
 */
export const PILLAR_PRIORITY: ForwardScorePillarKey[] = [
  'evidenceQuality', 'forwardDnaDepth', 'goalAlignment', 'careerMomentum',
]

interface Rule {
  pillar: ForwardScorePillarKey
  key: NextBestMoveKey
  headline: string
  detail: string
  cta: { label: string; to: string }
}

const RULES: Rule[] = [
  {
    pillar: 'evidenceQuality',
    key: 'add_career_win',
    headline: 'Add a Career Win to back up your skills',
    detail: 'Your skills need more demonstrated or supported evidence behind them -- a Career Win turns a claimed skill into proof.',
    cta: { label: 'Add a Career Win', to: '/forward-dna' },
  },
  {
    pillar: 'forwardDnaDepth',
    key: 'complete_forward_dna',
    headline: 'Finish filling out your Forward DNA',
    detail: 'A section of your Forward DNA profile -- scope, responsibilities, education, or career goals -- is still incomplete.',
    cta: { label: 'Complete your Forward DNA', to: '/forward-dna' },
  },
  {
    pillar: 'goalAlignment',
    key: 'review_direction',
    headline: 'Revisit your career direction',
    detail: 'Your target role and timeframe could use another look against your stated career direction in Career Compass.',
    cta: { label: 'Review Career Compass', to: '/career-compass' },
  },
  {
    pillar: 'careerMomentum',
    key: 'review_activity',
    headline: 'Check in on your application activity',
    detail: 'Your recent job-search activity has slowed down -- take a look at your open applications.',
    cta: { label: 'Review your applications', to: '/applications' },
  },
]

/**
 * Neutral, non-alarming fallback recommendation used when no pillar is
 * below THRESHOLD, or when Career Momentum is the only low pillar but
 * the member has no active application to review (see
 * `getNextBestMove`'s docstring). Deliberately points at `/forward-dna`
 * rather than introducing a fourth destination -- the plan's default
 * expectation is that only the three existing routes (`/forward-dna`,
 * `/career-compass`, `/applications`) are ever used.
 */
const FALLBACK: NextBestMove = {
  key: 'stay_the_course',
  headline: 'Keep going -- your Forward Score looks solid',
  detail: 'Every pillar is in good shape right now. Keep your Forward DNA fresh and stay ready for new opportunities.',
  cta: { label: 'Explore your Forward DNA', to: '/forward-dna' },
}

function pillarByKey(result: ForwardScoreResult, key: ForwardScorePillarKey) {
  const pillar = result.pillars.find((p) => p.key === key)
  if (!pillar) throw new Error(`ForwardScoreResult is missing pillar "${key}"`)
  return pillar
}

/**
 * Determines the single lowest-scoring pillar. Ties are broken via
 * PILLAR_PRIORITY's fixed order (stable sort ascending by score, exactly
 * the same pattern readinessEngine.ts uses for BARRIER_PRIORITY) so a
 * tie always resolves the same way, regardless of the order
 * ForwardScoreResult.pillars happens to be in.
 */
function lowestPillarKey(result: ForwardScoreResult): ForwardScorePillarKey {
  const sorted = [...PILLAR_PRIORITY].sort(
    (a, b) => pillarByKey(result, a).score - pillarByKey(result, b).score
  )
  return sorted[0]
}

/**
 * Deterministic "Next Best Move" rule table. No AI/LLM, no free-text
 * generation -- every possible output is one of a small, fixed,
 * enumerable set of NextBestMove objects (the 4 RULES entries, plus the
 * single FALLBACK). Pure function -- no Supabase client, no I/O.
 *
 * Algorithm ("lowest AND below threshold", made unambiguous):
 * 1. Find the single lowest-scoring pillar, tie-broken by the fixed
 *    PILLAR_PRIORITY order above.
 * 2. If that pillar's score is >= THRESHOLD, every pillar is healthy --
 *    return the neutral FALLBACK.
 * 3. Otherwise fire that pillar's rule -- UNLESS it's Career Momentum
 *    and `context.hasActiveApplication` is false: a member with no
 *    active application has nothing to "review the activity of", so low
 *    momentum isn't actionable and falls through to FALLBACK instead.
 */
export function getNextBestMove(
  result: ForwardScoreResult,
  context: { hasActiveApplication: boolean }
): NextBestMove {
  const lowestKey = lowestPillarKey(result)
  const lowestPillar = pillarByKey(result, lowestKey)

  if (lowestPillar.score >= THRESHOLD) return FALLBACK
  if (lowestKey === 'careerMomentum' && !context.hasActiveApplication) return FALLBACK

  const rule = RULES.find((r) => r.pillar === lowestKey)
  /* c8 ignore next -- unreachable: lowestKey is always one of the 4 ForwardScorePillarKey literals, all covered by RULES above. */
  if (!rule) return FALLBACK

  return { key: rule.key, headline: rule.headline, detail: rule.detail, cta: rule.cta }
}
