import { describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { updateMasterResumeEntries } from './updateMasterResumeEntries'

interface FakeClientOptions {
  master?: { id: string } | null
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
    master = { id: 'version-1' },
    profile = {
      employment_history: [{ id: 'entry-emp-1' }],
      education: [{ id: 'entry-edu-1' }],
      certifications: [{ id: 'entry-cert-1' }],
      skills: ['SQL'],
    },
    rpcError = null,
  } = opts

  const masterMaybeSingleMock = vi.fn().mockResolvedValue({ data: master, error: null })
  const masterEqArchivedMock = vi.fn().mockReturnValue({ maybeSingle: masterMaybeSingleMock })
  const masterEqMasterMock = vi.fn().mockReturnValue({ eq: masterEqArchivedMock })
  const masterEqMemberMock = vi.fn().mockReturnValue({ eq: masterEqMasterMock })
  const masterEqIdMock = vi.fn().mockReturnValue({ eq: masterEqMemberMock })
  const masterSelectMock = vi.fn().mockReturnValue({ eq: masterEqIdMock })

  const profileMaybeSingleMock = vi.fn().mockResolvedValue({ data: profile, error: null })
  const profileEqMock = vi.fn().mockReturnValue({ maybeSingle: profileMaybeSingleMock })
  const profileSelectMock = vi.fn().mockReturnValue({ eq: profileEqMock })

  const rpcMock = vi.fn().mockResolvedValue({ error: rpcError })

  const fromMock = vi.fn((table: string) => {
    if (table === 'resume_versions') return { select: masterSelectMock }
    if (table === 'member_profiles') return { select: profileSelectMock }
    throw new Error(`unexpected table in test: ${table}`)
  })

  return { client: { from: fromMock, rpc: rpcMock } as unknown as SupabaseClient, fromMock, rpcMock }
}

describe('updateMasterResumeEntries', () => {
  it('reports an error and never calls the replace RPC when no active Master exists for this version/member', async () => {
    const { client, rpcMock } = makeFakeClient({ master: null })
    const result = await updateMasterResumeEntries('user-1', 'version-1', [], client)
    expect(result.errors[0]).toContain('not found')
    expect(rpcMock).not.toHaveBeenCalled()
  })

  it('replaces all entries for the Master via one atomic replace_master_resume_entries RPC call', async () => {
    const { client, rpcMock } = makeFakeClient()
    const result = await updateMasterResumeEntries(
      'user-1',
      'version-1',
      [{ entryKind: 'employment', canonicalEntryId: 'entry-emp-1', included: true, sortOrder: 0 }],
      client,
    )
    expect(result.errors).toEqual([])
    expect(rpcMock).toHaveBeenCalledTimes(1)
    const [rpcName, rpcArgs] = rpcMock.mock.calls[0] as [string, { p_resume_version_id: string; p_entries: Record<string, unknown>[] }]
    expect(rpcName).toBe('replace_master_resume_entries')
    expect(rpcArgs.p_resume_version_id).toBe('version-1')
    expect(rpcArgs.p_entries).toHaveLength(1)
    expect(rpcArgs.p_entries[0]).toMatchObject({ resume_version_id: 'version-1', canonical_entry_id: 'entry-emp-1' })
  })

  it('never fabricates a reference to an entry no longer present in the Profile -- reports and excludes it from the RPC payload', async () => {
    const { client, rpcMock } = makeFakeClient()
    const result = await updateMasterResumeEntries(
      'user-1',
      'version-1',
      [{ entryKind: 'employment', canonicalEntryId: 'ghost', included: true, sortOrder: 0 }],
      client,
    )
    expect(result.errors).toHaveLength(1)
    const [, rpcArgs] = rpcMock.mock.calls[0] as [string, { p_entries: unknown[] }]
    expect(rpcArgs.p_entries).toEqual([])
  })

  it('an empty entry set is valid -- calls the RPC with an empty array to clear the Master down to zero entries', async () => {
    const { client, rpcMock } = makeFakeClient()
    const result = await updateMasterResumeEntries('user-1', 'version-1', [], client)
    expect(result.errors).toEqual([])
    expect(rpcMock).toHaveBeenCalledTimes(1)
    const [, rpcArgs] = rpcMock.mock.calls[0] as [string, { p_entries: unknown[] }]
    expect(rpcArgs.p_entries).toEqual([])
  })

  it('surfaces an RPC failure as an error -- the atomic RPC guarantees nothing was partially written', async () => {
    const { client } = makeFakeClient({ rpcError: { message: 'replace failed' } })
    const result = await updateMasterResumeEntries(
      'user-1',
      'version-1',
      [{ entryKind: 'skill', skillValue: 'SQL', included: true, sortOrder: 0 }],
      client,
    )
    expect(result.errors).toContain('replace failed')
  })
})
