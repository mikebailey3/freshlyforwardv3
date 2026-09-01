// src/lib/forwardScore/score.ts
import {
  forwardDnaDepthPillar,
  evidenceQualityPillar,
  careerMomentumPillar,
  goalAlignmentPillar,
} from './pillars'
import type { CareerSkill } from '@/types/forwardDna'
import type { ForwardScoreResult } from '@/types/forwardScore'

export interface ForwardScoreInputs {
  forwardDnaCompletenessScore: number
  careerSkills: CareerSkill[]
  flatSkills: string[]
  momentum: {
    hasActiveApplication: boolean
    submittedInLast30Days: boolean
    hasRecentOrUpcomingInterview: boolean
    hasRespondedToMessages: boolean
  }
  careerDirectionScore: number | null
}

/**
 * Computes the ForwardOS Home composite Forward Score: four pillars,
 * each already 0-100, combined with locked weights (0.25 / 0.30 / 0.20 /
 * 0.25 -- these sum to 1 and are not configurable). Pure -- no I/O, no
 * Supabase client, no AI/LLM calls, no persistence.
 *
 * `pillars` is always returned in this fixed order -- Forward DNA Depth,
 * Evidence Quality, Career Momentum, Goal Alignment -- because it drives
 * UI rendering order; treat that order as a contract.
 */
export function computeForwardScore(inputs: ForwardScoreInputs): ForwardScoreResult {
  const forwardDnaDepth = forwardDnaDepthPillar(inputs.forwardDnaCompletenessScore)
  const evidenceQuality = evidenceQualityPillar(inputs.careerSkills, inputs.flatSkills)
  const careerMomentum = careerMomentumPillar(inputs.momentum)
  const goalAlignment = goalAlignmentPillar(inputs.careerDirectionScore)

  const rawTotal =
    0.25 * forwardDnaDepth.score +
    0.3 * evidenceQuality.score +
    0.2 * careerMomentum.score +
    0.25 * goalAlignment.score

  // Defensive clamp -- every pillar already produces 0-100 so this should
  // never actually trigger, matches the style used in freshFitScore.ts.
  const total = Math.max(0, Math.min(100, Math.round(rawTotal)))

  return {
    total,
    pillars: [forwardDnaDepth, evidenceQuality, careerMomentum, goalAlignment],
  }
}
