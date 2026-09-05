import { describe, it, expect } from 'vitest'
import { scoreRoleRelevanceDimension } from './roleRelevance'
import type { MemberProfile, ScrapedJob, EmploymentEntry } from '@/types'

function makeProfile(overrides: Partial<MemberProfile> = {}): MemberProfile {
  return { preferred_jobs: ['Data Analyst'], employment_history: [], ...overrides } as MemberProfile
}
function makeJob(overrides: Partial<ScrapedJob> = {}): ScrapedJob {
  return { title: 'Data Analyst', ...overrides } as ScrapedJob
}
function entry(overrides: Partial<EmploymentEntry> = {}): EmploymentEntry {
  return { company: 'Acme', title: 'Analyst', start_date: '2020-01-01', end_date: null, current: true, description: '', ...overrides }
}

describe('scoreRoleRelevanceDimension', () => {
  it('scores highly when the JD title matches a preferred job title', () => {
    const result = scoreRoleRelevanceDimension(makeProfile(), makeJob())
    expect(result.score).toBeGreaterThan(50)
  })

  it('returns a small neutral score when there is no title signal at all', () => {
    const result = scoreRoleRelevanceDimension(makeProfile({ preferred_jobs: [], employment_history: [] }), makeJob())
    expect(result.score).toBeGreaterThan(0)
    expect(result.status).toBe('no-data')
  })

  it('scores low for a clearly unrelated title', () => {
    const result = scoreRoleRelevanceDimension(
      makeProfile({ preferred_jobs: ['Registered Nurse'] }),
      makeJob({ title: 'Warehouse Forklift Operator' })
    )
    expect(result.score).toBeLessThan(30)
  })

  it('never exceeds 100', () => {
    const result = scoreRoleRelevanceDimension(makeProfile(), makeJob())
    expect(result.score).toBeLessThanOrEqual(100)
  })
})

describe('scoreRoleRelevanceDimension - seniority mismatch', () => {
  it('flags a confirmed gap and lowers the score when the JD implies a level well above the member\'s current one', () => {
    const withGap = scoreRoleRelevanceDimension(
      makeProfile({ preferred_jobs: [], employment_history: [entry({ title: 'Data Analyst', current: true })] }),
      makeJob({ title: 'Senior Director Data Analyst' })
    )
    const withoutGap = scoreRoleRelevanceDimension(
      makeProfile({ preferred_jobs: [], employment_history: [entry({ title: 'Senior Director Data Analyst', current: true })] }),
      makeJob({ title: 'Senior Director Data Analyst' })
    )
    expect(withGap.gaps.some((g) => g.toLowerCase().includes('senior'))).toBe(true)
    expect(withGap.score).toBeLessThan(withoutGap.score)
  })
})

describe('scoreRoleRelevanceDimension - overqualification', () => {
  it('notes overqualification in the explanation without penalizing the score', () => {
    const result = scoreRoleRelevanceDimension(
      makeProfile({ preferred_jobs: [], employment_history: [entry({ title: 'Director of Sales', current: true })] }),
      makeJob({ title: 'Junior Sales Associate' })
    )
    expect(result.explanation.toLowerCase()).toContain('junior')
    expect(result.gaps.some((g) => g.toLowerCase().includes('senior'))).toBe(false)
  })
})

describe('scoreRoleRelevanceDimension - career change', () => {
  it('gives full credit and a positive framing when preferred jobs match even though work history does not', () => {
    const result = scoreRoleRelevanceDimension(
      makeProfile({
        preferred_jobs: ['Data Analyst'],
        employment_history: [entry({ title: 'Registered Nurse', current: true })],
      }),
      makeJob({ title: 'Data Analyst' })
    )
    expect(result.score).toBeGreaterThan(50)
    expect(result.explanation.toLowerCase()).toContain('pursuing')
  })
})
