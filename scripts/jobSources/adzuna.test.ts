import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  fetchAdzunaPage,
  parseAdzunaJobs,
  formatSalary,
  isPredictedSalary,
  normalizeAdzunaEmploymentType,
  type AdzunaResult,
} from './adzuna'
import { normalizeEmploymentType } from '../../src/lib/opportunityEngine/jobNormalization'

/**
 * Fixture shaped exactly like a real Adzuna `/search` result, including the
 * quirks that matter: underscored `contract_time`, a `salary_is_predicted`
 * flag, and a nested company/location.
 */
const baseResult: AdzunaResult = {
  id: '4815162342',
  title: 'Customer Service Representative',
  redirect_url: 'https://www.adzuna.com/land/ad/4815162342',
  description: 'Handle inbound customer enquiries and resolve issues.',
  created: '2026-09-01T08:30:00Z',
  company: { display_name: 'Acme Support Co' },
  location: { display_name: 'Dallas, TX' },
  salary_min: 42000,
  salary_max: 52000,
  contract_time: 'full_time',
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn())
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('parseAdzunaJobs', () => {
  it('maps an Adzuna response into canonical ScrapedJobInput rows', () => {
    const result = parseAdzunaJobs({ results: [baseResult], count: 1 }, 'customer service')

    expect(result).toEqual([
      {
        source: 'adzuna',
        external_id: '4815162342',
        title: 'Customer Service Representative',
        company: 'Acme Support Co',
        location: 'Dallas, TX',
        description: 'Handle inbound customer enquiries and resolve issues.',
        salary_text: '$42,000 - $52,000',
        employment_type: 'full time',
        posting_url: 'https://www.adzuna.com/land/ad/4815162342',
        posted_at: '2026-09-01',
        search_query: 'customer service',
      },
    ])
  })

  it('uses the requested country when formatting salary text', () => {
    const [row] = parseAdzunaJobs({ results: [baseResult], count: 1 }, 'customer service', 'gb')
    expect(row.salary_text).toBe('£42,000 - £52,000')
  })

  it('returns an empty array for an empty result set', () => {
    expect(parseAdzunaJobs({ results: [], count: 0 }, 'anything')).toEqual([])
  })

  it('tolerates a malformed payload without throwing', () => {
    expect(parseAdzunaJobs({}, 'q')).toEqual([])
    expect(parseAdzunaJobs(null, 'q')).toEqual([])
  })

  it('drops malformed rows and caps oversized text before persistence', () => {
    const oversized = {
      ...baseResult,
      id: '2',
      title: 'T'.repeat(500),
      description: 'D'.repeat(25_000),
    }
    const malformed = {
      ...baseResult,
      id: '',
      redirect_url: '',
    }

    const rows = parseAdzunaJobs({ results: [oversized, malformed], count: 2 }, 'q')
    expect(rows).toHaveLength(1)
    expect(rows[0].title).toHaveLength(300)
    expect(rows[0].description).toHaveLength(20_000)
  })

  it('falls back to empty/null rather than fabricating missing fields', () => {
    const sparse = {
      id: '1',
      title: 'Mystery Role',
      redirect_url: 'https://example.com/job/1',
      description: 'A short posting with missing optional fields.',
      created: '2026-09-02T00:00:00Z',
    } as AdzunaResult

    const [row] = parseAdzunaJobs({ results: [sparse], count: 1 }, 'q')
    expect(row.company).toBe('')
    expect(row.location).toBeNull()
    expect(row.salary_text).toBeNull()
    expect(row.employment_type).toBeNull()
    expect(row.posted_at).toBe('2026-09-02')
  })
})

describe('salary handling', () => {
  it('formats a min-max range', () => {
    expect(formatSalary(42000, 52000)).toBe('$42,000 - $52,000')
  })

  it('formats a single-sided salary', () => {
    expect(formatSalary(42000, undefined)).toBe('$42,000')
    expect(formatSalary(undefined, 52000)).toBe('$52,000')
  })

  it('collapses an identical min and max into one figure', () => {
    expect(formatSalary(50000, 50000)).toBe('$50,000')
  })

  it('uses a country-aware symbol instead of hardcoding dollars', () => {
    expect(formatSalary(42000, 52000, 'gb')).toBe('£42,000 - £52,000')
    expect(formatSalary(42000, undefined, 'au')).toBe('A$42,000')
  })

  it('returns null when no salary is present', () => {
    expect(formatSalary(undefined, undefined)).toBeNull()
  })

  it('detects an Adzuna-predicted (estimated) salary', () => {
    expect(isPredictedSalary({ ...baseResult, salary_is_predicted: '1' })).toBe(true)
    expect(isPredictedSalary({ ...baseResult, salary_is_predicted: 1 })).toBe(true)
    expect(isPredictedSalary({ ...baseResult, salary_is_predicted: true })).toBe(true)
    expect(isPredictedSalary({ ...baseResult, salary_is_predicted: '0' })).toBe(false)
    expect(isPredictedSalary(baseResult)).toBe(false)
  })

  it('drops a predicted salary rather than presenting an estimate as posted pay', () => {
    const predicted = { ...baseResult, salary_is_predicted: '1' }
    const [row] = parseAdzunaJobs({ results: [predicted], count: 1 }, 'q')
    expect(row.salary_text).toBeNull()
  })
})

