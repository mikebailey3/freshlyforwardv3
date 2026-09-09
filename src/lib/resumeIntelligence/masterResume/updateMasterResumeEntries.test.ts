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
  deleteError?: { message: string } | null
  insertError?: { message: string } | null
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
    deleteError = null,
    insertError = null,
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

  const deleteEqMock = vi.fn().mockResolvedValue({ error: deleteError })
  const deleteMock = vi.fn().mockReturnValue({ eq: deleteEqMock })

  const entriesInsertMock = vi.fn().mockResolvedValue({ error: insertError })

  const fromMock = vi.fn((table: string) => {
    if (table === 'resume_versions') return { select: masterSelectMock }
    if (table === 'member_profiles') return { select: profileSelectMock }
    if (table === 'resume_entries') return { delete: deleteMock, insert: entriesInsertMock }
    throw new Error(`unexpected table in test: ${table}`)
  })

  return { client: { from: fromMock } as unknown as SupabaseClient, fromMock, deleteMock, deleteEqMock, entriesInsertMock }
}

describe('updateMasterResumeEntries', () => {
  it('reports an error and writes nothing when no active Master exists for this version/member', async () => {
    const { client, deleteMock, entriesInsertMock } = makeFakeClient({ master: null })
    const result = await updateMasterResumeEntries('user-1', 'version-1', [], client)
    expect(result.errors[0]).toContain('not found')
    expect(deleteMock).not.toHaveBeenCalled()
    expect(entriesInsertMock).not.toHaveBeenCalled()
  })

  it('replaces all entries for the Master: deletes existing rows, then inserts the validated new set', async () => {
    const { client, deleteMock, deleteEqMock, entriesInsertMock } = makeFakeClient()
    const result = await updateMasterResumeEntries(
      'user-1',
      'version-1',
      [{ entryKind: 'employment', canonicalEntryId: 'entry-emp-1', included: true, sortOrder: 0 }],
      client,
    )
    expect(result.errors).toEqual([])
    expect(deleteMock).toHaveBeenCalled()
    expect(deleteEqMock).toHaveBeenCalledWith('resume_version_id', 'version-1')
    const [rows] = entriesInsertMock.mock.calls[0] as [Record<string, unknown>[]]
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ resume_version_id: 'version-1', canonical_entry_id: 'entry-emp-1' })
  })

  it('never fabricates a reference to an entry no longer present in the Profile -- reports and skips it', async () => {
    const { client, entriesInsertMock } = makeFakeClient()
    const result = await updateMasterResumeEntries(
      'user-1',
      'version-1',
      [{ entryKind: 'employment', canonicalEntryId: 'ghost', included: true, sortOrder: 0 }],
      client,
    )
    expect(result.errors).toHaveLength(1)
    expect(entriesInsertMock).not.toHaveBeenCalled()
  })

  it('an empty entry set is valid -- clears the Master down to zero entries without error', async () => {
    const { client, deleteMock, entriesInsertMock } = makeFakeClient()
    const result = await updateMasterResumeEntries('user-1', 'version-1', [], client)
    expect(result.errors).toEqual([])
    expect(deleteMock).toHaveBeenCalled()
    expect(entriesInsertMock).not.toHaveBeenCalled()
  })

  it('surfaces a delete failure without attempting the insert', async () => {
    const { client, entriesInsertMock } = makeFakeClient({ deleteError: { message: 'delete failed' } })
    const result = await updateMasterResumeEntries(
      'user-1',
      'version-1',
      [{ entryKind: 'skill', skillValue: 'SQL', included: true, sortOrder: 0 }],
      client,
    )
    expect(result.errors).toContain('delete failed')
    expect(entriesInsertMock).not.toHaveBeenCalled()
  })
})
