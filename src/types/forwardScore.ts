/** Identifies one of the four pillars that make up the Forward Score composite. */
export type ForwardScorePillarKey =
  | 'forwardDnaDepth' | 'evidenceQuality' | 'careerMomentum' | 'goalAlignment'

/** The computed score, weight, and explanation for a single Forward Score pillar. */
export interface ForwardScorePillarResult {
  key: ForwardScorePillarKey
  label: string                // e.g. "Evidence Quality"
  score: number                 // 0-100, this pillar only
  weight: number                 // 0-1, e.g. 0.30
  explanation: string            // plain-language "why this number"
  improvementLink: { label: string; to: string } | null
}

/** The full Forward Score result: the weighted composite total plus its per-pillar breakdown. */
export interface ForwardScoreResult {
  total: number                  // 0-100, weighted composite
  pillars: ForwardScorePillarResult[]
}

/**
 * Identifies which deterministic "next best move" rule matched for the
 * current user. `stay_the_course` is the neutral fallback used when no
 * lifecycle signal fired and no pillar is below the actionable threshold
 * (or Career Momentum is low but the member has no active application to
 * review) -- see `src/lib/forwardScore/nextBestMove.ts`. The three
 * lifecycle keys (`prepare_for_interview`, `follow_up_on_application`,
 * `reply_to_strategist`) take precedence over the four pillar-based keys
 * whenever their signal is present -- see `LIFECYCLE_PRIORITY` in that
 * same file.
 */
export type NextBestMoveKey =
  | 'add_career_win' | 'complete_forward_dna' | 'review_direction' | 'review_activity'
  | 'prepare_for_interview' | 'follow_up_on_application' | 'reply_to_strategist'
  | 'stay_the_course'

/** A single recommended action surfaced to the user based on their Forward Score inputs. */
export interface NextBestMove {
  key: NextBestMoveKey
  headline: string
  detail: string
  cta: { label: string; to: string }
}

/**
 * Everything `getNextBestMove` needs beyond the pillar scores themselves.
 * All four fields are required (never optional) -- N13a exists precisely
 * because three real, already-computed lifecycle signals were being
 * silently discarded before reaching this function; an optional field
 * would let a future call site reintroduce that same bug by omission.
 *
 * Each boolean is a narrower, CTA-shaped derivation of an already-fetched
 * row set in `useForwardScore.ts` -- deliberately NOT the same booleans
 * that feed the Career Momentum pillar score, which use different
 * (correct-for-scoring, wrong-for-a-CTA) windows/definitions:
 * - `hasUpcomingInterview` excludes mock interviews (a `completed` mock
 *   interview must never pin "prepare for your interview" forever).
 * - `submittedRecently` uses a 7-day window, not the pillar's 30-day one
 *   (30 days is true for nearly every active member, which would make
 *   this tier permanently swamp the pillar rules below it).
 * - `hasUnreadInboundMessages` excludes the member's own outbound
 *   messages (named in the affirmative, never an ambiguous inverse like
 *   "hasResponded").
 */
export interface NextBestMoveContext {
  hasActiveApplication: boolean
  hasUpcomingInterview: boolean
  submittedRecently: boolean
  hasUnreadInboundMessages: boolean
}
