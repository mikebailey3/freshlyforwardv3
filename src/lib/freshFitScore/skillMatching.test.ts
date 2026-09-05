import { describe, it, expect } from 'vitest'
import { scoreSkillsDimension, SKILL_KEYWORDS, findSkillsInText } from './skillMatching'
import type { CareerSkill, CareerScope } from '@/types/forwardDna'

function skill(name: string, state: CareerSkill['state']): CareerSkill {
  return { id: name, user_id: 'u1', skill_name: name, state, evidence_note: null, created_at: '', updated_at: '' }
}

describe('SKILL_KEYWORDS / findSkillsInText (preserved for linkedinOptimizer.ts)', () => {
  it('still exports a non-empty dictionary and finds known skills in text', () => {
    expect(SKILL_KEYWORDS.length).toBeGreaterThan(20)
    expect(findSkillsInText('Looking for strong SQL and excel skills')).toEqual(
      expect.arrayContaining(['sql', 'excel'])
    )
  })
})

describe('scoreSkillsDimension - exact skill match', () => {
  it('classifies a directly-listed flat skill as confirmed_match', () => {
    const result = scoreSkillsDimension(['sql', 'excel'], [], [], 'Looking for SQL skills')
    expect(result.evidence).toContain('sql')
    expect(result.gaps).not.toContain('sql')
    expect(result.score).toBeGreaterThan(50)
  })

  it('gives full credit when career_skills has supported/demonstrated evidence for the same skill', () => {
    const flatOnly = scoreSkillsDimension(['sql'], [], [], 'Looking for SQL skills')
    const withEvidence = scoreSkillsDimension(['sql'], [skill('sql', 'supported')], [], 'Looking for SQL skills')
    expect(withEvidence.evidence).toContain('sql')
    expect(withEvidence.score).toBeGreaterThanOrEqual(flatOnly.score)
  })
})

describe('scoreSkillsDimension - fuzzy/alias skill match', () => {
  it('matches "js" against a JD asking for "javascript"', () => {
    const result = scoreSkillsDimension(['js'], [], [], 'Looking for a Javascript developer')
    expect(result.evidence).toContain('javascript')
    expect(result.gaps).not.toContain('javascript')
  })
})

describe('scoreSkillsDimension - transferable skills', () => {
  it('treats a related-but-not-identical skill as evidence, not a confirmed exact match', () => {
    const result = scoreSkillsDimension(['data analysis'], [], [], 'Looking for someone with SQL experience')
    expect(result.evidence).toContain('sql')
    expect(result.gaps).not.toContain('sql')
  })
})

describe('scoreSkillsDimension - required skill missing (confirmed gap)', () => {
  it('marks a skill as a confirmed gap when the member has a well-documented profile without it', () => {
    const wellDocumentedSkills = ['excel', 'customer service', 'scheduling', 'bookkeeping', 'payroll']
    const result = scoreSkillsDimension(wellDocumentedSkills, [], [], 'Looking for strong Python skills')
    expect(result.gaps).toContain('python')
    expect(result.unknowns).not.toContain('python')
  })
})

describe('scoreSkillsDimension - unknown requirement (sparse profile)', () => {
  it('marks a skill as unknown, not a confirmed gap, when the member profile has almost no skill data', () => {
    const result = scoreSkillsDimension([], [], [], 'Looking for strong Python skills')
    expect(result.unknowns).toContain('python')
    expect(result.gaps).not.toContain('python')
  })
})

describe('scoreSkillsDimension - scope fit bonus', () => {
  it('adds bonus credit when career_scope covers a JD-implied team size', () => {
    const withoutScope = scoreSkillsDimension(['sql'], [], [], 'Lead a team of 8 with strong SQL.')
    const scope: CareerScope[] = [
      { id: 'sc1', user_id: 'u1', employment_entry_id: 'e1', revenue_managed_cents: null, team_size: 10, budget_managed_cents: null, direct_reports: null, notes: null, created_at: '', updated_at: '' },
    ]
    const withScope = scoreSkillsDimension(['sql'], [], scope, 'Lead a team of 8 with strong SQL.')
    expect(withScope.score).toBeGreaterThanOrEqual(withoutScope.score)
  })
})

describe('scoreSkillsDimension - no JD skills detected', () => {
  it('returns a neutral no-data-flavored result rather than penalizing', () => {
    const result = scoreSkillsDimension(['sql'], [], [], 'General role, no specific requirements listed.')
    expect(result.score).toBeGreaterThanOrEqual(40)
    expect(result.score).toBeLessThanOrEqual(60)
  })
})

describe('scoreSkillsDimension - score never exceeds 100', () => {
  it('caps at 100 even with every possible bonus stacked', () => {
    const skills = ['sql', 'excel', 'python', 'javascript'].map((n) => skill(n, 'supported'))
    const scope: CareerScope[] = [
      { id: 'sc1', user_id: 'u1', employment_entry_id: 'e1', revenue_managed_cents: null, team_size: 999, budget_managed_cents: null, direct_reports: null, notes: null, created_at: '', updated_at: '' },
    ]
    const result = scoreSkillsDimension(
      ['sql', 'excel', 'python', 'javascript'],
      skills,
      scope,
      'Lead a team of 500 with strong SQL, excel, python and javascript.'
    )
    expect(result.score).toBeLessThanOrEqual(100)
  })
})