/**
 * Regression: Adzuna sends `full_time`, but the shared normalizer matches
 * `full-time` / `full time` / `fte`. Before the adapter converted
 * underscores, every Adzuna row normalized to `unknown` and silently
 * degraded FreshFit's employment-type signal.
 */
describe('employment type (underscore regression)', () => {
  it('converts Adzuna underscores to the canonical spacing', () => {
    expect(normalizeAdzunaEmploymentType({ ...baseResult, contract_time: 'full_time' })).toBe('full time')
    expect(normalizeAdzunaEmploymentType({ ...baseResult, contract_time: 'part_time' })).toBe('part time')
  })

  it('prefers contract_time but falls back to contract_type', () => {
    const contractOnly = { ...baseResult, contract_time: undefined, contract_type: 'contract' }
    expect(normalizeAdzunaEmploymentType(contractOnly)).toBe('contract')
  })

  it('returns null when neither field is present', () => {
    expect(
      normalizeAdzunaEmploymentType({ ...baseResult, contract_time: undefined, contract_type: undefined }),
    ).toBeNull()
  })

  it('now survives the shared normalizer instead of collapsing to unknown', () => {
    // The actual bug: the raw Adzuna value loses its meaning...
    expect(normalizeEmploymentType('full_time')).toBe('unknown')
    expect(normalizeEmploymentType('part_time')).toBe('unknown')

    // ...while the adapter-normalized value survives.
    expect(normalizeEmploymentType(normalizeAdzunaEmploymentType(baseResult))).toBe('full_time')
    expect(
      normalizeEmploymentType(
        normalizeAdzunaEmploymentType({ ...baseResult, contract_time: 'part_time' }),
      ),
    ).toBe('part_time')
  })

  // Adzuna review (Priya Shah): contract_type: permanent -- Adzuna/UK-market
  // shorthand meaning not-a-fixed-term-contract -- fell through every
  // shared-normalizer pattern to unknown when contract_time was absent.
  it('maps a contract_type-only permanent result to full_time end-to-end', () => {
    const permanentOnly = { ...baseResult, contract_time: undefined, contract_type: 'permanent' }
    expect(normalizeAdzunaEmploymentType(permanentOnly)).toBe('permanent')
    expect(normalizeEmploymentType(normalizeAdzunaEmploymentType(permanentOnly))).toBe('full_time')
  })
})

describe('fetchAdzunaPage', () => {
  it('redacts the request URL from non-OK errors so app_id/app_key never leak', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => 'upstream error',
    } as Response)

    let error: unknown
    try {
      await fetchAdzunaPage({
        country: 'us',
        page: 2,
        query: 'customer service',
        location: 'Dallas, TX',
        appId: 'secret-app-id',
        appKey: 'secret-app-key',
      })
    } catch (err) {
      error = err
    }

    expect(error).toBeInstanceOf(Error)
    expect((error as Error).message).toBe('Adzuna us page 2 responded with 500: upstream error')
    expect((error as Error).message).not.toContain('https://api.adzuna.com')
    expect((error as Error).message).not.toContain('app_id')
    expect((error as Error).message).not.toContain('app_key')

    const [requestUrl] = vi.mocked(fetch).mock.calls[0]
    expect(String(requestUrl)).toContain('https://api.adzuna.com/v1/api/jobs/us/search/2')
    expect(String(requestUrl)).toContain('app_id=secret-app-id')
    expect(String(requestUrl)).toContain('app_key=secret-app-key')
  })

  // Adzuna review (Ryan Mitchell): Adzuna's API path expects a lower-case
  // country code; an upper-case --country flag (e.g. GB) previously hit a
  // path Adzuna does not recognize.
  it('lower-cases the country code in the request URL regardless of input casing', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ results: [], count: 0 }),
    } as Response)

    await fetchAdzunaPage({
      country: 'GB',
      page: 1,
      query: 'engineer',
      appId: 'id',
      appKey: 'key',
    })

    const [requestUrl] = vi.mocked(fetch).mock.calls[0]
    expect(String(requestUrl)).toContain('/v1/api/jobs/gb/search/1')
  })

  // Adzuna review (Ryan Mitchell): a hung upstream connection previously had
  // no bound and could stall the whole sync run indefinitely.
  it('attaches a bounded AbortSignal so a hung request cannot stall the run forever', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ results: [], count: 0 }),
    } as Response)

    await fetchAdzunaPage({
      country: 'us',
      page: 1,
      query: 'engineer',
      appId: 'id',
      appKey: 'key',
    })

    const [, requestInit] = vi.mocked(fetch).mock.calls[0]
    expect((requestInit as RequestInit).signal).toBeInstanceOf(AbortSignal)
  })
})

