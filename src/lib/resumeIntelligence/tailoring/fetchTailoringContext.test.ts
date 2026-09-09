import { describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { fetchTailoringContext } from './fetchTailoringContext'

interface FakeOpts {
  opportunity?: Record<string, unknown> | null
  profile?: Record<string, unknown> | null
  master?: Record<string, unknown> | null
  entries?: Record<string, unknown>[]
}

function makeFakeClient(opts: FakeOpts = {}) {
  const { opportunity = { id: 'opp-1', job_title: 'Analyst', employer: 'Acme', full_job_description: 'Requires SQL.' }, profile = { skills: ['SQL', 'Python'] }, master = { id: 'master-1', title: 'Master Resume' }, entries = [{ skill_value: 'SQL' }] } = opts

  const oppMaybeSingleMock = vi.fn().mockResolvedValue({ data: opportunity, error: null })
  const oppEqMemberMock = vi.fn().mockReturnValue({ maybeSingle: oppMaybeSingleMock })
  const oppEqIdMock = vi.fn().mockReturnValue({ eq: oppEqMemberMock })
  const oppSelectMock = vi.fn().mockReturnValue({ eq: oppEqIdMock })

  const profileMaybeSingleMock = vi.fn().mockResolvedValue({ data: profile, error: null })
  const profileEqMock = vi.fn().mockReturnValue({ maybeSingle: profileMaybeSingleMock })
  const profileSelectMock = vi.fn().mockReturnValue({ eq: profileEqMock })

  const masterMaybeSingleMock = vi.fn().mockResolvedValue({ data: master, error: null })
  const masterEqArchivedMock = vi.fn().mockReturnValue({ maybeSingle: masterMaybeSingleMock })
  const masterEqMasterMock = vi.fn().mockReturnValue({ eq: masterEqArchivedMock })
  const masterEqMemberMock = vi.fn().mockReturnValue({ eq: masterEqMasterMock })
  const masterSelectMock = vi.fn().mockReturnValue({ eq: masterEqMemberMock })

  const entriesEqIncludedMock = vi.fn().mockResolvedValue({ data: entries, error: null })
  const entriesEqKindMock = vi.fn().mockReturnValue({ eq: entriesEqIncludedMock })
  const entriesEqVersionMock = vi.fn().mockReturnValue({ eq: entriesEqKindMock })
  const entriesSelectMock = vi.fn().mockReturnValue({ eq: entriesEqVersionMock })

  const fromMock = vi.fn((table: string) => {
    if (table === 'opportunities') return { select: oppSelectMock }
    if (table === 'member_profiles') return { select: profileSelectMock }
    if (table === 'resume_versions') return { select: masterSelectMock }
    if (table === 'resume_entries') return { select: entriesSelectMock }
    throw new Error(`unexpected table in test: ${table}`)
  })

  return { client: { from: fromMock } as unknown as SupabaseClient }
}

describe('fetchTailoringContext', () => {
  it('returns an honest error (never a fabricated context) when the opportunity is not found or not owned', async () => {
    const { client } = makeFakeClient({ opportunity: null })
    const result = await fetchTailoringContext('user-1', 'opp-x', client)
    expect(result.context).toBeNull()
    expect(result.error).toContain('Could not find this opportunity')
  })

  it('returns an honest error when the member has no Master Resume yet to tailor from', async () => {
    const { client } = makeFakeClient({ master: null })
    const result = await fetchTailoringContext('user-1', 'opp-1', client)
    expect(result.context).toBeNull()
    expect(result.error).toContain('Master Resume')
  })

  it('assembles the full tailoring context from the opportunity, canonical Profile, and active Master', async () => {
    const { client } = makeFakeClient()
    const result = await fetchTailoringContext('user-1', 'opp-1', client)
    expect(result.error).toBeNull()
    expect(result.context).toMatchObject({
      opportunityId: 'opp-1',
      jobTitle: 'Analyst',
      employer: 'Acme',
      jobText: 'Analyst Requires SQL.',
      sourceResumeVersionId: 'master-1',
      sourceResumeTitle: 'Master Resume',
      canonicalSkills: ['SQL', 'Python'],
      includedResumeSkills: ['SQL'],
    })
  })
})
