import { describe, it, expect } from 'vitest'
import { computeFreshFitScore } from './freshFitScore'
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

describe('computeFreshFitScore (baseline, no Forward DNA data)', () => {
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
})

describe('computeFreshFitScore (with Forward DNA data)', () => {
  it('adds bonus points for demonstrated/supported skill evidence', () => {
    const withoutDna = computeFreshFitScore(makeProfile(), makeJob())
    const skills: CareerSkill[] = [
      { id: 's1', user_id: 'u1', skill_name: 'sql', state: 'demonstrated', evidence_note: null, created_at: '', updated_at: '' },
    ]
    const withDna = computeFreshFitScore(makeProfile(), makeJob(), { skills, scope: [] })
    expect(withDna.score).toBeGreaterThan(withoutDna.score)
    expect(withDna.breakdown.dnaSkillEvidence).toBeGreaterThan(0)
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
