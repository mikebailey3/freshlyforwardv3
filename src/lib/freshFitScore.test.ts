import { describe, it, expect } from 'vitest'
import { computeFreshFitScore } from './freshFitScore'
import type { MemberProfile, ScrapedJob } from '@/types'

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
