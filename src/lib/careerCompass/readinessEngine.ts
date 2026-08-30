import type {
  ReadinessQuestion, ReadinessAnswers, ReadinessResult, ReadinessBarrierKey,
} from '@/types/careerCompass'

/**
 * Fixed left-to-right tie-break order for both the readiness overall
 * score inputs and the barrier detector. Never reordered based on data.
 */
const BARRIER_PRIORITY: ReadinessBarrierKey[] = [
  'careerDirection', 'resumePositioning', 'searchStrategy',
  'applicationConversion', 'interviewPerformance',
]

function getOptionValue(questions: ReadinessQuestion[], answers: ReadinessAnswers, questionId: string): number | null {
  const question = questions.find((q) => q.id === questionId)
  const optionIndex = answers[questionId]
  if (!question || optionIndex === undefined) return null
  const option = question.options[optionIndex]
  return option ? option.value : null
}

function averageDefined(values: (number | null)[]): number {
  const defined = values.filter((v): v is number => v !== null)
  if (defined.length === 0) return 0
  return Math.round(defined.reduce((sum, v) => sum + v, 0) / defined.length)
}

export function calculateReadiness(
  questions: ReadinessQuestion[],
  answers: ReadinessAnswers
): ReadinessResult {
  const careerDirection = getOptionValue(questions, answers, 'rf_career_direction') ?? 0
  const resumeQuality = getOptionValue(questions, answers, 'rf_resume_quality')
  const resumeRecency = getOptionValue(questions, answers, 'rf_resume_recency')
  const resumePositioning = averageDefined([resumeQuality, resumeRecency])
  const searchStrategy = getOptionValue(questions, answers, 'rf_search_strategy') ?? 0
  const applicationResults = getOptionValue(questions, answers, 'rf_application_results') ?? 0
  const interviewConfidence = getOptionValue(questions, answers, 'rf_interview_confidence') ?? 0
  const supportNeed = getOptionValue(questions, answers, 'rf_support_need') ?? 0
  const urgency = getOptionValue(questions, answers, 'rf_urgency') ?? 0

  const transitionQuestion = questions.find((q) => q.id === 'rf_transition_type')
  const transitionOptionIndex = answers['rf_transition_type']
  const transitionType = transitionQuestion && transitionOptionIndex !== undefined
    ? transitionQuestion.options[transitionOptionIndex]?.transitionValue ?? null
    : null
  const isComplexTransition = transitionType !== null && transitionType !== 'advancement'

  const overallScore = Math.round(
    careerDirection * 0.25 +
    resumePositioning * 0.25 +
    searchStrategy * 0.20 +
    applicationResults * 0.15 +
    interviewConfidence * 0.15
  )

  const barrierScores: Record<ReadinessBarrierKey, number> = {
    careerDirection,
    resumePositioning,
    searchStrategy,
    applicationConversion: applicationResults,
    interviewPerformance: interviewConfidence,
  }

  // Stable sort ascending by score: ties preserve BARRIER_PRIORITY's
  // original order, which is exactly the desired deterministic tie-break.
  const sortedBarriers = [...BARRIER_PRIORITY].sort(
    (a, b) => barrierScores[a] - barrierScores[b]
  )

  return {
    dimensionScores: { careerDirection, resumePositioning, searchStrategy, applicationResults, interviewConfidence },
    supportNeed,
    urgency,
    transitionType,
    isComplexTransition,
    overallScore,
    primaryBarrier: sortedBarriers[0],
    secondaryBarrier: sortedBarriers[1],
  }
}
