import type { FreshFitDimensionResult } from './types'

/**
 * Career Direction Alignment -- reuses Career Compass's
 * readiness_scores.careerDirection exactly the way
 * forwardScore/pillars.ts's goalAlignmentPillar already does: read
 * as-is, no rescaling, no duplicate computation (Q7/Q8 in the design
 * spec -- Career Compass and Forward DNA are sibling inputs, read
 * directly, not chained).
 */
export function scoreCareerDirectionDimension(careerDirectionScore: number | null): FreshFitDimensionResult {
  if (careerDirectionScore === null) {
    return {
      key: 'careerDirection',
      label: 'Career Direction Alignment',
      score: 50,
      weight: 0.15,
      status: 'no-data',
      explanation: "You haven't completed Career Compass yet, so FreshFit can't compare this role against your stated career direction.",
      evidence: [],
      gaps: [],
      unknowns: ['alignment with your stated career direction'],
      improvementLink: { label: 'Take the Career Compass assessment', to: '/career-compass' },
    }
  }

  const status = careerDirectionScore >= 60 ? 'strong' : careerDirectionScore >= 35 ? 'moderate' : 'weak'
  return {
    key: 'careerDirection',
    label: 'Career Direction Alignment',
    score: careerDirectionScore,
    weight: 0.15,
    status,
    explanation: `Your Career Compass career-direction clarity is at ${careerDirectionScore}/100.`,
    evidence: status !== 'weak' ? ['Career Compass career-direction result'] : [],
    gaps: status === 'weak' ? ['a clearer sense of career direction'] : [],
    unknowns: [],
    improvementLink: careerDirectionScore < 100 ? { label: 'Revisit your career direction', to: '/career-compass' } : null,
  }
}
