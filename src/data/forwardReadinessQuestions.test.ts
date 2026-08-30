// src/data/forwardReadinessQuestions.test.ts
import { describe, it, expect } from 'vitest'
import { forwardReadinessQuestions } from './forwardReadinessQuestions'

describe('forwardReadinessQuestions', () => {
  it('has exactly 9 questions', () => {
    expect(forwardReadinessQuestions).toHaveLength(9)
  })

  it('has unique question ids', () => {
    const ids = forwardReadinessQuestions.map((q) => q.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('gives every question at least 4 options', () => {
    for (const q of forwardReadinessQuestions) {
      expect(q.options.length).toBeGreaterThanOrEqual(4)
    }
  })

  it('covers every scored readiness dimension at least once', () => {
    const dims = forwardReadinessQuestions.map((q) => q.dimension)
    for (const dim of ['careerDirection', 'searchStrategy', 'applicationResults', 'interviewConfidence', 'supportNeed', 'urgency']) {
      expect(dims).toContain(dim)
    }
  })

  it('covers resumePositioning with two questions (reliability check)', () => {
    const count = forwardReadinessQuestions.filter((q) => q.dimension === 'resumePositioning').length
    expect(count).toBe(2)
  })

  it('has a transitionType question whose options each carry a transitionValue', () => {
    const q = forwardReadinessQuestions.find((q) => q.dimension === 'transitionType')
    expect(q).toBeDefined()
    for (const opt of q!.options) {
      expect(opt.transitionValue).toBeDefined()
    }
  })
})
