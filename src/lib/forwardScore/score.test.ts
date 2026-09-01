// src/lib/forwardScore/score.test.ts
import { describe, it, expect } from 'vitest'
import scoreSource from './score.ts?raw'
import { computeForwardScore, type ForwardScoreInputs } from './score'
import type { CareerSkill } from '@/types/forwardDna'

function makeSkill(overrides: Partial<CareerSkill>): CareerSkill {
  return {
    id: 's1', user_id: 'u1', skill_name: 'sql', state: 'claimed',
    evidence_note: null, created_at: '', updated_at: '', ...overrides,
  }
}

const ALL_FALSE_MOMENTUM = {
  hasActiveApplication: false,
  submittedInLast30Days: false,
  hasRecentOrUpcomingInterview: false,
  hasRespondedToMessages: false,
}

const ALL_TRUE_MOMENTUM = {
  hasActiveApplication: true,
  submittedInLast30Days: true,
  hasRecentOrUpcomingInterview: true,
  hasRespondedToMessages: true,
}

describe('computeForwardScore', () => {
  it('returns total 0 when every pillar is at its zero state', () => {
    const inputs: ForwardScoreInputs = {
      forwardDnaCompletenessScore: 0,
      careerSkills: [],
      flatSkills: [],
      momentum: ALL_FALSE_MOMENTUM,
      careerDirectionScore: null,
    }
    const result = computeForwardScore(inputs)
    expect(result.total).toBe(0)
  })

  it('returns total 100 when every pillar is at its max state', () => {
    const inputs: ForwardScoreInputs = {
      forwardDnaCompletenessScore: 100,
      careerSkills: [
        makeSkill({ skill_name: 'sql', state: 'supported' }),
        makeSkill({ skill_name: 'excel', state: 'supported' }),
      ],
      flatSkills: [],
      momentum: ALL_TRUE_MOMENTUM,
      careerDirectionScore: 100,
    }
    const result = computeForwardScore(inputs)
    expect(result.total).toBe(100)
  })

  it('computes a hand-verified mixed case exactly: 0.25*80 + 0.30*60 + 0.20*45 + 0.25*20 = 52', () => {
    // Forward DNA Depth: passthrough, so 80 -> pillar score 80.
    // Evidence Quality: three career_skills with weights 0.5, 0.5, 0.8
    //   (claimed, claimed, demonstrated) average to 1.8/3 = 0.6 -> round(60) = 60.
    // Career Momentum: hasRecentOrUpcomingInterview (25) + hasRespondedToMessages (20)
    //   = 45 (30/25/25/20 are the only achievable point values in pillars.ts;
    //   no subset of them sums to 40, so this test uses 45, the closest
    //   real achievable value, not the 40 used as an illustrative example
    //   in the task brief).
    // Goal Alignment: passthrough, so 20 -> pillar score 20.
    // total = 0.25*80 + 0.30*60 + 0.20*45 + 0.25*20 = 20 + 18 + 9 + 5 = 52
    const inputs: ForwardScoreInputs = {
      forwardDnaCompletenessScore: 80,
      careerSkills: [
        makeSkill({ skill_name: 'sql', state: 'claimed' }),
        makeSkill({ skill_name: 'excel', state: 'claimed' }),
        makeSkill({ skill_name: 'leadership', state: 'demonstrated' }),
      ],
      flatSkills: [],
      momentum: {
        hasActiveApplication: false,
        submittedInLast30Days: false,
        hasRecentOrUpcomingInterview: true,
        hasRespondedToMessages: true,
      },
      careerDirectionScore: 20,
    }
    const result = computeForwardScore(inputs)

    // Confirm the individual pillar scores match the hand-computed values
    // before trusting the composite total.
    const byKey = Object.fromEntries(result.pillars.map((p) => [p.key, p.score]))
    expect(byKey.forwardDnaDepth).toBe(80)
    expect(byKey.evidenceQuality).toBe(60)
    expect(byKey.careerMomentum).toBe(45)
    expect(byKey.goalAlignment).toBe(20)

    expect(result.total).toBe(52)
  })

  it('always returns exactly 4 pillars in the fixed order: forwardDnaDepth, evidenceQuality, careerMomentum, goalAlignment', () => {
    const inputs: ForwardScoreInputs = {
      forwardDnaCompletenessScore: 50,
      careerSkills: [],
      flatSkills: ['sql'],
      momentum: ALL_FALSE_MOMENTUM,
      careerDirectionScore: 50,
    }
    const result = computeForwardScore(inputs)
    expect(result.pillars).toHaveLength(4)
    expect(result.pillars.map((p) => p.key)).toEqual([
      'forwardDnaDepth',
      'evidenceQuality',
      'careerMomentum',
      'goalAlignment',
    ])
  })
})

describe('score.ts module regression tripwire', () => {
  const source = scoreSource

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
