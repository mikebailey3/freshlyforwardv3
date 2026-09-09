import { describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { fetchMasterResumeEntries } from './fetchMasterResumeEntries'

function makeFakeClient(rows: Record<string, unknown>[] = []) {
  const orderMock = vi.fn().mockResolvedValue({ data: rows, error: null })
  const eqMock = vi.fn().mockReturnValue({ order: orderMock })
  const selectMock = vi.fn().mockReturnValue({ eq: eqMock })
  const fromMock = vi.fn().mockReturnValue({ select: selectMock })
  return { client: { from: fromMock } as unknown as SupabaseClient, fromMock, eqMock }
}

describe('fetchMasterResumeEntries', () => {
  it('maps resume_entries rows back into MasterResumeEntryInput shape for pre-filling the builder', async () => {
    const { client } = makeFakeClient([
      { entry_kind: 'employment', canonical_entry_id: 'entry-emp-1', skill_value: null, included: true, sort_order: 0, override_description: 'Custom text' },
      { entry_kind: 'skill', canonical_entry_id: null, skill_value: 'SQL', included: false, sort_order: 1, override_description: null },
    ])
    const entries = await fetchMasterResumeEntries('version-1', client)
    expect(entries).toEqual([
      { entryKind: 'employment', canonicalEntryId: 'entry-emp-1', skillValue: undefined, included: true, sortOrder: 0, overrideDescription: 'Custom text' },
      { entryKind: 'skill', canonicalEntryId: undefined, skillValue: 'SQL', included: false, sortOrder: 1, overrideDescription: null },
    ])
  })

  it('queries by resume_version_id', async () => {
    const { client, eqMock } = makeFakeClient([])
    await fetchMasterResumeEntries('version-1', client)
    expect(eqMock).toHaveBeenCalledWith('resume_version_id', 'version-1')
  })
})
