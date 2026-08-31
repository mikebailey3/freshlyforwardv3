import { describe, it, expect } from 'vitest'
import { recommendPlan } from './recommendationEngine'
import { calculateReadiness } from './readinessEngine'
import { forwardReadinessQuestions } from '@/data/forwardReadinessQuestions'
import type { ReadinessResult } from '@/types/careerCompass'

function optionIndex(questionId: string, label: string): number {
  const q = forwardReadinessQuestions.find((q) => q.id === questionId)!
  const idx = q.options.findIndex((o) => o.label === label)
  if (idx === -1) throw new Error(`Option not found: ${questionId} / ${label}`)
  return idx
}

function makeReadiness(overrides: Partial<ReadinessResult>): ReadinessResult {
  return {
    dimensionScores: {
      careerDirection: 50, resumePositioning: 50, searchStrategy: 50,
      applicationResults: 50, interviewConfidence: 50,
    },
    supportNeed: 50,
    urgency: 33,
    transitionType: null,
    isComplexTransition: false,
    overallScore: 50,
    primaryBarrier: 'careerDirection',
    secondaryBarrier: 'resumePositioning',
    ...overrides,
  }
}

describe('recommendPlan', () => {
  it('Scenario 1: clear direction + poor resume + low support need -> Career Kickstart', () => {
    const readiness = makeReadiness({
      dimensionScores: {
        careerDirection: 90, resumePositioning: 20, searchStrategy: 70,
        applicationResults: 70, interviewConfidence: 70,
      },
      supportNeed: 0,
      overallScore: 64,
      primaryBarrier: 'resumePositioning',
      secondaryBarrier: 'searchStrategy',
    })
    const result = recommendPlan(readiness)
    expect(result.planSlug).toBe('career-kickstart')
    expect(result.reasons.length).toBeGreaterThan(0)
  })

  it('Scenario 2: unclear direction + moderate search needs + wants guidance -> Founding Member', () => {
    const readiness = makeReadiness({
      dimensionScores: {
        careerDirection: 30, resumePositioning: 60, searchStrategy: 40,
        applicationResults: 50, interviewConfidence: 60,
      },
      supportNeed: 50,
      overallScore: 44,
      primaryBarrier: 'careerDirection',
      secondaryBarrier: 'searchStrategy',
    })
    const result = recommendPlan(readiness)
    expect(result.planSlug).toBe('founding-member')
  })

  it('Scenario 3: high support need + complex transition + wants managed assistance -> Career Concierge', () => {
    const readiness = makeReadiness({
      supportNeed: 100,
      isComplexTransition: true,
      transitionType: 'career_change',
      urgency: 66,
      overallScore: 40,
      primaryBarrier: 'careerDirection',
      secondaryBarrier: 'resumePositioning',
    })
    const result = recommendPlan(readiness)
    expect(result.planSlug).toBe('career-concierge')
  })

  it('Scenario 4: strong readiness + low support requirement -> no forced purchase', () => {
    const readiness = makeReadiness({
      dimensionScores: {
        careerDirection: 85, resumePositioning: 95, searchStrategy: 85,
        applicationResults: 90, interviewConfidence: 88,
      },
      supportNeed: 0,
      overallScore: 88,
      primaryBarrier: 'careerDirection',
      secondaryBarrier: 'searchStrategy',
    })
    const result = recommendPlan(readiness)
    expect(result.planSlug).toBeNull()
  })

  it('recommends Career Growth when interview performance is the primary barrier', () => {
    const readiness = makeReadiness({
      supportNeed: 40,
      overallScore: 55,
      primaryBarrier: 'interviewPerformance',
      secondaryBarrier: 'searchStrategy',
    })
    const result = recommendPlan(readiness)
    expect(result.planSlug).toBe('career-growth')
  })

  it('routes mid-support complex transitions (supportNeed 34-79) to Career Growth, not Founding Member', () => {
    const readiness = makeReadiness({
      supportNeed: 70,
      isComplexTransition: true,
      transitionType: 'industry_change',
    })
    const result = recommendPlan(readiness)
    expect(result.planSlug).toBe('career-growth')
  })

  it('never returns a service fit above 97 or below 0', () => {
    const strong = recommendPlan(makeReadiness({ supportNeed: 100, isComplexTransition: true, transitionType: 'career_change' }))
    expect(strong.serviceFitPct).toBeLessThanOrEqual(97)
    expect(strong.serviceFitPct).toBeGreaterThanOrEqual(0)

    const free = recommendPlan(makeReadiness({
      dimensionScores: { careerDirection: 85, resumePositioning: 95, searchStrategy: 85, applicationResults: 90, interviewConfidence: 88 },
      supportNeed: 0, overallScore: 88, primaryBarrier: 'careerDirection', secondaryBarrier: 'searchStrategy',
    }))
    expect(free.serviceFitPct).toBe(0) // no plan recommended -> fit is not applicable
  })

  it('is fully deterministic across repeated calls with identical input', () => {
    const readiness = makeReadiness({ supportNeed: 50 })
    expect(recommendPlan(readiness)).toEqual(recommendPlan(readiness))
  })

  it('integration: industry_change + high support need never routes to Career Concierge (regression for allowlist bug)', () => {
    const answers = {
      rf_transition_type: optionIndex('rf_transition_type', 'Changing industries'),
      rf_support_need: optionIndex('rf_support_need', "I'd like someone actively managing my search for me."),
    }
    const readiness = calculateReadiness(forwardReadinessQuestions, answers)
    expect(readiness.isComplexTransition).toBe(false)
    const result = recommendPlan(readiness)
    expect(result.planSlug).not.toBe('career-concierge')
  })
})
