/**
 * Opportunity Engine 2.0 Phase 4 -- personalized ranking for the
 * member-facing "Top Opportunities" feed.
 *
 * Deliberately NOT a second scoring engine: every factor here reads
 * fields FreshFit (`src/lib/freshFitScore/`) already computed --
 * `fresh_fit_score`, the `careerDirection` dimension, `hardConstraints`
 * (via the canonical `hasHardBlocker` from `../opportunityEngine.ts`),
 * and `confidence` -- plus one genuinely new, ranking-only signal
 * (posting freshness, which FreshFit's job-fit score has no reason to
 * know about). Locked FreshFit tiers/bands are untouched: `rankScore`
 * is a sort key only, never displayed as a second 0-100 score or tier.
 *
 * "Unknown != Missing" applies here exactly as it does in FreshFit
 * itself: every factor treats missing data as a neutral (0) sort-order
 * nudge, never a penalty.
 */
import { hasHardBlocker } from '../opportunityEngine'
import type { FreshFitConfidence } from '@/lib/freshFitScore'
import type { JobMatchScoreBreakdown, JobMatchWithJob } from '@/types'

export type OpportunityRankFactorKey =
  | 'freshFitScore'
  | 'careerGoalAlignment'
  | 'freshness'
  | 'qualificationRisk'
  | 'evidenceStrength'

export interface OpportunityRankFactor {
  key: OpportunityRankFactorKey
  label: string
  /** Signed points folded into `rankScore` -- a sort-order input only, never a percentage or a second FreshFit score. */
  contribution: number
  explanation: string
}

export interface OpportunityRankResult {
  rankScore: number
  factors: OpportunityRankFactor[]
  /** True on any confirmed v2 hard_blocker (compensation floor, remote mismatch,
   * jobs_to_avoid, or a confidently-missing must-have) -- reuses the exact same
   * check Phase 3's strategist grid already uses, so "needs review" means one
   * thing everywhere in the Opportunity Engine, not two slightly different things. */
  needsReview: boolean
}

export interface RankedJobMatch {
  match: JobMatchWithJob
  rank: OpportunityRankResult
}

function breakdownOf(match: JobMatchWithJob): JobMatchScoreBreakdown | null | undefined {
  return match.score_breakdown as JobMatchScoreBreakdown | null | undefined
}

// ---- Career goal alignment ----------------------------------------------
// Reads FreshFit's own `careerDirection` dimension (Career Compass result,
// already weighted into fresh_fit_score) -- never recomputed independently.
// Centered at 50 so an average-alignment role is sort-neutral; only a
// clearly above/below-average alignment nudges order, by design a much
// smaller swing (+/-10) than the qualification-risk or base score factors.
function careerGoalAlignmentFactor(breakdown: JobMatchScoreBreakdown | null | undefined): OpportunityRankFactor {
  const dimension = breakdown?.v2?.dimensions.find((d) => d.key === 'careerDirection')
  if (!dimension || dimension.status === 'no-data') {
    return {
      key: 'careerGoalAlignment',
      label: 'Career Goal Alignment',
      contribution: 0,
      explanation: 'No Career Compass result on file yet -- treated as neutral, not penalized.',
    }
  }
  const contribution = Math.round((dimension.score - 50) / 5)
  const direction = contribution > 0 ? 'supports' : contribution < 0 ? 'may pull you away from' : 'is neutral toward'
  return {
    key: 'careerGoalAlignment',
    label: 'Career Goal Alignment',
    contribution,
    explanation: `This role ${direction} your stated career direction (Career Compass ${dimension.score}/100).`,
  }
}

// ---- Posting freshness / urgency -----------------------------------------
// The one genuinely ranking-only signal -- FreshFit's job-fit score has no
// reason to know how old a posting is. Missing dates (common for
// member-submitted jobs) are neutral, never penalized.
const FRESHNESS_TIERS: { maxDays: number; contribution: number; label: string }[] = [
  { maxDays: 3, contribution: 8, label: 'posted in the last 3 days' },
  { maxDays: 7, contribution: 5, label: 'posted this week' },
  { maxDays: 14, contribution: 2, label: 'posted in the last 2 weeks' },
  { maxDays: 30, contribution: 0, label: 'posted in the last month' },
]
const STALE_POSTING_PENALTY = -3

function daysSince(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null
  const then = new Date(dateStr).getTime()
  if (Number.isNaN(then)) return null
  return Math.max(0, Math.floor((Date.now() - then) / (1000 * 60 * 60 * 24)))
}

function freshnessFactor(match: JobMatchWithJob): OpportunityRankFactor {
  const job = match.scraped_job
  const days = daysSince(job.posted_at) ?? daysSince(job.scraped_at)
  if (days === null) {
    return {
      key: 'freshness',
      label: 'Posting Freshness',
      contribution: 0,
      explanation: 'Posting date unknown -- treated as neutral, not penalized.',
    }
  }
  const tier = FRESHNESS_TIERS.find((t) => days <= t.maxDays)
  if (tier) {
    return { key: 'freshness', label: 'Posting Freshness', contribution: tier.contribution, explanation: `This posting was ${tier.label} (${days} day(s) ago).` }
  }
  return {
    key: 'freshness',
    label: 'Posting Freshness',
    contribution: STALE_POSTING_PENALTY,
    explanation: `This posting is over a month old (${days} days ago) -- worth double-checking it's still open.`,
  }
}

