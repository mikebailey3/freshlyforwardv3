// src/lib/forwardScore/pillars.ts
import { STATE_WEIGHT } from '@/lib/forwardDna/matching'
import type { CareerSkill } from '@/types/forwardDna'
import type { ForwardScorePillarResult } from '@/types/forwardScore'

function improvementLink(score: number, label: string, to: string): { label: string; to: string } | null {
  return score < 100 ? { label, to } : null
}

/**
 * Forward DNA Depth: how complete a member's Forward DNA profile is
 * (career scope, responsibilities, skill evidence, education, target
 * role/timeframe -- see calculateForwardDnaCompleteness). The score is
 * computed elsewhere and simply passed through here.
 */
export function forwardDnaDepthPillar(completenessScore: number): ForwardScorePillarResult {
  return {
    key: 'forwardDnaDepth',
    label: 'Forward DNA Depth',
    score: completenessScore,
    weight: 0.25,
    explanation: `Your Forward DNA profile is ${completenessScore}% complete across scope, responsibilities, skill evidence, education, and career goals.`,
    improvementLink: improvementLink(completenessScore, 'Complete your Forward DNA', '/forward-dna'),
  }
}

interface CombinedSkill {
  name: string
  weight: number
}

/**
 * Reconciles the authoritative career_skills rows with the flat
 * member_profiles.skills list into one combined view: every career_skills
 * row wins with its real state, and any flat skill not already tracked in
 * career_skills is treated as implicit 'claimed'. Pure -- never mutates
 * either input, never writes anywhere.
 */
function reconcileSkills(careerSkills: CareerSkill[], flatSkills: string[]): CombinedSkill[] {
  const byName = new Map(careerSkills.map((s) => [s.skill_name.toLowerCase(), s]))
  const combined: CombinedSkill[] = careerSkills.map((s) => ({
    name: s.skill_name,
    weight: STATE_WEIGHT[s.state],
  }))

  for (const flatName of flatSkills) {
    if (byName.has(flatName.toLowerCase())) continue
    combined.push({ name: flatName, weight: STATE_WEIGHT.claimed })
  }

  return combined
}

/**
 * Evidence Quality: the highest-weighted pillar (0.30) -- per the locked
 * spec, evidenced capability is ForwardOS's core differentiator. Averages
 * the evidence weight (claimed/demonstrated/supported, per matching.ts's
 * shared STATE_WEIGHT) across every skill the member has, whether tracked
 * in career_skills or only present in their flat profile skills list.
 */
export function evidenceQualityPillar(
  careerSkills: CareerSkill[],
  flatSkills: string[]
): ForwardScorePillarResult {
  const combined = reconcileSkills(careerSkills, flatSkills)

  const score =
    combined.length === 0
      ? 0
      : Math.round((combined.reduce((sum, s) => sum + s.weight, 0) / combined.length) * 100)

  const evidenced = combined.filter((s) => s.weight > STATE_WEIGHT.claimed).length
  const explanation =
    combined.length === 0
      ? 'No skills recorded yet -- add skills and back them up with evidence to raise this score.'
      : `${evidenced} of ${combined.length} skills are backed by demonstrated or supported evidence; the rest are only claimed.`

  return {
    key: 'evidenceQuality',
    label: 'Evidence Quality',
    score,
    weight: 0.3,
    explanation,
    improvementLink: improvementLink(score, 'Strengthen your skill evidence', '/forward-dna'),
  }
}

interface CareerMomentumInput {
  hasActiveApplication: boolean
  submittedInLast30Days: boolean
  hasRecentOrUpcomingInterview: boolean
  hasRespondedToMessages: boolean
}

const MOMENTUM_CHECKS: { key: keyof CareerMomentumInput; points: number; label: string }[] = [
  { key: 'hasActiveApplication', points: 30, label: 'an active application' },
  { key: 'submittedInLast30Days', points: 25, label: 'a submission in the last 30 days' },
  { key: 'hasRecentOrUpcomingInterview', points: 25, label: 'a recent or upcoming interview' },
  { key: 'hasRespondedToMessages', points: 20, label: 'responded to recent messages' },
]

/**
 * Career Momentum: a weighted checklist of recent job-search activity
 * signals, summing to 100 before the 0.20 pillar weight is applied.
 */
export function careerMomentumPillar(input: CareerMomentumInput): ForwardScorePillarResult {
  const passed = MOMENTUM_CHECKS.filter((check) => input[check.key])
  const failed = MOMENTUM_CHECKS.filter((check) => !input[check.key])
  const score = passed.reduce((sum, check) => sum + check.points, 0)

  const explanation =
    failed.length === 0
      ? 'You have all four momentum signals: an active application, a recent submission, a recent or upcoming interview, and a response to messages.'
      : `You have ${passed.length} of 4 momentum signals. Still missing: ${failed.map((c) => c.label).join(', ')}.`

  return {
    key: 'careerMomentum',
    label: 'Career Momentum',
    score,
    weight: 0.2,
    explanation,
    improvementLink: improvementLink(score, 'Keep your search active', '/applications'),
  }
}

/**
 * Goal Alignment: how clearly a member's target role and timeframe line
 * up with their stated career direction, sourced from Career Compass's
 * readiness_scores.careerDirection (0-100, passed through untouched -- no
 * rescaling). A null input means the member has no current Career Compass
 * result yet.
 *
 * Locked terminology: label is always exactly "Goal Alignment" and the
 * word "readiness" never appears in this pillar's label or explanation,
 * even though the underlying data field is named readiness_scores.
 */
export function goalAlignmentPillar(careerDirectionScore: number | null): ForwardScorePillarResult {
  if (careerDirectionScore === null) {
    return {
      key: 'goalAlignment',
      label: 'Goal Alignment',
      score: 0,
      weight: 0.25,
      explanation: 'Take the Career Compass assessment to establish your career direction.',
      improvementLink: { label: 'Take the Career Compass assessment', to: '/career-compass' },
    }
  }

  const score = careerDirectionScore
  return {
    key: 'goalAlignment',
    label: 'Goal Alignment',
    score,
    weight: 0.25,
    explanation: `Your target role and timeframe align with your stated career direction at ${score}%.`,
    improvementLink: improvementLink(score, 'Revisit your career direction', '/career-compass'),
  }
}
