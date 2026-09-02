// src/lib/forwardScore/pillars.test.ts
import { describe, it, expect } from 'vitest'
import pillarsSource from './pillars.ts?raw'
import {
  forwardDnaDepthPillar,
  evidenceQualityPillar,
  careerMomentumPillar,
  goalAlignmentPillar,
} from './pillars'
import { STATE_WEIGHT } from '@/lib/forwardDna/matching'
import type { CareerSkill } from '@/types/forwardDna'

function makeSkill(overrides: Partial<CareerSkill>): CareerSkill {
  return {
    id: 's1', user_id: 'u1', skill_name: 'sql', state: 'claimed',
    evidence_note: null, created_at: '', updated_at: '', ...overrides,
  }
}

describe('forwardDnaDepthPillar', () => {
  it('passes the input score straight through', () => {
    const result = forwardDnaDepthPillar(42)
    expect(result.score).toBe(42)
    expect(result.key).toBe('forwardDnaDepth')
    expect(result.label).toBe('Forward DNA Depth')
    expect(result.weight).toBe(0.25)
  })

  it('shows an improvement link when score < 100', () => {
    const result = forwardDnaDepthPillar(80)
    expect(result.improvementLink).toEqual({ label: expect.any(String), to: '/forward-dna' })
  })

  it('has no improvement link when score is already 100', () => {
    const result = forwardDnaDepthPillar(100)
    expect(result.improvementLink).toBeNull()
  })
})

describe('evidenceQualityPillar', () => {
  it('scores 0 when both career skills and flat skills are empty', () => {
    const result = evidenceQualityPillar([], [])
    expect(result.score).toBe(0)
    expect(result.key).toBe('evidenceQuality')
    expect(result.weight).toBe(0.3)
  })

  it('treats a flat-only skill as implicit claimed, not zero', () => {
    const result = evidenceQualityPillar([], ['sql'])
    expect(result.score).toBe(Math.round(STATE_WEIGHT.claimed * 100))
    expect(result.score).toBeGreaterThan(0)
  })

  it('is pure -- calling twice with the same input gives the same result', () => {
    const careerSkills = [makeSkill({ skill_name: 'sql', state: 'demonstrated' })]
    const flatSkills = ['sql', 'excel']
    const first = evidenceQualityPillar(careerSkills, flatSkills)
    const second = evidenceQualityPillar(careerSkills, flatSkills)
    expect(first).toEqual(second)
  })

  it('uses the real career_skills state, not the implicit-claimed fallback, when a skill is in both lists', () => {
    const careerSkills = [makeSkill({ skill_name: 'sql', state: 'supported' })]
    const flatSkills = ['sql']
    const result = evidenceQualityPillar(careerSkills, flatSkills)
    expect(result.score).toBe(Math.round(STATE_WEIGHT.supported * 100))
  })

  it('averages a mix of claimed/demonstrated/supported using the real matching.ts weights', () => {
    const careerSkills = [
      makeSkill({ skill_name: 'sql', state: 'claimed' }),
      makeSkill({ skill_name: 'excel', state: 'demonstrated' }),
      makeSkill({ skill_name: 'leadership', state: 'supported' }),
    ]
    const expected = Math.round(
      ((STATE_WEIGHT.claimed + STATE_WEIGHT.demonstrated + STATE_WEIGHT.supported) / 3) * 100
    )
    const result = evidenceQualityPillar(careerSkills, [])
    expect(result.score).toBe(expected)
  })

  it('scores 100 when every skill is supported', () => {
    const careerSkills = [
      makeSkill({ skill_name: 'sql', state: 'supported' }),
      makeSkill({ skill_name: 'excel', state: 'supported' }),
    ]
    const result = evidenceQualityPillar(careerSkills, [])
    expect(result.score).toBe(100)
    expect(result.improvementLink).toBeNull()
  })

  it('shows an improvement link when score < 100', () => {
    const result = evidenceQualityPillar([makeSkill({ skill_name: 'sql', state: 'claimed' })], [])
    expect(result.improvementLink).toEqual({ label: expect.any(String), to: '/forward-dna' })
  })

  it('dedupes duplicate flat-skill names (case-insensitive) instead of counting each occurrence separately', () => {
    const withDuplicate = evidenceQualityPillar([], ['sql', 'sql', 'SQL'])
    const withoutDuplicate = evidenceQualityPillar([], ['sql'])
    expect(withDuplicate.score).toBe(withoutDuplicate.score)
    expect(withDuplicate.explanation).toContain('1')
    expect(withDuplicate.explanation).not.toContain('3')
  })
})

