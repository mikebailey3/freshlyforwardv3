import { describe, it, expect } from 'vitest'
import {
  DEFAULT_FILTER_STATE,
  filterAndSortMatches,
  isRemoteLocation,
  isNewThisWeek,
  getMatchDate,
} from './opportunityEngineFilters'
import type { JobMatchWithJob } from '@/types'

function makeMatch(overrides: Omit<Partial<JobMatchWithJob>, 'scraped_job'> & { scraped_job?: Partial<JobMatchWithJob['scraped_job']> } = {}): JobMatchWithJob {
  const { scraped_job, ...matchOverrides } = overrides
  return {
    id: 'm1', member_id: 'user-1', scraped_job_id: 'job-1', fresh_fit_score: 60,
    matched_skills: [], missing_skills: [], score_breakdown: {}, dismissed_at: null,
    promoted_opportunity_id: null, computed_at: '2026-01-01T00:00:00Z',
    scraped_job: {
      id: 'job-1', source: 'greenhouse', external_id: 'e1', title: 'Engineer', company: 'Acme',
      location: null, description: '', salary_text: null, employment_type: null,
      posting_url: 'https://example.com', posted_at: null, search_query: null,
      is_active: true, scraped_at: '2026-01-01T00:00:00Z', created_at: '2026-01-01T00:00:00Z',
      ...scraped_job,
    },
    ...matchOverrides,
  }
}

describe('isRemoteLocation', () => {
  it('matches "remote" case-insensitively anywhere in the location text', () => {
    expect(isRemoteLocation('Remote')).toBe(true)
    expect(isRemoteLocation('Remote - US')).toBe(true)
    expect(isRemoteLocation('San Francisco (Remote friendly)')).toBe(true)
  })

  it('returns false for null, empty, or non-remote location text', () => {
    expect(isRemoteLocation(null)).toBe(false)
    expect(isRemoteLocation('')).toBe(false)
    expect(isRemoteLocation('San Francisco, CA')).toBe(false)
  })
})

describe('getMatchDate / isNewThisWeek', () => {
  it('prefers posted_at, falling back to scraped_at when posted_at is null', () => {
    const withPosted = makeMatch({ scraped_job: { posted_at: '2026-02-01T00:00:00Z', scraped_at: '2026-01-01T00:00:00Z' } })
    expect(getMatchDate(withPosted)).toBe('2026-02-01T00:00:00Z')

    const withoutPosted = makeMatch({ scraped_job: { posted_at: null, scraped_at: '2026-01-05T00:00:00Z' } })
    expect(getMatchDate(withoutPosted)).toBe('2026-01-05T00:00:00Z')
  })

  it('treats a match dated within the last 7 days as new this week', () => {
    const recent = new Date(Date.now() - 2 * 86400000).toISOString()
    const stale = new Date(Date.now() - 30 * 86400000).toISOString()
    expect(isNewThisWeek(makeMatch({ scraped_job: { posted_at: recent } }))).toBe(true)
    expect(isNewThisWeek(makeMatch({ scraped_job: { posted_at: stale } }))).toBe(false)
  })
})

describe('filterAndSortMatches', () => {
  const strong = makeMatch({ id: 'strong', fresh_fit_score: 90, scraped_job: { location: 'Remote', salary_text: '$150k', posted_at: new Date().toISOString(), employment_type: 'Full-time' } })
  const mid = makeMatch({ id: 'mid', fresh_fit_score: 60, scraped_job: { location: 'Austin, TX', salary_text: null, posted_at: null, employment_type: 'Contract' } })
  const low = makeMatch({ id: 'low', fresh_fit_score: 20, scraped_job: { location: null, salary_text: null, posted_at: null } })
  const all = [mid, strong, low] // deliberately unsorted input

  it('defaults to descending FreshFit score order with no filters applied', () => {
    const result = filterAndSortMatches(all, DEFAULT_FILTER_STATE)
    expect(result.map((m) => m.id)).toEqual(['strong', 'mid', 'low'])
  })

  it('sorts by newest first using getMatchDate, nulls last', () => {
    const result = filterAndSortMatches(all, { ...DEFAULT_FILTER_STATE, sortBy: 'newest' })
    expect(result[0].id).toBe('strong')
  })

  it('filters by minimum tier (e.g. "stronger" excludes "other")', () => {
    const result = filterAndSortMatches(all, { ...DEFAULT_FILTER_STATE, minTier: 'stronger' })
    expect(result.map((m) => m.id).sort()).toEqual(['mid', 'strong'])
  })

  it('filters by location text (case-insensitive contains)', () => {
    const result = filterAndSortMatches(all, { ...DEFAULT_FILTER_STATE, locationText: 'austin' })
    expect(result.map((m) => m.id)).toEqual(['mid'])
  })

  it('filters to remote-only matches', () => {
    const result = filterAndSortMatches(all, { ...DEFAULT_FILTER_STATE, remoteOnly: true })
    expect(result.map((m) => m.id)).toEqual(['strong'])
  })

  it('filters to matches with a listed salary', () => {
    const result = filterAndSortMatches(all, { ...DEFAULT_FILTER_STATE, salaryListedOnly: true })
    expect(result.map((m) => m.id)).toEqual(['strong'])
  })

  it('filters to new-this-week matches', () => {
    const result = filterAndSortMatches(all, { ...DEFAULT_FILTER_STATE, newThisWeekOnly: true })
    expect(result.map((m) => m.id)).toEqual(['strong'])
  })

  it('filters by employment type when set', () => {
    const result = filterAndSortMatches(all, { ...DEFAULT_FILTER_STATE, employmentType: 'Contract' })
    expect(result.map((m) => m.id)).toEqual(['mid'])
  })

  it('combines multiple filters (AND semantics)', () => {
    const result = filterAndSortMatches(all, { ...DEFAULT_FILTER_STATE, remoteOnly: true, salaryListedOnly: true, minTier: 'highest' })
    expect(result.map((m) => m.id)).toEqual(['strong'])
  })

  it('returns an empty array, not an error, when no matches satisfy the filters', () => {
    const result = filterAndSortMatches(all, { ...DEFAULT_FILTER_STATE, locationText: 'nowhere that exists' })
    expect(result).toEqual([])
  })

  it('never mutates the input array', () => {
    const copy = [...all]
    filterAndSortMatches(all, { ...DEFAULT_FILTER_STATE, sortBy: 'newest' })
    expect(all).toEqual(copy)
  })
})
