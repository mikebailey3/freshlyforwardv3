import { describe, it, expect } from 'vitest'
import { parseAshbyJobs } from './ashby'

const fixture = {
  jobs: [
    {
      id: 'xyz-1',
      title: 'Data Analyst',
      location: 'Remote',
      descriptionPlain: 'We are looking for a data analyst.',
      jobUrl: 'https://jobs.ashbyhq.com/acme/xyz-1',
      publishedAt: '2024-05-01T00:00:00.000Z',
      employmentType: 'FullTime',
    },
  ],
}

describe('parseAshbyJobs', () => {
  it('maps an Ashby job board response into ScrapedJobInput rows', () => {
    const result = parseAshbyJobs(fixture, 'acme')
    expect(result).toEqual([
      {
        source: 'ashby',
        external_id: 'xyz-1',
        title: 'Data Analyst',
        company: 'acme',
        location: 'Remote',
        description: 'We are looking for a data analyst.',
        salary_text: null,
        employment_type: 'FullTime',
        posting_url: 'https://jobs.ashbyhq.com/acme/xyz-1',
        posted_at: '2024-05-01',
        search_query: 'acme',
      },
    ])
  })

  it('returns an empty array when the board has no jobs', () => {
    expect(parseAshbyJobs({ jobs: [] }, 'acme')).toEqual([])
  })
})