// ---- Qualification risk / hard blockers ----------------------------------
// A confirmed hard blocker must *materially* suppress ranking, not read as
// an ordinary few-point deduction -- big enough that it reliably outweighs
// every other factor combined, so a blocked match never outranks a clean
// one on this alone, while still remaining visible (never silently hidden;
// `needsReview` surfaces it in the UI exactly like Phase 3's strategist grid).
const HARD_BLOCKER_PENALTY = -50
const ALL_CONSTRAINTS_CONFIRMED_BONUS = 4

function qualificationRiskFactor(breakdown: JobMatchScoreBreakdown | null | undefined, blocked: boolean): OpportunityRankFactor {
  const constraints = breakdown?.v2?.hardConstraints ?? []
  if (constraints.length === 0) {
    return { key: 'qualificationRisk', label: 'Qualification Risk', contribution: 0, explanation: 'No hard-constraint data available -- treated as neutral.' }
  }
  if (blocked) {
    const blockers = constraints.filter((c) => c.status === 'hard_blocker').map((c) => c.label)
    return {
      key: 'qualificationRisk',
      label: 'Qualification Risk',
      contribution: HARD_BLOCKER_PENALTY,
      explanation: `Flagged for review: ${blockers.join(', ')}.`,
    }
  }
  const allConfirmed = constraints.every((c) => c.status === 'confirmed_match')
  if (allConfirmed) {
    return {
      key: 'qualificationRisk',
      label: 'Qualification Risk',
      contribution: ALL_CONSTRAINTS_CONFIRMED_BONUS,
      explanation: 'Every hard requirement checked out with confirmed evidence.',
    }
  }
  return {
    key: 'qualificationRisk',
    label: 'Qualification Risk',
    contribution: 0,
    explanation: "Some requirements are still unclear given your current profile -- treated as neutral, not penalized.",
  }
}

// ---- Evidence strength -----------------------------------------------------
// Reads FreshFit's own `confidence` (high/medium/low) -- how much real
// evidence backs the composite score, not a second evidence computation.
const CONFIDENCE_CONTRIBUTIONS: Record<FreshFitConfidence, number> = { high: 5, medium: 0, low: -4 }
const CONFIDENCE_EXPLANATIONS: Record<FreshFitConfidence, string> = {
  high: 'This score is backed by strong, well-rounded evidence.',
  medium: 'This score is backed by moderate evidence.',
  low: 'This score is based on limited evidence (missing Career Compass, salary, or similar data).',
}

function evidenceStrengthFactor(breakdown: JobMatchScoreBreakdown | null | undefined): OpportunityRankFactor {
  const confidence = breakdown?.v2?.confidence
  if (!confidence) {
    return { key: 'evidenceStrength', label: 'Evidence Strength', contribution: 0, explanation: 'No v2 evidence-confidence data available -- treated as neutral.' }
  }
  return { key: 'evidenceStrength', label: 'Evidence Strength', contribution: CONFIDENCE_CONTRIBUTIONS[confidence], explanation: CONFIDENCE_EXPLANATIONS[confidence] }
}

/**
 * Pure, deterministic, fully explainable per-match rank. Every factor is
 * independently auditable via `.factors` -- this is what "why did A rank
 * above B" answers with, the ranking equivalent of FreshFit's own
 * dimension breakdown.
 */
export function computeOpportunityRank(match: JobMatchWithJob): OpportunityRankResult {
  const breakdown = breakdownOf(match)
  const needsReview = hasHardBlocker(breakdown)

  const factors: OpportunityRankFactor[] = [
    { key: 'freshFitScore', label: 'FreshFit Score', contribution: match.fresh_fit_score, explanation: `FreshFit score of ${match.fresh_fit_score}/100.` },
    careerGoalAlignmentFactor(breakdown),
    freshnessFactor(match),
    qualificationRiskFactor(breakdown, needsReview),
    evidenceStrengthFactor(breakdown),
  ]

  const rankScore = factors.reduce((sum, f) => sum + f.contribution, 0)
  return { rankScore, factors, needsReview }
}

/**
 * Ranks a member's matches for the Top Opportunities feed. A stable sort
 * (JS `Array.prototype.sort` is stable) means ties keep their incoming
 * order -- today that's `fresh_fit_score` descending, since that's how
 * `getJobMatches` fetches them -- so ties never look arbitrarily shuffled.
 */
export function rankOpportunities(matches: JobMatchWithJob[]): RankedJobMatch[] {
  return matches.map((match) => ({ match, rank: computeOpportunityRank(match) })).sort((a, b) => b.rank.rankScore - a.rank.rankScore)
}

/**
 * Short, one-line "why this ranked here" hint for the feed UI -- picks the
 * single strongest positive non-base contributor, if any. Mirrors
 * `buildWhyItMatches` (opportunityEngine.ts)'s plain-text-builder pattern
 * rather than introducing a new heavyweight explanation component; the
 * full per-factor breakdown is still available via `.factors` for anything
 * that needs it later.
 */
export function buildRankHighlight(rank: OpportunityRankResult): string | null {
  const best = rank.factors
    .filter((f) => f.key !== 'freshFitScore' && f.contribution > 0)
    .sort((a, b) => b.contribution - a.contribution)[0]
  return best ? best.explanation : null
}
