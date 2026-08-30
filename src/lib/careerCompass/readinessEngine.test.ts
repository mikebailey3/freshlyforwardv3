import { describe, it, expect } from 'vitest'
import { calculateReadiness } from './readinessEngine'
import { forwardReadinessQuestions } from '@/data/forwardReadinessQuestions'
import type { ReadinessAnswers } from '@/types/careerCompass'

function optionIndex(questionId: string, label: string): number {
  const q = forwardReadinessQuestions.find((q) => q.id === questionId)!
  const idx = q.options.findIndex((o) => o.label === label)
  if (idx === -1) throw new Error(`Option not found: ${questionId} / ${label}`)
  return idx
}

describe('calculateReadiness', () => {
  it('averages the two resume questions into a single resumePositioning score', () => {
    const answers: ReadinessAnswers = {
      rf_resume_quality: optionIndex('rf_resume_quality', 'It needs work'), // 25
      rf_resume_recency: optionIndex('rf_resume_recency', "It's a bit outdated but still usable."), // 50
    }
    const result = calculateReadiness(forwardReadinessQuestions, answers)
    expect(result.dimensionScores.resumePositioning).toBe(38) // round((25+50)/2)
  })

  it('treats a lone answered resume question as the whole resumePositioning score (does not halve it against an unanswered zero)', () => {
    const answers: ReadinessAnswers = {
      rf_resume_quality: optionIndex('rf_resume_quality', 'Pretty well'), // 75, rf_resume_recency left blank
    }
    const result = calculateReadiness(forwardReadinessQuestions, answers)
    expect(result.dimensionScores.resumePositioning).toBe(75)
  })

  it('excludes unanswered questions rather than treating them as zero (defaults dimension to 0 only when truly unanswered)', () => {
    const result = calculateReadiness(forwardReadinessQuestions, {})
    expect(result.dimensionScores.careerDirection).toBe(0)
    expect(result.dimensionScores.resumePositioning).toBe(0)
  })

  it('computes the overall score as the documented weighted average', () => {
    const answers: ReadinessAnswers = {
      rf_career_direction: optionIndex('rf_career_direction', 'I know exactly what role I want.'), // 100
      rf_resume_quality: optionIndex('rf_resume_quality', 'Very well'), // 100
      rf_resume_recency: optionIndex('rf_resume_recency', "Recently, and it's tailored to what I'm targeting."), // 100
      rf_search_strategy: optionIndex('rf_search_strategy', 'Very confident, I have a clear strategy'), // 100
      rf_application_results: optionIndex('rf_application_results', "I'm getting a good response."), // 100
      rf_interview_confidence: optionIndex('rf_interview_confidence', 'Very confident'), // 100
    }
    const result = calculateReadiness(forwardReadinessQuestions, answers)
    expect(result.overallScore).toBe(100)
  })

  it('applies the documented per-dimension weights, not just any weights summing to 1.0', () => {
    // Differentiated inputs per dimension so a coefficient swap in the
    // weighted-average formula would actually change the expected result:
    // careerDirection=100 (w=.25 -> 25), resumePositioning=avg(50,50)=50 (w=.25 -> 12.5),
    // searchStrategy=0 (w=.20 -> 0), applicationResults=100 (w=.15 -> 15),
    // interviewConfidence=0 via unanswered (w=.15 -> 0).
    // Sum = 25 + 12.5 + 0 + 15 + 0 = 52.5 -> Math.round -> 53.
    const answers: ReadinessAnswers = {
      rf_career_direction: optionIndex('rf_career_direction', 'I know exactly what role I want.'), // 100
      rf_resume_quality: optionIndex('rf_resume_quality', "I'm not sure"), // 50
      rf_resume_recency: optionIndex('rf_resume_recency', "It's a bit outdated but still usable."), // 50
      rf_search_strategy: optionIndex('rf_search_strategy', "I don't know where to start"), // 0
      rf_application_results: optionIndex('rf_application_results', "I'm getting a good response."), // 100
      // rf_interview_confidence intentionally omitted -> defaults to 0
    }
    const result = calculateReadiness(forwardReadinessQuestions, answers)
    expect(result.overallScore).toBe(53)
  })

  it('flags a complex transition for career_change but not for advancement', () => {
    const careerChange = calculateReadiness(forwardReadinessQuestions, {
      rf_transition_type: optionIndex('rf_transition_type', 'Changing careers entirely'),
    })
    expect(careerChange.transitionType).toBe('career_change')
    expect(careerChange.isComplexTransition).toBe(true)

    const advancement = calculateReadiness(forwardReadinessQuestions, {
      rf_transition_type: optionIndex('rf_transition_type', 'Seeking advancement in my current field'),
    })
    expect(advancement.transitionType).toBe('advancement')
    expect(advancement.isComplexTransition).toBe(false)
  })

  it('identifies the lowest-scoring dimension as the primary barrier', () => {
    const answers: ReadinessAnswers = {
      rf_career_direction: optionIndex('rf_career_direction', 'I know exactly what role I want.'), // 100
      rf_resume_quality: optionIndex('rf_resume_quality', 'I need significant help'), // 0
      rf_resume_recency: optionIndex('rf_resume_recency', "I don't have a resume I'm confident in yet."), // 0
      rf_search_strategy: optionIndex('rf_search_strategy', 'Very confident, I have a clear strategy'), // 100
      rf_application_results: optionIndex('rf_application_results', "I'm getting a good response."), // 100
      rf_interview_confidence: optionIndex('rf_interview_confidence', 'Very confident'), // 100
    }
    const result = calculateReadiness(forwardReadinessQuestions, answers)
    expect(result.primaryBarrier).toBe('resumePositioning')
  })

  it('breaks barrier ties using the fixed priority order', () => {
    // Leave every scored question unanswered -> every dimension is 0,
    // a full tie. Priority order is
    // [careerDirection, resumePositioning, searchStrategy, applicationConversion, interviewPerformance].
    const result = calculateReadiness(forwardReadinessQuestions, {})
    expect(result.primaryBarrier).toBe('careerDirection')
    expect(result.secondaryBarrier).toBe('resumePositioning')
  })

  it('is fully deterministic across repeated calls with identical input', () => {
    const answers: ReadinessAnswers = { rf_career_direction: 1, rf_support_need: 2 }
    const first = calculateReadiness(forwardReadinessQuestions, answers)
    const second = calculateReadiness(forwardReadinessQuestions, answers)
    expect(first).toEqual(second)
  })
})
