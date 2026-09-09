import { describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { updateResumeVersionEntries } from './updateResumeVersionEntries'

interface FakeClientOptions {
  version?: { id: string } | null
  profile?: {
    employment_history: { id?: string }[]
    education: { id?: string }[]
    certifications: { id?: string }[]
    skills: string[]
  }
  rpcError?: { message: string } | null
}

function makeFakeClient(opts: FakeClientOptions = {}) {
  const {
    version = { id: 'version-2' },
    profile = {
      employment_history: [{ id: 'entry-emp-1' }],
      education: [],
      certifications: [],
      skills: ['SQL'],
    },
    rpcError = null,
  } = opts

  const versionMaybeSingleMock = vi.fn().mockResolvedValue({ data: version, error: null })
  const versionEqArchivedMock = vi.fn().mockReturnValue({ maybeSingle: versionMaybeSingleMock })
  const versionEqMemberMock = vi.fn().mockReturnValue({ eq: versionEqArchivedMock })
  const versionEqIdMock = vi.fn().mockReturnValue({ eq: versionEqMemberMock })
  const versionSelectMock = vi.fn().mockReturnValue({ eq: versionEqIdMock })

  const profileMaybeSingleMock = vi.fn().mockResolvedValue({ data: profile, error: null })
  const profileEqMock = vi.fn().mockReturnValue({ maybeSingle: profileMaybeSingleMock })
  const profileSelectMock = vi.fn().mockReturnValue({ eq: profileEqMock })

  const rpcMock = vi.fn().mockResolvedValue({ error: rpcError })

  const fromMock = vi.fn((table: string) => {
    if (table === 'resume_versions') return { select: versionSelectMock }
    if (table === 'member_profiles') return { select: profileSelectMock }
    throw new Error(`unexpected table in test: ${table}`)
  })

  return { client: { from: fromMock, rpc: rpcMock } as unknown as SupabaseClient, rpcMock }
}

describe('updateResumeVersionEntries', () => {
  it('reports an error and never calls the RPC when the version does not belong to this member (or is archived)', async () => {
    const { client, rpcMock } = makeFakeClient({ version: null })
    const result = await updateResumeVersionEntries('user-1', 'version-2', [], client)
    expect(result.errors[0]).toContain('not found')
    expect(rpcMock).not.toHaveBeenCalled()
  })

  it('works for a NON-master (derived/tailored) version -- unlike updateMasterResumeEntries, no is_master check exists here', async () => {
    const { client, rpcMock } = makeFakeClient()
    const result = await updateResumeVersionEntries(
      'user-1',
      'version-2',
      [{ entryKind: 'skill', skillValue: 'SQL', included: true, sortOrder: 0 }],
      client,
    )
    expect(result.errors).toEqual([])
    expect(rpcMock).toHaveBeenCalledTimes(1)
    const [rpcName, rpcArgs] = rpcMock.mock.calls[0] as [string, { p_resume_version_id: string; p_entries: Record<string, unknown>[] }]
    expect(rpcName).toBe('replace_resume_version_entries')
    expect(rpcArgs.p_resume_version_id).toBe('version-2')
    expect(rpcArgs.p_entries).toHaveLength(1)
  })

  it('never fabricates a reference to an entry no longer present in the Profile', async () => {
    const { client, rpcMock } = makeFakeClient()
    const result = await updateResumeVersionEntries(
      'user-1',
      'version-2',
      [{ entryKind: 'employment', canonicalEntryId: 'ghost', included: true, sortOrder: 0 }],
      client,
    )
    expect(result.errors).toHaveLength(1)
    const [, rpcArgs] = rpcMock.mock.calls[0] as [string, { p_entries: unknown[] }]
    expect(rpcArgs.p_entries).toEqual([])
  })

  it('surfaces an RPC failure as an error', async () => {
    const { client } = makeFakeClient({ rpcError: { message: 'replace failed' } })
    const result = await updateResumeVersionEntries(
      'user-1',
      'version-2',
      [{ entryKind: 'skill', skillValue: 'SQL', included: true, sortOrder: 0 }],
      client,
    )
    expect(result.errors).toContain('replace failed')
  })
})
