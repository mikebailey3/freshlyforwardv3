import { describe, it, expect } from 'vitest'
import { parseSalaryRange, scoreCompensationDimension, compensationHardConstraint } from './compensation'
import type { MemberProfile, ScrapedJob } from '@/types'

function makeProfile(overrides: Partial<MemberProfile> = {}): MemberProfile {
  return { salary_min: 70000, salary_max: 90000, ...overrides } as MemberProfile
}
function makeJob(overrides: Partial<ScrapedJob> = {}): ScrapedJob {
  return { salary_text: '$80,000 - $95,000', ...overrides } as ScrapedJob
}

describe('parseSalaryRange', () => {
  it('parses a comma-formatted dollar range', () => {
    expect(parseSalaryRange('$80,000 - $95,000')).toEqual({ min: 80000, max: 95000 })
  })

  it('parses a "k" shorthand range', () => {
    expect(parseSalaryRange('$70k-$90k')).toEqual({ min: 70000, max: 90000 })
  })

  it('parses a single value as both min and max', () => {
    expect(parseSalaryRange('$85,000')).toEqual({ min: 85000, max: 85000 })
  })

  it('annualizes an hourly rate', () => {
    expect(parseSalaryRange('$40/hr')).toEqual({ min: 83200, max: 83200 })
  })

  it('returns null for unparseable or missing text', () => {
    expect(parseSalaryRange(null)).toBeNull()
    expect(parseSalaryRange('Competitive salary')).toBeNull()
  })
})

describe('scoreCompensationDimension - compensation match', () => {
  it('scores strongly when the posted range clears the member\'s stated minimum', () => {
    const result = scoreCompensationDimension(makeProfile(), makeJob())
    expect(result.status).toBe('strong')
    expect(result.evidence.length).toBeGreaterThan(0)
  })
})

describe('scoreCompensationDimension - compensation mismatch', () => {
  it('scores weakly when the posted range tops out below the stated minimum', () => {
    const result = scoreCompensationDimension(makeProfile({ salary_min: 90000 }), makeJob({ salary_text: '$50,000 - $60,000' }))
    expect(result.status).toBe('weak')
    expect(result.gaps.length).toBeGreaterThan(0)
  })
})

describe('scoreCompensationDimension - salary missing', () => {
  it('is no-data, never penalized, when the job has no parseable salary text', () => {
    const result = scoreCompensationDimension(makeProfile(), makeJob({ salary_text: null }))
    expect(result.status).toBe('no-data')
    expect(result.score).toBe(50)
  })

  it('is no-data when the member has not stated a salary preference', () => {
    const result = scoreCompensationDimension(makeProfile({ salary_min: null, salary_max: null }), makeJob())
    expect(result.status).toBe('no-data')
  })
})

describe('compensationHardConstraint', () => {
  it('confirms met when the job clears the stated minimum', () => {
    const result = compensationHardConstraint(makeProfile(), makeJob())
    expect(result.status).toBe('confirmed_match')
  })

  it('flags a hard_blocker only when both sides have confident data and the job falls short', () => {
    const result = compensationHardConstraint(makeProfile({ salary_min: 90000 }), makeJob({ salary_text: '$50,000 - $60,000' }))
    expect(result.status).toBe('hard_blocker')
  })

  it('is unknown (never a false block) when salary data is missing on either side', () => {
    expect(compensationHardConstraint(makeProfile(), makeJob({ salary_text: null })).status).toBe('unknown')
    expect(compensationHardConstraint(makeProfile({ salary_min: null }), makeJob()).status).toBe('unknown')
  })
})
