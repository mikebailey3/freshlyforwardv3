// src/data/careerCompassQuestions.test.ts
import { describe, it, expect } from 'vitest'
import { archetypeQuestions } from './careerCompassQuestions'
import type { DimensionKey } from '@/types/careerCompass'

const DIMENSIONS: DimensionKey[] = [
  'peopleFocus', 'leadershipDrive', 'structurePreference',
  'ambiguityTolerance', 'analyticalOrientation', 'workPace',
]

describe('archetypeQuestions', () => {
  it('has exactly 24 questions', () => {
    expect(archetypeQuestions).toHaveLength(24)
  })

  it('has exactly 4 questions per dimension', () => {
    for (const dim of DIMENSIONS) {
      const count = archetypeQuestions.filter((q) => q.dimension === dim).length
      expect(count).toBe(4)
    }
  })

  it('has unique question ids', () => {
    const ids = archetypeQuestions.map((q) => q.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('has at least one reverse-scored item per dimension (bias reduction)', () => {
    for (const dim of DIMENSIONS) {
      const reverseCount = archetypeQuestions.filter(
        (q) => q.dimension === dim && q.reverseScored
      ).length
      expect(reverseCount).toBeGreaterThan(0)
    }
  })

  it('gives every question a positive weight', () => {
    for (const q of archetypeQuestions) {
      expect(q.weight).toBeGreaterThan(0)
    }
  })
})
