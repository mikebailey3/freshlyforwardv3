import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ScrapedJobInput } from './jobSources/types'

const {
  mockCreateClient,
  mockFetchAdzunaPage,
  mockParseAdzunaJobs,
  mockConsoleLog,
  mockConsoleError,
  mockProcessExit,
} = vi.hoisted(() => ({
  mockCreateClient: vi.fn(),
  mockFetchAdzunaPage: vi.fn(),
  mockParseAdzunaJobs: vi.fn(),
  mockConsoleLog: vi.fn(),
  mockConsoleError: vi.fn(),
  mockProcessExit: vi.fn(),
}))

vi.mock('@supabase/supabase-js', () => ({
  createClient: mockCreateClient,
}))

vi.mock('./jobSources/adzuna', () => ({
  fetchAdzunaPage: mockFetchAdzunaPage,
  parseAdzunaJobs: mockParseAdzunaJobs,
}))

vi.mock('./lib/errorDetail', () => ({
  getErrorDetail: (err: unknown) => (err instanceof Error ? err.message : String(err)),
}))

import { main, parseArgs } from './scrapeJobs'

const originalEnv = {
  VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  ADZUNA_APP_ID: process.env.ADZUNA_APP_ID,
  ADZUNA_APP_KEY: process.env.ADZUNA_APP_KEY,
}

const originalArgv = [...process.argv]
const originalConsoleLog = console.log
const originalConsoleError = console.error
const originalProcessExit = process.exit

function makeJob(id: string): ScrapedJobInput {
  return {
    source: 'adzuna',
    external_id: id,
    title: `Job ${id}`,
    company: 'Acme',
    location: 'Dallas, TX',
    description: `Description ${id}`,
    salary_text: null,
    employment_type: null,
    posting_url: `https://example.com/${id}`,
    posted_at: '2026-09-01',
    search_query: 'customer service',
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  process.env.VITE_SUPABASE_URL = 'https://example.supabase.co'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key'
  process.env.ADZUNA_APP_ID = 'app-id'
  process.env.ADZUNA_APP_KEY = 'app-key'
  process.argv = ['node', 'scripts/scrapeJobs.ts']
  console.log = mockConsoleLog
  console.error = mockConsoleError
  process.exit = mockProcessExit as never

  mockCreateClient.mockReturnValue({
    from: vi.fn().mockReturnValue({
      upsert: vi.fn().mockResolvedValue({ error: null }),
    }),
  })
  mockParseAdzunaJobs.mockImplementation((response: { results?: ScrapedJobInput[] }) => response.results ?? [])
})

afterEach(() => {
  process.env.VITE_SUPABASE_URL = originalEnv.VITE_SUPABASE_URL
  process.env.SUPABASE_SERVICE_ROLE_KEY = originalEnv.SUPABASE_SERVICE_ROLE_KEY
  process.env.ADZUNA_APP_ID = originalEnv.ADZUNA_APP_ID
  process.env.ADZUNA_APP_KEY = originalEnv.ADZUNA_APP_KEY
  process.argv = [...originalArgv]
  console.log = originalConsoleLog
  console.error = originalConsoleError
  process.exit = originalProcessExit
})

describe('parseArgs', () => {
  it('uses safe defaults when no flags are provided', () => {
    expect(parseArgs([])).toEqual({
      query: 'customer service',
      location: '',
      pages: 1,
      country: 'us',
    })
  })

  it('parses explicit values', () => {
    expect(parseArgs(['--query', 'data analyst', '--location', 'Dallas, TX', '--pages', '3', '--country', 'gb'])).toEqual({
      query: 'data analyst',
      location: 'Dallas, TX',
      pages: 3,
      country: 'gb',
    })
  })

  it('rejects missing or invalid --pages values', () => {
    expect(() => parseArgs(['--pages'])).toThrow('Invalid --pages value')
    expect(() => parseArgs(['--pages', '0'])).toThrow('Expected a positive integer')
    expect(() => parseArgs(['--pages', 'not-a-number'])).toThrow('Expected a positive integer')
  })

  it('rejects absurdly large --pages values with the same loud failure', () => {
    expect(() => parseArgs(['--pages', '51'])).toThrow('Invalid --pages value')
    expect(() => parseArgs(['--pages', '999999999999999999999'])).toThrow('Invalid --pages value')
  })
})

describe('main', () => {
  it('stops early once Adzuna reports that there are no more results to fetch', async () => {
    process.argv = ['node', 'scripts/scrapeJobs.ts', '--pages', '5']

    mockFetchAdzunaPage
      .mockResolvedValueOnce({ results: [makeJob('1'), makeJob('2')], count: 3 })
      .mockResolvedValueOnce({ results: [makeJob('3')], count: 3 })

    await main()

    expect(mockFetchAdzunaPage).toHaveBeenCalledTimes(2)
    expect(mockConsoleLog).toHaveBeenCalledWith('No more results available, stopping early.')
    expect(mockConsoleLog).toHaveBeenCalledWith('Jobs discovered this run: 3')
    expect(mockProcessExit).not.toHaveBeenCalled()
  })

  it('exits non-zero when any page fails, while still reporting successful upserts', async () => {
    process.argv = ['node', 'scripts/scrapeJobs.ts', '--pages', '2']

    mockFetchAdzunaPage
      .mockResolvedValueOnce({ results: [makeJob('1')], count: 2 })
      .mockRejectedValueOnce(new Error('simulated page 2 failure'))

    await main()

    expect(mockConsoleLog).toHaveBeenCalledWith('Jobs discovered this run: 1')
    expect(mockConsoleLog).toHaveBeenCalledWith('Status: PARTIAL')
    expect(mockConsoleError).toHaveBeenCalledWith('One or more Adzuna pages failed -- failing the run so the outage is visible.')
    expect(mockProcessExit).toHaveBeenCalledWith(1)
  })
})
