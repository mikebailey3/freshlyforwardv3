import { describe, it, expect } from 'vitest'
import { computeFreshFitScore } from './score'
import type { MemberProfile, ScrapedJob } from '@/types'
import type { CareerSkill, CareerScope } from '@/types/forwardDna'

function makeProfile(overrides: Partial<MemberProfile> = {}): MemberProfile {
  return {
    skills: ['sql', 'excel', 'customer service'],
    preferred_jobs: ['Data Analyst'],
    employment_history: [
      { title: 'Data Analyst', company: 'Acme', start_date: '2020-01-01', end_date: null, current: true, description: '' },
    ],
    location: 'Dallas, TX',
    remote_preference: 'remote',
    willing_to_relocate: false,
    salary_min: null,
    salary_max: null,
    travel_willingness: null,
    max_commute_minutes: null,
    summary: 'Experienced data analyst with strong SQL skills.',
    headline: 'Data Analyst',
    career_goals: null,
    strengths: null,
    ...overrides,
  } as MemberProfile
}

function makeJob(overrides: Partial<ScrapedJob> = {}): ScrapedJob {
  return {
    id: 'job-1',
    source: 'greenhouse',
    external_id: '1',
    title: 'Data Analyst',
    company: 'Acme',
    location: 'Remote',
    description: 'Looking for a data analyst with strong SQL and excel skills.',
    salary_text: null,
    employment_type: null,
    posting_url: 'https://example.com/job/1',
    posted_at: null,
    search_query: null,
    is_active: true,
    scraped_at: '',
    created_at: '',
    ...overrides,
  } as ScrapedJob
}

describe('computeFreshFitScore - regression (behavior preserved from v1)', () => {
  it('scores a well-matched profile highly and lists matched skills', () => {
    const result = computeFreshFitScore(makeProfile(), makeJob())
    expect(result.score).toBeGreaterThan(50)
    expect(result.matchedSkills).toEqual(expect.arrayContaining(['sql']))
    expect(result.breakdown.dnaSkillEvidence ?? 0).toBe(0)
    expect(result.breakdown.scopeFit ?? 0).toBe(0)
  })

  it('never exceeds a total score of 100', () => {
    const result = computeFreshFitScore(makeProfile(), makeJob())
    expect(result.score).toBeLessThanOrEqual(100)
  })

  it('scores a completely unrelated job low', () => {
    const result = computeFreshFitScore(
      makeProfile({ skills: ['welding'] }),
      makeJob({ title: 'Nurse', description: 'Clinical patient care and phlebotomy required.' })
    )
    expect(result.score).toBeLessThan(30)
  })

  it('adds bonus points for demonstrated/supported skill evidence', () => {
    const withoutDna = computeFreshFitScore(makeProfile(), makeJob())
    const skills: CareerSkill[] = [
      { id: 's1', user_id: 'u1', skill_name: 'sql', state: 'demonstrated', evidence_note: null, created_at: '', updated_at: '' },
    ]
    const withDna = computeFreshFitScore(makeProfile(), makeJob(), { skills, scope: [] })
    expect(withDna.breakdown.dnaSkillEvidence).toBeGreaterThan(0)
    expect(withoutDna.breakdown.dnaSkillEvidence ?? 0).toBe(0)
  })

  it('adds bonus points when career_scope covers a JD-implied team size', () => {
    const job = makeJob({ description: 'You will lead a team of 8 engineers.' })
    const scope: CareerScope[] = [
      { id: 'sc1', user_id: 'u1', employment_entry_id: 'e1', revenue_managed_cents: null, team_size: 10, budget_managed_cents: null, direct_reports: null, notes: null, created_at: '', updated_at: '' },
    ]
    const result = computeFreshFitScore(makeProfile(), job, { skills: [], scope })
    expect(result.breakdown.scopeFit).toBeGreaterThan(0)
  })

  it('still caps the total score at 100 even with Forward DNA bonuses', () => {
    const skills: CareerSkill[] = ['sql', 'excel'].map((name) => ({
      id: name, user_id: 'u1', skill_name: name, state: 'supported', evidence_note: null, created_at: '', updated_at: '',
    }))
    const scope: CareerScope[] = [
      { id: 'sc1', user_id: 'u1', employment_entry_id: 'e1', revenue_managed_cents: null, team_size: 999, budget_managed_cents: null, direct_reports: null, notes: null, created_at: '', updated_at: '' },
    ]
    const result = computeFreshFitScore(
      makeProfile(),
      makeJob({ description: 'Lead a team of 500 with strong SQL and excel skills.' }),
      { skills, scope }
    )
    expect(result.score).toBeLessThanOrEqual(100)
  })
})

describe('computeFreshFitScore v2 - explainable dimensions', () => {
  it('returns exactly 5 dimensions in a fixed order', () => {
    const result = computeFreshFitScore(makeProfile(), makeJob())
    expect(result.dimensions.map((d) => d.key)).toEqual([
      'skillsEvidence', 'roleRelevance', 'careerDirection', 'compensation', 'locationAndLogistics',
    ])
  })

  it('assigns a tier consistent with the composite score', () => {
    const result = computeFreshFitScore(makeProfile(), makeJob())
    expect(['strong', 'good', 'fair', 'weak']).toContain(result.tier)
  })

  it('reuses the passed-in career direction score without recomputation', () => {
    const result = computeFreshFitScore(makeProfile(), makeJob(), { skills: [], scope: [] }, 90)
    const dim = result.dimensions.find((d) => d.key === 'careerDirection')
    expect(dim?.score).toBe(90)
    expect(dim?.status).toBe('strong')
  })

  it('is no-data for career direction when none was completed, and does not drag the score to zero', () => {
    const result = computeFreshFitScore(makeProfile(), makeJob(), { skills: [], scope: [] }, null)
    const dim = result.dimensions.find((d) => d.key === 'careerDirection')
    expect(dim?.status).toBe('no-data')
    expect(result.score).toBeGreaterThan(0)
  })

  it('lowers confidence when multiple dimensions are no-data (sparse profile)', () => {
    const sparseProfile = makeProfile({ location: null, remote_preference: null, willing_to_relocate: false })
    const result = computeFreshFitScore(sparseProfile, makeJob({ salary_text: null }), { skills: [], scope: [] }, null)
    expect(result.confidence).toBe('low')
  })

  it('surfaces a hard_blocker constraint and a read_details_first recommendation for a confirmed compensation conflict', () => {
    const result = computeFreshFitScore(
      makeProfile({ salary_min: 120000 }),
      makeJob({ salary_text: '$50,000 - $60,000' })
    )
    expect(result.hardConstraints.some((c) => c.status === 'hard_blocker')).toBe(true)
    expect(result.recommendation.key).toBe('read_details_first')
  })

  it('keeps unknowns separate from missingSkills (Unknown != Missing)', () => {
    const result = computeFreshFitScore(
      makeProfile({ skills: [] }),
      makeJob({ title: 'Python Developer', description: 'Looking for strong Python skills.' }),
      { skills: [], scope: [] },
      null
    )
    expect(result.unknowns.length).toBeGreaterThan(0)
    expect(result.missingSkills).not.toContain('python')
  })
})
