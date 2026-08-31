import { describe, it, expect } from 'vitest'
import { parseGreenhouseJobs } from './greenhouse'

const fixture = {
  jobs: [
    {
      id: 4020394,
      title: 'Backend Engineer',
      updated_at: '2024-05-01T12:00:00-04:00',
      location: { name: 'Remote - US' },
      content: '<p>We are looking for a <strong>backend engineer</strong>.</p>',
      absolute_url: 'https://boards.greenhouse.io/acme/jobs/4020394',
    },
  ],
}

describe('parseGreenhouseJobs', () => {
  it('maps a Greenhouse job board response into ScrapedJobInput rows', () => {
    const result = parseGreenhouseJobs(fixture, 'acme')
    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({
      source: 'greenhouse',
      external_id: '4020394',
      title: 'Backend Engineer',
      company: 'acme',
      location: 'Remote - US',
      description: 'We are looking for a backend engineer.',
      salary_text: null,
      employment_type: null,
      posting_url: 'https://boards.greenhouse.io/acme/jobs/4020394',
      posted_at: '2024-05-01',
      search_query: 'acme',
    })
  })

  it('returns an empty array when the board has no jobs', () => {
    expect(parseGreenhouseJobs({ jobs: [] }, 'acme')).toEqual([])
  })
})
