import { describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { duplicateResumeVersion } from './duplicateResumeVersion'

function makeFakeClient(
  opts: {
    source?: { id: string; template_key: string; section_order: unknown; summary_override: string | null } | null
    entries?: Record<string, unknown>[]
    newVersion?: { id: string } | null
    insertVersionError?: { message: string } | null
    insertEntriesError?: { message: string } | null
  } = {},
) {
  const {
    source = { id: 'v-1', template_key: 'modern', section_order: ['employment'], summary_override: null },
    entries = [{ entry_kind: 'employment', canonical_entry_id: 'emp-1', skill_value: null, included: true, sort_order: 0, override_description: null }],
    newVersion = { id: 'v-2' },
    insertVersionError = null,
    insertEntriesError = null,
  } = opts

  const sourceMaybeSingleMock = vi.fn().mockResolvedValue({ data: source, error: null })
  const sourceEqArchivedMock = vi.fn().mockReturnValue({ maybeSingle: sourceMaybeSingleMock })
  const sourceEqMemberMock = vi.fn().mockReturnValue({ eq: sourceEqArchivedMock })
  const sourceEqIdMock = vi.fn().mockReturnValue({ eq: sourceEqMemberMock })
  const sourceSelectMock = vi.fn().mockReturnValue({ eq: sourceEqIdMock })

  const entriesEqMock = vi.fn().mockResolvedValue({ data: entries, error: null })
  const entriesSelectMock = vi.fn().mockReturnValue({ eq: entriesEqMock })

  const versionSingleMock = vi.fn().mockResolvedValue({ data: newVersion, error: insertVersionError })
  const versionInsertSelectMock = vi.fn().mockReturnValue({ single: versionSingleMock })
  const versionInsertMock = vi.fn().mockReturnValue({ select: versionInsertSelectMock })

  const entriesInsertMock = vi.fn().mockResolvedValue({ error: insertEntriesError })

  const fromMock = vi.fn((table: string) => {
    if (table === 'resume_versions') return { select: sourceSelectMock, insert: versionInsertMock }
    if (table === 'resume_entries') return { select: entriesSelectMock, insert: entriesInsertMock }
    throw new Error(`unexpected table: ${table}`)
  })

  return { client: { from: fromMock } as unknown as SupabaseClient, versionInsertMock, entriesInsertMock }
}

describe('duplicateResumeVersion', () => {
  it('refuses to duplicate a version that does not belong to this member', async () => {
    const { client, versionInsertMock } = makeFakeClient({ source: null })
    const result = await duplicateResumeVersion('user-1', 'v-1', 'Copy', client)
    expect(result.error).toContain('not found')
    expect(versionInsertMock).not.toHaveBeenCalled()
  })

  it('creates a new non-Master version carrying the source template/layout, with lineage back to the source', async () => {
    const { client, versionInsertMock } = makeFakeClient()
    const result = await duplicateResumeVersion('user-1', 'v-1', 'Copy of Master', client)
    expect(result.error).toBeNull()
    expect(result.newResumeVersionId).toBe('v-2')
    expect(versionInsertMock).toHaveBeenCalledWith(
      expect.objectContaining({ is_master: false, derived_from_resume_version_id: 'v-1', template_key: 'modern', title: 'Copy of Master' }),
    )
  })

  it('copies the source entries into the new version -- never mutating the source version', async () => {
    const { client, entriesInsertMock } = makeFakeClient()
    await duplicateResumeVersion('user-1', 'v-1', 'Copy', client)
    expect(entriesInsertMock).toHaveBeenCalledWith([expect.objectContaining({ resume_version_id: 'v-2', canonical_entry_id: 'emp-1' })])
  })

  it('surfaces an error if creating the new version row fails', async () => {
    const { client } = makeFakeClient({ newVersion: null, insertVersionError: { message: 'insert failed' } })
    const result = await duplicateResumeVersion('user-1', 'v-1', 'Copy', client)
    expect(result.error).toBe('insert failed')
  })
})
