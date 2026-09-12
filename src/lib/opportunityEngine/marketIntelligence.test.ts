import { describe, expect, it } from 'vitest'
import { computeMarketIntelligenceSnapshots } from './marketIntelligence'
import type { JobLike } from './jobNormalization'

function makeJob(overrides: Partial<JobLike> = {}): JobLike {
  return {
    source: 'test-source',
    title: 'Data Analyst',
    company: 'Acme Corp',
    location: 'Springfield, IL',
    description: 'Looking for strong SQL and Excel skills.',
    salary_text: '$60,000 - $70,000',
    employment_type: 'full_time',
    posting_url: 'https://example.com/job/1',
    posted_at: null,
    ...overrides,
  }
}

describe('computeMarketIntelligenceSnapshots (pure, no I/O)', () => {
  it('returns [] for an empty job list', () => {
    expect(computeMarketIntelligenceSnapshots([])).toEqual([])
  })

  it('produces exactly one bucket for a single job, with sample_size 1', () => {
    const result = computeMarketIntelligenceSnapshots([makeJob()])
    expect(result).toHaveLength(1)
    expect(result[0].sampleSize).toBe(1)
    expect(result[0].roleBucket).toBe('data analyst')
    expect(result[0].locationBucket).toBe('il')
  })

  it('merges multiple postings for the same role+location into one bucket', () => {
    const result = computeMarketIntelligenceSnapshots([
      makeJob({ posting_url: 'https://example.com/1' }),
      makeJob({ posting_url: 'https://example.com/2' }),
    ])
    expect(result).toHaveLength(1)
    expect(result[0].sampleSize).toBe(2)
  })

  it('keeps different roles or different locations in separate buckets', () => {
    const result = computeMarketIntelligenceSnapshots([
      makeJob({ title: 'Data Analyst', location: 'Springfield, IL' }),
      makeJob({ title: 'Data Analyst', location: 'Austin, TX' }),
      makeJob({ title: 'Software Engineer', location: 'Springfield, IL' }),
    ])
    expect(result).toHaveLength(3)
  })

  it('uses the parsed state as the location bucket, falling back to the full normalized location text when no state parses', () => {
    const result = computeMarketIntelligenceSnapshots([
      makeJob({ location: 'Remote' }),
      makeJob({ location: 'Chicago, IL' }),
    ])
    const buckets = result.map((r) => r.locationBucket).sort()
    expect(buckets).toEqual(['il', 'remote'])
  })

  it('excludes a job entirely (no fabricated bucket) when its title or location normalizes to empty', () => {
    const result = computeMarketIntelligenceSnapshots([
      makeJob({ title: '', location: 'Springfield, IL' }),
      makeJob({ title: 'Data Analyst', location: '' }),
    ])
    expect(result).toEqual([])
  })

  it('computes the median salary (odd count) and never fabricates one when no job in the bucket has a parseable salary', () => {
    const withSalaries = computeMarketIntelligenceSnapshots([
      makeJob({ salary_text: '$50,000', posting_url: 'a' }),
      makeJob({ salary_text: '$60,000', posting_url: 'b' }),
      makeJob({ salary_text: '$70,000', posting_url: 'c' }),
    ])
    expect(withSalaries[0].medianSalaryMin).toBe(60000)
    expect(withSalaries[0].medianSalaryMax).toBe(60000)

    const withoutSalaries = computeMarketIntelligenceSnapshots([
      makeJob({ salary_text: 'Competitive salary', posting_url: 'a' }),
    ])
    expect(withoutSalaries[0].medianSalaryMin).toBeNull()
    expect(withoutSalaries[0].medianSalaryMax).toBeNull()
  })

  it('computes the median salary (even count) by averaging the two middle values', () => {
    const result = computeMarketIntelligenceSnapshots([
      makeJob({ salary_text: '$50,000', posting_url: 'a' }),
      makeJob({ salary_text: '$70,000', posting_url: 'b' }),
    ])
    expect(result[0].medianSalaryMin).toBe(60000)
  })

  it('still counts a job with no parseable salary toward sample_size, without dragging the median toward it', () => {
    const result = computeMarketIntelligenceSnapshots([
      makeJob({ salary_text: '$60,000', posting_url: 'a' }),
      makeJob({ salary_text: 'DOE', posting_url: 'b' }),
    ])
    expect(result[0].sampleSize).toBe(2)
    expect(result[0].medianSalaryMin).toBe(60000)
  })

  it('ranks top_skills by frequency across the bucket\'s postings, ties broken alphabetically', () => {
    const result = computeMarketIntelligenceSnapshots([
      makeJob({ description: 'Needs SQL and Excel.', posting_url: 'a' }),
      makeJob({ description: 'Needs SQL and Python.', posting_url: 'b' }),
    ])
    expect(result[0].topSkills[0]).toBe('sql') // appears in both postings
  })

  it('caps top_skills at a small fixed number rather than an unbounded list', () => {
    const manySkillsDescription =
      'communication leadership management sales marketing accounting bookkeeping budgeting forecasting analytics excel'
    const result = computeMarketIntelligenceSnapshots([makeJob({ description: manySkillsDescription })])
    expect(result[0].topSkills.length).toBeLessThanOrEqual(10)
  })

  it('sorts output by sample_size descending, then role/location alphabetically', () => {
    const result = computeMarketIntelligenceSnapshots([
      makeJob({ title: 'Data Analyst', location: 'Springfield, IL', posting_url: 'a' }),
      makeJob({ title: 'Software Engineer', location: 'Austin, TX', posting_url: 'b' }),
      makeJob({ title: 'Software Engineer', location: 'Austin, TX', posting_url: 'c' }),
    ])
    expect(result[0].roleBucket).toBe('software engineer')
    expect(result[0].sampleSize).toBe(2)
    expect(result[1].roleBucket).toBe('data analyst')
  })

  it('never produces an output field beyond the documented aggregate shape -- no member-linkable data can leak in', () => {
    const result = computeMarketIntelligenceSnapshots([makeJob()])
    expect(Object.keys(result[0]).sort()).toEqual(
      ['locationBucket', 'medianSalaryMax', 'medianSalaryMin', 'roleBucket', 'sampleSize', 'topSkills'].sort()
    )
  })
})
