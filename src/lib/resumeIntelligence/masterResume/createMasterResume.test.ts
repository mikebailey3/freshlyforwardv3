import { describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createMasterResume } from './createMasterResume'

interface FakeClientOptions {
  existingMaster?: { id: string } | null
  profile?: {
    employment_history: { id?: string; company: string }[]
    education: { id?: string; institution: string }[]
    certifications: { id?: string; name: string }[]
    skills: string[]
  }
  insertVersionId?: string
  insertEntriesError?: { message: string } | null
}

function makeFakeClient(opts: FakeClientOptions = {}) {
  const {
    existingMaster = null,
    profile = {
      employment_history: [{ id: 'entry-emp-1', company: 'Initech' }],
      education: [{ id: 'entry-edu-1', institution: 'State University' }],
      certifications: [{ id: 'entry-cert-1', name: 'PMP' }],
      skills: ['SQL', 'Leadership'],
    },
    insertVersionId = 'version-1',
    insertEntriesError = null,
  } = opts

  const masterMaybeSingleMock = vi.fn().mockResolvedValue({ data: existingMaster, error: null })
  const masterEqArchivedMock = vi.fn().mockReturnValue({ maybeSingle: masterMaybeSingleMock })
  const masterEqMasterMock = vi.fn().mockReturnValue({ eq: masterEqArchivedMock })
  const masterEqMemberMock = vi.fn().mockReturnValue({ eq: masterEqMasterMock })
  const masterSelectMock = vi.fn().mockReturnValue({ eq: masterEqMemberMock })

  const profileMaybeSingleMock = vi.fn().mockResolvedValue({ data: profile, error: null })
  const profileEqMock = vi.fn().mockReturnValue({ maybeSingle: profileMaybeSingleMock })
  const profileSelectMock = vi.fn().mockReturnValue({ eq: profileEqMock })

  const versionInsertSingleMock = vi.fn().mockResolvedValue({ data: { id: insertVersionId }, error: null })
  const versionInsertSelectMock = vi.fn().mockReturnValue({ single: versionInsertSingleMock })
  const versionInsertMock = vi.fn().mockReturnValue({ select: versionInsertSelectMock })

  const entriesInsertMock = vi.fn().mockResolvedValue({ error: insertEntriesError })

  const fromMock = vi.fn((table: string) => {
    if (table === 'resume_versions') return { select: masterSelectMock, insert: versionInsertMock }
    if (table === 'member_profiles') return { select: profileSelectMock }
    if (table === 'resume_entries') return { insert: entriesInsertMock }
    throw new Error(`unexpected table in test: ${table}`)
  })

  const client = { from: fromMock } as unknown as SupabaseClient
  return { client, fromMock, masterSelectMock, versionInsertMock, entriesInsertMock, profileSelectMock }
}

describe('createMasterResume', () => {
  it('refuses to create when an active Master already exists, without inserting anything', async () => {
    const { client, versionInsertMock, entriesInsertMock } = makeFakeClient({ existingMaster: { id: 'version-existing' } })
    const result = await createMasterResume('user-1', { title: 'My Resume', entries: [] }, client)
    expect(result.resumeVersionId).toBeNull()
    expect(result.errors[0]).toContain('already exists')
    expect(versionInsertMock).not.toHaveBeenCalled()
    expect(entriesInsertMock).not.toHaveBeenCalled()
  })

  it('creates a Master resume_versions row when none exists, with is_master=true', async () => {
    const { client, versionInsertMock } = makeFakeClient()
    const result = await createMasterResume('user-1', { title: 'My Resume', sourceDocumentId: 'doc-1', entries: [] }, client)
    expect(result.resumeVersionId).toBe('version-1')
    expect(versionInsertMock).toHaveBeenCalledWith(
      expect.objectContaining({ member_id: 'user-1', title: 'My Resume', is_master: true, source_document_id: 'doc-1' }),
    )
  })

  it('inserts resume_entries for employment/education/certification entries that exist in the canonical Profile', async () => {
    const { client, entriesInsertMock } = makeFakeClient()
    const result = await createMasterResume(
      'user-1',
      {
        title: 'My Resume',
        entries: [
          { entryKind: 'employment', canonicalEntryId: 'entry-emp-1', included: true, sortOrder: 0 },
          { entryKind: 'education', canonicalEntryId: 'entry-edu-1', included: true, sortOrder: 1 },
          { entryKind: 'certification', canonicalEntryId: 'entry-cert-1', included: true, sortOrder: 2 },
        ],
      },
      client,
    )
    expect(result.errors).toEqual([])
    const [rows] = entriesInsertMock.mock.calls[0] as [Record<string, unknown>[]]
    expect(rows).toHaveLength(3)
    expect(rows.every((r) => r.resume_version_id === 'version-1')).toBe(true)
    expect(rows.find((r) => r.entry_kind === 'employment')).toMatchObject({ canonical_entry_id: 'entry-emp-1', skill_value: null })
  })

  it('inserts a resume_entries row for a skill by its string value', async () => {
    const { client, entriesInsertMock } = makeFakeClient()
    await createMasterResume('user-1', { title: 'My Resume', entries: [{ entryKind: 'skill', skillValue: 'SQL', included: true, sortOrder: 0 }] }, client)
    const [rows] = entriesInsertMock.mock.calls[0] as [Record<string, unknown>[]]
    expect(rows[0]).toMatchObject({ entry_kind: 'skill', skill_value: 'SQL', canonical_entry_id: null })
  })

  it('rejects (and skips) an entry selection referencing a canonical_entry_id that does not exist in the member\'s Profile -- never fabricates the reference', async () => {
    const { client, entriesInsertMock } = makeFakeClient()
    const result = await createMasterResume(
      'user-1',
      { title: 'My Resume', entries: [{ entryKind: 'employment', canonicalEntryId: 'entry-does-not-exist', included: true, sortOrder: 0 }] },
      client,
    )
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0]).toContain('entry-does-not-exist')
    expect(entriesInsertMock).not.toHaveBeenCalled()
  })

  it('rejects a skill selection referencing a value not present in member_profiles.skills', async () => {
    const { client, entriesInsertMock } = makeFakeClient()
    const result = await createMasterResume(
      'user-1',
      { title: 'My Resume', entries: [{ entryKind: 'skill', skillValue: 'Fabricated Skill', included: true, sortOrder: 0 }] },
      client,
    )
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0]).toContain('Fabricated Skill')
    expect(entriesInsertMock).not.toHaveBeenCalled()
  })

  it('creates the version and valid entries even when other requested entries are invalid -- partial success, reported not silently dropped', async () => {
    const { client, entriesInsertMock } = makeFakeClient()
    const result = await createMasterResume(
      'user-1',
      {
        title: 'My Resume',
        entries: [
          { entryKind: 'employment', canonicalEntryId: 'entry-emp-1', included: true, sortOrder: 0 },
          { entryKind: 'employment', canonicalEntryId: 'ghost-entry', included: true, sortOrder: 1 },
        ],
      },
      client,
    )
    expect(result.resumeVersionId).toBe('version-1')
    expect(result.errors).toHaveLength(1)
    const [rows] = entriesInsertMock.mock.calls[0] as [Record<string, unknown>[]]
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ canonical_entry_id: 'entry-emp-1' })
  })
})
