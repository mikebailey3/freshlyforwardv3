import { describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { archiveResumeVersion } from './archiveResumeVersion'

function makeFakeClient(opts: { version?: { id: string; is_master: boolean } | null; updateError?: { message: string } | null } = {}) {
  const { version = { id: 'v-2', is_master: false }, updateError = null } = opts

  const maybeSingleMock = vi.fn().mockResolvedValue({ data: version, error: null })
  const eqArchivedMock = vi.fn().mockReturnValue({ maybeSingle: maybeSingleMock })
  const eqMemberMock = vi.fn().mockReturnValue({ eq: eqArchivedMock })
  const eqIdMock = vi.fn().mockReturnValue({ eq: eqMemberMock })
  const selectMock = vi.fn().mockReturnValue({ eq: eqIdMock })

  const updateEqMock = vi.fn().mockResolvedValue({ error: updateError })
  const updateMock = vi.fn().mockReturnValue({ eq: updateEqMock })

  const fromMock = vi.fn(() => ({ select: selectMock, update: updateMock }))
  return { client: { from: fromMock } as unknown as SupabaseClient, updateMock }
}

describe('archiveResumeVersion', () => {
  it('refuses to archive a version that does not belong to this member', async () => {
    const { client, updateMock } = makeFakeClient({ version: null })
    const result = await archiveResumeVersion('user-1', 'v-2', client)
    expect(result.error).toContain('not found')
    expect(updateMock).not.toHaveBeenCalled()
  })

  it('refuses to archive the active Master directly, never as a silent side effect', async () => {
    const { client, updateMock } = makeFakeClient({ version: { id: 'v-1', is_master: true } })
    const result = await archiveResumeVersion('user-1', 'v-1', client)
    expect(result.error).toContain('Master')
    expect(updateMock).not.toHaveBeenCalled()
  })

  it('archives a non-Master version owned by this member', async () => {
    const { client, updateMock } = makeFakeClient()
    const result = await archiveResumeVersion('user-1', 'v-2', client)
    expect(result.error).toBeNull()
    expect(updateMock).toHaveBeenCalledWith({ is_archived: true })
  })
})
