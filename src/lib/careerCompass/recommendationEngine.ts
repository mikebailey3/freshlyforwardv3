import type { ReadinessResult, RecommendedPlanSlug, PlanRecommendation, ReadinessBarrierKey } from '@/types/careerCompass'

type ConcretePlanSlug = Exclude<RecommendedPlanSlug, null>

const BARRIERS_ADDRESSED_BY_PLAN: Record<ConcretePlanSlug, ReadinessBarrierKey[]> = {
  'career-kickstart': ['resumePositioning'],
  'founding-member': ['careerDirection', 'searchStrategy', 'applicationConversion'],
  'career-growth': ['interviewPerformance', 'applicationConversion'],
  'career-concierge': ['careerDirection', 'resumePositioning', 'searchStrategy', 'applicationConversion', 'interviewPerformance'],
}

export function recommendPlan(readiness: ReadinessResult): PlanRecommendation {
  const { dimensionScores, supportNeed, urgency, isComplexTransition, overallScore, primaryBarrier, secondaryBarrier } = readiness
  const barriers = [primaryBarrier, secondaryBarrier]
  const resumeIsBarrier = barriers.includes('resumePositioning')
  const interviewIsBarrier = barriers.includes('interviewPerformance')

  let planSlug: RecommendedPlanSlug
  const reasons: string[] = []

  if (supportNeed <= 33 && overallScore >= 75 && !resumeIsBarrier) {
    planSlug = null
    reasons.push('Your readiness is strong across the board.', "You've told us you'd rather handle this yourself.")
  } else if (supportNeed <= 33 && resumeIsBarrier && dimensionScores.careerDirection >= 60) {
    planSlug = 'career-kickstart'
    reasons.push('You know where you want to go.', 'Your biggest opportunity is how your experience is presented.')
  } else if (supportNeed >= 80 && isComplexTransition) {
    planSlug = 'career-concierge'
    reasons.push("You're navigating a complex career transition.", 'You want fully managed, hands-on support.')
  } else if (interviewIsBarrier || (supportNeed >= 67 && !isComplexTransition) || urgency >= 100) {
    planSlug = 'career-growth'
    reasons.push(
      interviewIsBarrier
        ? 'Interview performance is your biggest opportunity right now.'
        : "You're ready for more active, hands-on help."
    )
  } else {
    planSlug = 'founding-member'
    reasons.push("You'd benefit from ongoing guidance and hand-selected opportunities.")
  }

  return { planSlug, serviceFitPct: calculateServiceFit(readiness, planSlug), reasons }
}

/**
 * Deterministic, explainable service-fit heuristic (same philosophy as
 * lib/freshFitScore.ts): a base score plus bonus points for each matched
 * criterion, capped below 100 so the product never claims a perfect fit.
 */
function calculateServiceFit(readiness: ReadinessResult, planSlug: RecommendedPlanSlug): number {
  if (planSlug === null) return 0

  let fit = 70

  const supportBandMatches =
    (planSlug === 'career-kickstart' && readiness.supportNeed <= 33) ||
    (planSlug === 'founding-member' && readiness.supportNeed > 33 && readiness.supportNeed <= 66) ||
    (planSlug === 'career-growth' && readiness.supportNeed > 33) ||
    (planSlug === 'career-concierge' && readiness.supportNeed >= 80)
  if (supportBandMatches) fit += 10

  if (BARRIERS_ADDRESSED_BY_PLAN[planSlug].includes(readiness.primaryBarrier)) fit += 10
  if (readiness.urgency >= 66) fit += 5
  if ((planSlug === 'career-concierge') === readiness.isComplexTransition) fit += 5

  return Math.min(97, fit)
}