describe('careerMomentumPillar', () => {
  const allFalse = {
    hasActiveApplication: false,
    submittedInLast30Days: false,
    hasRecentOrUpcomingInterview: false,
    hasRespondedToMessages: false,
  }

  it('scores 0 when all four flags are false', () => {
    const result = careerMomentumPillar(allFalse)
    expect(result.score).toBe(0)
    expect(result.key).toBe('careerMomentum')
    expect(result.weight).toBe(0.2)
    expect(result.improvementLink).toEqual({ label: expect.any(String), to: '/applications' })
  })

  it('awards exactly 30 for hasActiveApplication alone', () => {
    expect(careerMomentumPillar({ ...allFalse, hasActiveApplication: true }).score).toBe(30)
  })

  it('awards exactly 25 for submittedInLast30Days alone', () => {
    expect(careerMomentumPillar({ ...allFalse, submittedInLast30Days: true }).score).toBe(25)
  })

  it('awards exactly 25 for hasRecentOrUpcomingInterview alone', () => {
    expect(careerMomentumPillar({ ...allFalse, hasRecentOrUpcomingInterview: true }).score).toBe(25)
  })

  it('awards exactly 20 for hasRespondedToMessages alone', () => {
    expect(careerMomentumPillar({ ...allFalse, hasRespondedToMessages: true }).score).toBe(20)
  })

  it('scores 100 when all four flags are true', () => {
    const result = careerMomentumPillar({
      hasActiveApplication: true,
      submittedInLast30Days: true,
      hasRecentOrUpcomingInterview: true,
      hasRespondedToMessages: true,
    })
    expect(result.score).toBe(100)
    expect(result.improvementLink).toBeNull()
  })
})

describe('goalAlignmentPillar', () => {
  it('scores 0 with a Career Compass prompt when input is null', () => {
    const result = goalAlignmentPillar(null)
    expect(result.score).toBe(0)
    expect(result.key).toBe('goalAlignment')
    expect(result.weight).toBe(0.25)
    expect(result.explanation.toLowerCase()).toContain('career compass')
    expect(result.improvementLink).toEqual({ label: expect.any(String), to: '/career-compass' })
  })

  it('passes a numeric input straight through with no rescaling', () => {
    const result = goalAlignmentPillar(65)
    expect(result.score).toBe(65)
    expect(result.improvementLink).toEqual({ label: expect.any(String), to: '/career-compass' })
  })

  it('has no improvement link once score is 100', () => {
    const result = goalAlignmentPillar(100)
    expect(result.improvementLink).toBeNull()
  })

  it('never uses the word "readiness" or the phrase "Career Direction Readiness" -- label is always "Goal Alignment"', () => {
    for (const input of [null, 65]) {
      const result = goalAlignmentPillar(input)
      expect(result.label).toBe('Goal Alignment')
      expect(result.label.toLowerCase()).not.toContain('readiness')
      expect(result.explanation.toLowerCase()).not.toContain('readiness')
      expect(result.explanation).not.toContain('Career Direction Readiness')
    }
  })
})

describe('pillars.ts module regression tripwire', () => {
  const source = pillarsSource

  it('never imports calculateSearchReadiness', () => {
    expect(source).not.toContain('calculateSearchReadiness')
  })

  it('never contains the literal string search_readiness_score', () => {
    expect(source).not.toContain('search_readiness_score')
  })

  it('never imports from any path containing careerVault', () => {
    expect(source).not.toMatch(/from ['"][^'"]*careerVault[^'"]*['"]/)
  })

  it('never contains the literal strings career_wins or career_win_capabilities', () => {
    expect(source).not.toContain('career_wins')
    expect(source).not.toContain('career_win_capabilities')
  })
})
