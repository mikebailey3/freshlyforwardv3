import { describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { fetchResumeVersionBuilderData } from './fetchResumeVersionBuilderData'

interface FakeOpts {
  version?: Record<string, unknown> | null
  entries?: Record<string, unknown>[]
  opportunity?: Record<string, unknown> | null
}

function makeFakeClient(opts: FakeOpts = {}) {
  const { version = null, entries = [], opportunity = null } = opts

  const versionMaybeSingleMock = vi.fn().mockResolvedValue({ data: version, error: null })
  const versionEqArchivedMock = vi.fn().mockReturnValue({ maybeSingle: versionMaybeSingleMock })
  const versionEqMemberMock = vi.fn().mockReturnValue({ eq: versionEqArchivedMock })
  const versionEqIdMock = vi.fn().mockReturnValue({ eq: versionEqMemberMock })
  const versionSelectMock = vi.fn().mockReturnValue({ eq: versionEqIdMock })

  const entriesOrderMock = vi.fn().mockResolvedValue({ data: entries, error: null })
  const entriesEqMock = vi.fn().mockReturnValue({ order: entriesOrderMock })
  const entriesSelectMock = vi.fn().mockReturnValue({ eq: entriesEqMock })

  const oppMaybeSingleMock = vi.fn().mockResolvedValue({ data: opportunity, error: null })
  const oppEqMock = vi.fn().mockReturnValue({ maybeSingle: oppMaybeSingleMock })
  const oppSelectMock = vi.fn().mockReturnValue({ eq: oppEqMock })

  const fromMock = vi.fn((table: string) => {
    if (table === 'resume_versions') return { select: versionSelectMock }
    if (table === 'resume_entries') return { select: entriesSelectMock }
    if (table === 'opportunities') return { select: oppSelectMock }
    throw new Error(`unexpected table in test: ${table}`)
  })

  return { client: { from: fromMock } as unknown as SupabaseClient }
}

describe('fetchResumeVersionBuilderData', () => {
  it('returns null (not a fabricated placeholder) when the version does not belong to this member or does not exist', async () => {
    const { client } = makeFakeClient({ version: null })
    const result = await fetchResumeVersionBuilderData('user-1', 'version-x', client)
    expect(result).toBeNull()
  })

  it('returns the version row plus entries when it exists and belongs to this member', async () => {
    const { client } = makeFakeClient({
      version: { id: 'version-1', title: 'Master Resume', is_master: true, template_key: 'ats_classic', section_order: ['employment'], summary_override: null, derived_from_resume_version_id: null, target_opportunity_id: null },
      entries: [{ entry_kind: 'skill', canonical_entry_id: null, skill_value: 'SQL', included: true, sort_order: 0, override_description: null }],
    })
    const result = await fetchResumeVersionBuilderData('user-1', 'version-1', client)
    expect(result).toMatchObject({ id: 'version-1', isMaster: true, templateKey: 'ats_classic', targetOpportunity: null })
    expect(result?.entries).toHaveLength(1)
  })

  it('resolves the linked opportunity for a tailored (non-Master) version', async () => {
    const { client } = makeFakeClient({
      version: { id: 'version-2', title: 'Tailored for Acme', is_master: false, template_key: 'ats_classic', section_order: null, summary_override: null, derived_from_resume_version_id: 'version-1', target_opportunity_id: 'opp-1' },
      opportunity: { id: 'opp-1', job_title: 'Senior Engineer', employer: 'Acme Co' },
    })
    const result = await fetchResumeVersionBuilderData('user-1', 'version-2', client)
    expect(result?.targetOpportunity).toEqual({ id: 'opp-1', jobTitle: 'Senior Engineer', employer: 'Acme Co' })
    expect(result?.derivedFromResumeVersionId).toBe('version-1')
  })

  it('never fabricates a target opportunity when the linked opportunity row cannot be found', async () => {
    const { client } = makeFakeClient({
      version: { id: 'version-2', title: 'Tailored', is_master: false, template_key: 'ats_classic', section_order: null, summary_override: null, derived_from_resume_version_id: 'version-1', target_opportunity_id: 'missing-opp' },
      opportunity: null,
    })
    const result = await fetchResumeVersionBuilderData('user-1', 'version-2', client)
    expect(result?.targetOpportunity).toBeNull()
  })
})
