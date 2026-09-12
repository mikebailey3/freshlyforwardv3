import { describe, it, expect } from 'vitest'
import { jobsToAvoidHardConstraint } from './exclusions'
import type { MemberProfile, ScrapedJob } from '@/types'

function makeProfile(overrides: Partial<MemberProfile> = {}): MemberProfile {
  return { jobs_to_avoid: [], ...overrides } as MemberProfile
}
function makeJob(overrides: Partial<ScrapedJob> = {}): ScrapedJob {
  return { title: 'Data Analyst', company: 'Acme', ...overrides } as ScrapedJob
}

describe('jobsToAvoidHardConstraint', () => {
  it('is unknown when the member has not set any roles/companies to avoid', () => {
    const result = jobsToAvoidHardConstraint(makeProfile(), makeJob())
    expect(result.status).toBe('unknown')
  })

  it('is unknown (never a crash) when jobs_to_avoid is missing entirely from the profile object', () => {
    const result = jobsToAvoidHardConstraint({} as MemberProfile, makeJob())
    expect(result.status).toBe('unknown')
  })

  it('flags a hard_blocker when the job title matches an avoided phrase', () => {
    const result = jobsToAvoidHardConstraint(
      makeProfile({ jobs_to_avoid: ['call center'] }),
      makeJob({ title: 'Call Center Representative' })
    )
    expect(result.status).toBe('hard_blocker')
    expect(result.reason).toContain('call center')
  })

  it('flags a hard_blocker when the company name matches an avoided phrase', () => {
    const result = jobsToAvoidHardConstraint(
      makeProfile({ jobs_to_avoid: ['Globex'] }),
      makeJob({ company: 'Globex Corp' })
    )
    expect(result.status).toBe('hard_blocker')
  })

  it('matches case-insensitively', () => {
    const result = jobsToAvoidHardConstraint(
      makeProfile({ jobs_to_avoid: ['CALL CENTER'] }),
      makeJob({ title: 'Call Center Representative' })
    )
    expect(result.status).toBe('hard_blocker')
  })

  it('confirms met when the job matches none of the avoided phrases', () => {
    const result = jobsToAvoidHardConstraint(
      makeProfile({ jobs_to_avoid: ['call center', 'Globex'] }),
      makeJob({ title: 'Data Analyst', company: 'Acme' })
    )
    expect(result.status).toBe('confirmed_match')
  })

  it('does not match against the job description -- only title/company, to stay high-precision', () => {
    const result = jobsToAvoidHardConstraint(
      makeProfile({ jobs_to_avoid: ['call center'] }),
      makeJob({
        title: 'Customer Success Manager',
        company: 'Acme',
        description: 'Occasionally supports our call center team during peak season.',
      } as Partial<ScrapedJob>)
    )
    expect(result.status).toBe('confirmed_match')
  })
})
