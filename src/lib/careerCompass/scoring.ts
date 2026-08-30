// src/lib/careerCompass/scoring.ts
import type { ArchetypeQuestion, ArchetypeAnswers, ArchetypeAnswer, DimensionScores, DimensionKey } from '@/types/careerCompass'

const ALL_DIMENSIONS: DimensionKey[] = [
  'peopleFocus', 'leadershipDrive', 'structurePreference',
  'ambiguityTolerance', 'analyticalOrientation', 'workPace',
]

/**
 * Applies reverse-scoring where required. Normal answers pass through
 * unchanged; reverse-scored answers are flipped around the midpoint of a
 * 1-5 scale (6 - answer), e.g. a "Strongly Agree" (5) on a reverse-worded
 * item counts the same as a "Strongly Disagree" (1) on a normal one.
 */
export function scoreAnswer(answer: ArchetypeAnswer, reverseScored: boolean): number {
  return reverseScored ? 6 - answer : answer
}

/**
 * Aggregates answered questions into a 0-100 score per dimension.
 * Unanswered questions are excluded from both the sum and the count
 * (never treated as a zero answer), and a dimension with zero answered
 * questions returns 0 rather than NaN.
 */
export function calculateDimensionScores(
  questions: ArchetypeQuestion[],
  answers: ArchetypeAnswers
): DimensionScores {
  const totals: Partial<Record<DimensionKey, { sum: number; count: number }>> = {}

  for (const question of questions) {
    const answer = answers[question.id]
    if (answer === undefined) continue

    const scored = scoreAnswer(answer, question.reverseScored)
    const bucket = totals[question.dimension] ?? { sum: 0, count: 0 }
    bucket.sum += scored
    bucket.count += 1
    totals[question.dimension] = bucket
  }

  const result = {} as DimensionScores
  for (const dimension of ALL_DIMENSIONS) {
    const bucket = totals[dimension]
    result[dimension] = bucket && bucket.count > 0
      ? Math.round((bucket.sum / (bucket.count * 5)) * 100)
      : 0
  }
  return result
}
