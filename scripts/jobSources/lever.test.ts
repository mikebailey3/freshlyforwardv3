import { describe, it, expect } from 'vitest'
import { parseLeverJobs } from './lever'

const fixture = [
  {
    id: 'a1b2c3',
    text: 'Senior Product Manager',
    categories: { location: 'New York, NY', commitment: 'Full-time' },
    descriptionPlain: 'We are looking for a senior product manager.',
    hostedUrl: 'https://jobs.lever.co/acme/a1b2c3',
    createdAt: 1714521600000,
  },
]

describe('parseLeverJobs', () => {
  it('maps a Lever postings response into ScrapedJobInput rows', () => {
    const result = parseLeverJobs(fixture, 'acme')
    expect(result).toEqual([
      {
        source: 'lever',
        external_id: 'a1b2c3',
        title: 'Senior Product Manager',
        company: 'acme',
        location: 'New York, NY',
        description: 'We are looking for a senior product manager.',
        salary_text: null,
        employment_type: 'Full-time',
        posting_url: 'https://jobs.lever.co/acme/a1b2c3',
        posted_at: '2024-05-01',
        search_query: 'acme',
      },
    ])
  })

  it('returns an empty array for an empty postings list', () => {
    expect(parseLeverJobs([], 'acme')).toEqual([])
  })
})
