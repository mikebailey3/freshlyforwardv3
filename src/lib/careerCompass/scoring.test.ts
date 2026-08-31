// src/lib/careerCompass/scoring.test.ts
import { describe, it, expect } from 'vitest'
import { scoreAnswer, calculateDimensionScores } from './scoring'
import type { ArchetypeQuestion, ArchetypeAnswers } from '@/types/careerCompass'

const fixtureQuestions: ArchetypeQuestion[] = [
  { id: 'q1', text: 't1', dimension: 'peopleFocus', reverseScored: false, weight: 1 },
  { id: 'q2', text: 't2', dimension: 'peopleFocus', reverseScored: true, weight: 1 },
  { id: 'q3', text: 't3', dimension: 'workPace', reverseScored: false, weight: 1 },
]

describe('scoreAnswer', () => {
  it('returns the raw answer for a normal question', () => {
    expect(scoreAnswer(4, false)).toBe(4)
  })

  it('reverses the answer for a reverse-scored question (6 - answer)', () => {
    expect(scoreAnswer(5, true)).toBe(1)
    expect(scoreAnswer(1, true)).toBe(5)
    expect(scoreAnswer(3, true)).toBe(3)
  })
})

describe('calculateDimensionScores', () => {
  it('normalizes a single answered dimension to 0-100', () => {
    const answers: ArchetypeAnswers = { q1: 5, q2: 5, q3: 3 }
    const result = calculateDimensionScores(fixtureQuestions, answers)
    // q1 scored 5, q2 reverse-scored to 1 -> sum 6, count 2 -> (6/10)*100 = 60
    expect(result.peopleFocus).toBe(60)
    // q3 scored 3, count 1 -> (3/5)*100 = 60
    expect(result.workPace).toBe(60)
  })

  it('returns 0 for a dimension with no answered questions', () => {
    const answers: ArchetypeAnswers = { q1: 5 }
    const result = calculateDimensionScores(fixtureQuestions, answers)
    expect(result.structurePreference).toBe(0)
    expect(result.leadershipDrive).toBe(0)
  })

  it('excludes missing answers from the average rather than treating them as zero', () => {
    // only q1 answered in peopleFocus (q2 is missing) -> should be (5/5)*100 = 100, not diluted
    const answers: ArchetypeAnswers = { q1: 5 }
    const result = calculateDimensionScores(fixtureQuestions, answers)
    expect(result.peopleFocus).toBe(100)
  })

  it('is fully deterministic across repeated calls with identical input', () => {
    const answers: ArchetypeAnswers = { q1: 4, q2: 2, q3: 5 }
    const first = calculateDimensionScores(fixtureQuestions, answers)
    const second = calculateDimensionScores(fixtureQuestions, answers)
    expect(first).toEqual(second)
  })

  it('always returns all six dimension keys, even if unused by the fixture', () => {
    const result = calculateDimensionScores(fixtureQuestions, {})
    expect(Object.keys(result).sort()).toEqual(
      ['ambiguityTolerance', 'analyticalOrientation', 'leadershipDrive', 'peopleFocus', 'structurePreference', 'workPace']
    )
  })
})
