import { describe, it, expect } from 'vitest'
import { parseWorkdayJobs, parseWorkdaySlug } from './workday'

const fixture = {
  total: 1,
  jobPostings: [
    {
      title: 'Cashier',
      externalPath: '/job/Bentonville-AR/Cashier_R-1234567',
      locationsText: 'Bentonville, AR',
      bulletFields: ['R-1234567'],
    },
  ],
}

describe('parseWorkdaySlug', () => {
  it('splits a tenant:wdHost:site slug', () => {
    expect(parseWorkdaySlug('walmart:wd504:WalmartExternal')).toEqual({
      tenant: 'walmart',
      wdHost: 'wd504',
      site: 'WalmartExternal',
    })
  })

  it('throws on a malformed slug', () => {
    expect(() => parseWorkdaySlug('walmart')).toThrow()
    expect(() => parseWorkdaySlug('walmart:wd504')).toThrow()
  })
})

describe('parseWorkdayJobs', () => {
  it('maps a Workday job-search response into ScrapedJobInput rows', () => {
    const result = parseWorkdayJobs(fixture, 'walmart:wd504:WalmartExternal')
    expect(result).toEqual([
      {
        source: 'workday',
        external_id: 'R-1234567',
        title: 'Cashier',
        company: 'walmart',
        location: 'Bentonville, AR',
        description: '',
        salary_text: null,
        employment_type: null,
        posting_url: 'https://walmart.wd504.myworkdayjobs.com/WalmartExternal/job/Bentonville-AR/Cashier_R-1234567',
        posted_at: null,
        search_query: 'walmart:wd504:WalmartExternal',
      },
    ])
  })

  it('falls back to the externalPath suffix when bulletFields has no requisition id', () => {
    const result = parseWorkdayJobs(
      { jobPostings: [{ title: 'Stocker', externalPath: '/job/Store/Stocker_JR00099887', bulletFields: [] }] },
      'walmart:wd504:WalmartExternal'
    )
    expect(result[0].external_id).toBe('JR00099887')
  })

  it('returns an empty array when the board has no postings', () => {
    expect(parseWorkdayJobs({ jobPostings: [] }, 'walmart:wd504:WalmartExternal')).toEqual([])
  })
})
