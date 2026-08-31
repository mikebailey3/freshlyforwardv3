// src/lib/careerCompass/archetypeEngine.test.ts
import { describe, it, expect } from 'vitest'
import { calculateArchetypeScores, determinePrimarySecondary, runArchetypeAssessment } from './archetypeEngine'
import { archetypeQuestions } from '@/data/careerCompassQuestions'
import type { DimensionScores, ArchetypeScores, ArchetypeAnswers } from '@/types/careerCompass'

describe('calculateArchetypeScores', () => {
  const dims: DimensionScores = {
    peopleFocus: 50,
    leadershipDrive: 80,
    structurePreference: 40,
    ambiguityTolerance: 60,
    analyticalOrientation: 70,
    workPace: 90,
  }

  it('computes Driver as the weighted sum of leadership, pace, people, and ambiguity', () => {
    const scores = calculateArchetypeScores(dims)
    // 80*.35 + 90*.25 + 50*.15 + 60*.25 = 28 + 22.5 + 7.5 + 15 = 73
    expect(scores.driver).toBe(73)
  })

  it('computes Connector as the weighted sum favoring people focus', () => {
    const scores = calculateArchetypeScores(dims)
    // 50*.45 + 80*.20 + 60*.15 + 90*.20 = 22.5 + 16 + 9 + 18 = 65.5 -> rounds to 66
    expect(scores.connector).toBe(66)
  })

  it('returns all six archetype keys', () => {
    const scores = calculateArchetypeScores(dims)
    expect(Object.keys(scores).sort()).toEqual(
      ['builder', 'connector', 'creator', 'driver', 'explorer', 'strategist']
    )
  })
})

describe('determinePrimarySecondary', () => {
  it('picks the two highest-scoring archetypes', () => {
    const scores: ArchetypeScores = { driver: 90, connector: 40, strategist: 30, builder: 20, explorer: 10, creator: 5 }
    const { primary, secondary } = determinePrimarySecondary(scores)
    expect(primary).toBe('driver')
    expect(secondary).toBe('connector')
  })

  it('breaks ties using the fixed priority order [driver, connector, strategist, builder, explorer, creator]', () => {
    const scores: ArchetypeScores = { driver: 70, connector: 70, strategist: 50, builder: 40, explorer: 30, creator: 20 }
    const { primary, secondary } = determinePrimarySecondary(scores)
    expect(primary).toBe('driver')
    expect(secondary).toBe('connector')
  })
})

describe('runArchetypeAssessment', () => {
  it('produces identical dimension scores across repeated calls with identical answers (reproducibility)', () => {
    const answers: ArchetypeAnswers = Object.fromEntries(
      archetypeQuestions.map((q) => [q.id, 3 as const])
    )
    const first = runArchetypeAssessment(archetypeQuestions, answers)
    const second = runArchetypeAssessment(archetypeQuestions, answers)
    expect(first).toEqual(second)
  })

  it('gives every dimension a score of 60 when every answer is neutral (3)', () => {
    // A neutral (3) answer scores 3 whether normal or reverse-scored
    // (6 - 3 = 3), so every dimension should land at (3/5)*100 = 60
    // regardless of the normal/reverse mix.
    const answers: ArchetypeAnswers = Object.fromEntries(
      archetypeQuestions.map((q) => [q.id, 3 as const])
    )
    const result = runArchetypeAssessment(archetypeQuestions, answers)
    for (const score of Object.values(result.dimensionScores)) {
      expect(score).toBe(60)
    }
  })

  it('always assigns a primary and secondary archetype', () => {
    const answers: ArchetypeAnswers = Object.fromEntries(
      archetypeQuestions.map((q) => [q.id, 5 as const])
    )
    const result = runArchetypeAssessment(archetypeQuestions, answers)
    expect(result.primaryArchetype).toBeDefined()
    expect(result.secondaryArchetype).toBeDefined()
    expect(result.primaryArchetype).not.toBe(result.secondaryArchetype)
  })
})
