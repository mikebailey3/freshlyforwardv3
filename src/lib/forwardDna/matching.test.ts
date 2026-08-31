import { describe, it, expect } from 'vitest'
import { scoreSkillEvidence, scoreScopeFit } from './matching'
import type { CareerSkill, CareerScope } from '@/types/forwardDna'

function makeSkill(overrides: Partial<CareerSkill>): CareerSkill {
  return {
    id: 's1', user_id: 'u1', skill_name: 'sql', state: 'claimed',
    evidence_note: null, created_at: '', updated_at: '', ...overrides,
  }
}

function makeScope(overrides: Partial<CareerScope>): CareerScope {
  return {
    id: 'sc1', user_id: 'u1', employment_entry_id: 'e1',
    revenue_managed_cents: null, team_size: null, budget_managed_cents: null,
    direct_reports: null, notes: null, created_at: '', updated_at: '', ...overrides,
  }
}

describe('scoreSkillEvidence', () => {
  it('returns 0 when there are no JD skills or no career skills', () => {
    expect(scoreSkillEvidence([], ['sql'])).toEqual({ points: 0, matched: [] })
    expect(scoreSkillEvidence([makeSkill({})], [])).toEqual({ points: 0, matched: [] })
  })

  it('awards more points for demonstrated/supported skills than claimed', () => {
    const claimed = scoreSkillEvidence([makeSkill({ skill_name: 'sql', state: 'claimed' })], ['sql'])
    const supported = scoreSkillEvidence([makeSkill({ skill_name: 'sql', state: 'supported' })], ['sql'])
    expect(supported.points).toBeGreaterThan(claimed.points)
    expect(claimed.matched).toEqual(['sql'])
  })

  it('never awards more than 15 points', () => {
    const skills = ['sql', 'excel', 'leadership'].map((name) => makeSkill({ skill_name: name, state: 'supported' }))
    const result = scoreSkillEvidence(skills, ['sql', 'excel', 'leadership'])
    expect(result.points).toBeLessThanOrEqual(15)
  })
})

describe('scoreScopeFit', () => {
  it('returns 0 when there is no scope data or no scope language in the JD', () => {
    expect(scoreScopeFit([], 'We need a team player.')).toBe(0)
    expect(scoreScopeFit([makeScope({ team_size: 10 })], 'We need a team player.')).toBe(0)
  })

  it('awards points when the member has led a team at least as large as the JD implies', () => {
    const result = scoreScopeFit([makeScope({ team_size: 10 })], 'You will lead a team of 8 engineers.')
    expect(result).toBeGreaterThan(0)
  })

  it('awards points when the member has managed at least as much budget as the JD implies', () => {
    const result = scoreScopeFit([makeScope({ budget_managed_cents: 5_000_000_00 })], 'Own a $2M budget.')
    expect(result).toBeGreaterThan(0)
  })

  it('awards 0 when the member has less scope than the JD implies', () => {
    const result = scoreScopeFit([makeScope({ team_size: 2 })], 'You will lead a team of 8 engineers.')
    expect(result).toBe(0)
  })
})
