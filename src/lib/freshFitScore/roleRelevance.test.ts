import { describe, it, expect } from 'vitest'
import { scoreRoleRelevanceDimension } from './roleRelevance'
import type { MemberProfile, ScrapedJob } from '@/types'

function makeProfile(overrides: Partial<MemberProfile> = {}): MemberProfile {
  return { preferred_jobs: ['Data Analyst'], employment_history: [], ...overrides } as MemberProfile
}
function makeJob(overrides: Partial<ScrapedJob> = {}): ScrapedJob {
  return { title: 'Data Analyst', ...overrides } as ScrapedJob
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
