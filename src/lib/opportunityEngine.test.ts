import { describe, it, expect, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { buildWhyItMatches, submitMemberJob } from './opportunityEngine'
import type { JobMatchWithJob, MemberProfile } from '@/types'

function makeMatch(overrides: Partial<JobMatchWithJob> = {}): JobMatchWithJob {
  return {
    id: 'm1', member_id: 'u1', scraped_job_id: 'j1', fresh_fit_score: 72,
    matched_skills: ['sql', 'excel'], missing_skills: [], score_breakdown: {},
    dismissed_at: null, promoted_opportunity_id: null, computed_at: '2026-01-01',
    scraped_job: {
      id: 'j1', source: 'greenhouse', external_id: '1', title: 'Analyst', company: 'Acme',
      location: null, description: '', salary_text: null, employment_type: null, posting_url: '',
      posted_at: null, search_query: null, is_active: true, scraped_at: '', created_at: '',
    },
    ...overrides,
  }
}

describe('buildWhyItMatches', () => {
  it('describes matched skills without Forward DNA evidence', () => {
    expect(buildWhyItMatches(makeMatch())).toBe('FreshFit score 72/100. Matched skills: sql, excel.')
  })

  it('calls out strong Forward DNA evidence when present', () => {
    const text = buildWhyItMatches(
      makeMatch({ score_breakdown: { skillsCoverage: 40, roleRelevance: 10, locationFit: 10, keywordDensity: 5, dnaSkillEvidence: 12, scopeFit: 5 } })
    )
    expect(text).toContain('strong fit')
  })

  it('calls out partial Forward DNA evidence when present but low', () => {
    const text = buildWhyItMatches(
      makeMatch({ score_breakdown: { skillsCoverage: 40, roleRelevance: 10, locationFit: 10, keywordDensity: 5, dnaSkillEvidence: 5, scopeFit: 0 } })
    )
    expect(text).toContain('partial fit')
  })
})

function makeFakeClient(opts: {
  jobRow?: Record<string, unknown> | null
  jobError?: string
  matchRow?: Record<string, unknown> | null
  matchError?: string
}) {
  const scrapedJobsSingle = vi.fn().mockResolvedValue({
    data: opts.jobRow ?? null,
    error: opts.jobError ? { message: opts.jobError } : null,
  })
  const scrapedJobsInsert = vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue({ single: scrapedJobsSingle }) })

  const jobMatchesSingle = vi.fn().mockResolvedValue({
    data: opts.matchRow ?? null,
    error: opts.matchError ? { message: opts.matchError } : null,
  })
  const jobMatchesInsert = vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue({ single: jobMatchesSingle }) })

  const fromMock = vi.fn((table: string) => {
    if (table === 'scraped_jobs') return { insert: scrapedJobsInsert }
    if (table === 'job_matches') return { insert: jobMatchesInsert }
    throw new Error(`Unexpected table: ${table}`)
  })

  return { client: { from: fromMock } as unknown as SupabaseClient }
}

const submissionProfile = { user_id: 'member-1', skills: ['sql'] } as unknown as MemberProfile
const submissionInput = { title: 'Data Analyst', company: 'Acme', location: '', salaryText: '', postingUrl: '', description: 'SQL required.' }

describe('submitMemberJob', () => {
  it('inserts a scraped_jobs row and a scored job_matches row', async () => {
    const jobRow = {
      id: 'job-1', source: 'member-submitted', external_id: 'member-member-1-123', title: 'Data Analyst',
      company: 'Acme', location: null, description: 'SQL required.', salary_text: null, employment_type: null,
      posting_url: '', posted_at: null, search_query: 'member-submitted', is_active: true, scraped_at: '', created_at: '',
    }
    const matchRow = { id: 'match-1', member_id: 'member-1', scraped_job_id: 'job-1' }
    const { client } = makeFakeClient({ jobRow, matchRow })

    const { match, error } = await submitMemberJob(submissionProfile, submissionInput, client)

    expect(error).toBeNull()
    expect(match?.id).toBe('match-1')
    expect(match?.scraped_job).toEqual(jobRow)
  })

  it('returns an error when the scraped_jobs insert fails', async () => {
    const { client } = makeFakeClient({ jobError: 'insert failed' })
    const { match, error } = await submitMemberJob(submissionProfile, submissionInput, client)
    expect(match).toBeNull()
    expect(error).toBe('insert failed')
  })

  it('returns an error when the job_matches insert fails', async () => {
    const jobRow = { id: 'job-1', source: 'member-submitted', external_id: 'x', title: 't', company: 'c', description: 'd', posting_url: '', search_query: 'member-submitted', is_active: true }
    const { client } = makeFakeClient({ jobRow, matchError: 'match insert failed' })
    const { match, error } = await submitMemberJob(submissionProfile, submissionInput, client)
    expect(match).toBeNull()
    expect(error).toBe('match insert failed')
  })
})
