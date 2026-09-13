// src/lib/forwardScore/nextBestMove.ts
import type {
  ForwardScorePillarKey, ForwardScoreResult, NextBestMove, NextBestMoveContext, NextBestMoveKey,
} from '@/types/forwardScore'

/**
 * Fixed left-to-right lifecycle rule-check order, evaluated BEFORE any
 * pillar logic (see `getNextBestMove`). Same fixed-array discipline as
 * `PILLAR_PRIORITY` -- array position IS precedence, never reordered by
 * data. The first entry whose predicate is true wins.
 *
 * Lifecycle signals outrank all four pillar rules for two reasons:
 * 1. Perishability -- pillar advice ("add a Career Win") is evergreen;
 *    lifecycle signals are time-boxed obligations with external
 *    deadlines. A dated obligation always outranks an improvement task
 *    that's equally true tomorrow.
 * 2. The momentum inversion -- all three lifecycle signals also feed the
 *    Career Momentum pillar score (see `pillars.ts`), so a member with an
 *    upcoming interview or a recent submission has a HIGHER momentum
 *    score, making momentum LESS likely to be the lowest pillar. Running
 *    pillars first would mean this system speaks least precisely exactly
 *    when the member is most active. Running lifecycle first is the only
 *    ordering that resolves that inversion.
 *
 * Order within the tier: interview (externally imposed, calendar-dated,
 * irreversible if missed) outranks submission follow-up (member-
 * controlled, measured in days not hours), which outranks an unread
 * message (important, but the only one of the three with redundant
 * persistent surfacing elsewhere -- the unread badge in MemberLayout,
 * the /messages nav item -- making it the least additive use of this
 * single recommendation slot).
 *
 * Deliberately bypasses THRESHOLD entirely -- a member with a
 * catastrophic pillar score AND an interview tomorrow sees interview
 * prep, not "complete your profile" (ratified product judgment: no
 * second "critical threshold" escape hatch -- that would be a tunable
 * knob, and knobs are how deterministic rule tables rot into scoring
 * engines).
 */
const LIFECYCLE_PRIORITY: {
  key: NextBestMoveKey
  predicate: (context: NextBestMoveContext) => boolean
  headline: string
  detail: string
  cta: { label: string; to: string }
}[] = [
  {
    key: 'prepare_for_interview',
    predicate: (context) => context.hasUpcomingInterview,
    headline: 'You have an interview coming up -- take a moment to prepare',
    detail: 'Your interview is coming up soon, so it is worth reviewing the role and your talking points now.',
    cta: { label: 'Review your interviews', to: '/interviews' },
  },
  {
    key: 'follow_up_on_application',
    predicate: (context) => context.submittedRecently,
    headline: 'You applied recently -- follow up while it is fresh',
    detail: 'A recent submission is easiest to check while it is still fresh. Review its status and next steps.',
    cta: { label: 'Review your applications', to: '/applications' },
  },
  {
    key: 'reply_to_strategist',
    predicate: (context) => context.hasUnreadInboundMessages,
    headline: 'You have a new message from your strategist',
    detail: 'You have an unread message from your strategist or the FreshlyForward team. A quick reply can keep things moving.',
    cta: { label: 'Open your messages', to: '/messages' },
  },
]

/**
 * Below this score (0-100), a pillar is considered "needs attention".
 * Only reached once no lifecycle signal in LIFECYCLE_PRIORITY has fired.
 */
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
 * Neutral, non-alarming fallback recommendation used when no lifecycle
 * signal fired and no pillar is below THRESHOLD, or when Career Momentum
 * is the only low pillar but the member has no active application to
 * review (see `getNextBestMove`'s docstring). Deliberately points at
 * `/forward-dna` rather than introducing a fourth pillar-tier
 * destination.
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
 * enumerable set of NextBestMove objects (the 3 LIFECYCLE_PRIORITY
 * entries, the 4 RULES entries, plus the single FALLBACK). Pure
 * function -- no Supabase client, no I/O, no Date/timestamp fields in
 * `context` (all time evaluation happens once in `useForwardScore.ts`).
 *
 * Two-tier algorithm:
 * 1. Walk LIFECYCLE_PRIORITY left to right. The first entry whose
 *    predicate is true wins -- return its move immediately. See that
 *    array's docstring for why lifecycle signals outrank pillar advice
 *    and why they're checked in that specific order.
 * 2. If no lifecycle entry fired, run the original pillar algorithm,
 *    unchanged ("lowest AND below threshold", made unambiguous):
 *    a. Find the single lowest-scoring pillar, tie-broken by the fixed
 *       PILLAR_PRIORITY order above.
 *    b. If that pillar's score is >= THRESHOLD, every pillar is
 *       healthy -- return the neutral FALLBACK.
 *    c. Otherwise fire that pillar's rule -- UNLESS it's Career Momentum
 *       and `context.hasActiveApplication` is false: a member with no
 *       active application has nothing to "review the activity of", so
 *       low momentum isn't actionable and falls through to FALLBACK
 *       instead.
 */
export function getNextBestMove(
  result: ForwardScoreResult,
  context: NextBestMoveContext
): NextBestMove {
  for (const entry of LIFECYCLE_PRIORITY) {
    if (entry.predicate(context)) {
      return { key: entry.key, headline: entry.headline, detail: entry.detail, cta: entry.cta }
    }
  }

  const lowestKey = lowestPillarKey(result)
  const lowestPillar = pillarByKey(result, lowestKey)

  if (lowestPillar.score >= THRESHOLD) return FALLBACK
  if (lowestKey === 'careerMomentum' && !context.hasActiveApplication) return FALLBACK

  const rule = RULES.find((r) => r.pillar === lowestKey)
  /* c8 ignore next -- unreachable: lowestKey is always one of the 4 ForwardScorePillarKey literals, all covered by RULES above. */
  if (!rule) return FALLBACK

  return { key: rule.key, headline: rule.headline, detail: rule.detail, cta: rule.cta }
}
