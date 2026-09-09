import { describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { updateResumeLayout } from './updateResumeLayout'

function makeFakeClient(opts: { version?: { id: string } | null; updateError?: { message: string } | null } = {}) {
  const { version = { id: 'version-1' }, updateError = null } = opts

  const maybeSingleMock = vi.fn().mockResolvedValue({ data: version, error: null })
  const eqArchivedMock = vi.fn().mockReturnValue({ maybeSingle: maybeSingleMock })
  const eqMemberMock = vi.fn().mockReturnValue({ eq: eqArchivedMock })
  const eqIdMock = vi.fn().mockReturnValue({ eq: eqMemberMock })
  const selectMock = vi.fn().mockReturnValue({ eq: eqIdMock })

  const updateEqMock = vi.fn().mockResolvedValue({ error: updateError })
  const updateMock = vi.fn().mockReturnValue({ eq: updateEqMock })

  const fromMock = vi.fn(() => ({ select: selectMock, update: updateMock }))

  return { client: { from: fromMock } as unknown as SupabaseClient, updateMock, updateEqMock }
}

describe('updateResumeLayout', () => {
  it('refuses to write layout for a version that does not belong to this member (ownership check)', async () => {
    const { client, updateMock } = makeFakeClient({ version: null })
    const result = await updateResumeLayout('user-1', 'version-1', { templateKey: 'modern' }, client)
    expect(result.error).toContain('not found')
    expect(updateMock).not.toHaveBeenCalled()
  })

  it('persists a valid template key', async () => {
    const { client, updateMock } = makeFakeClient()
    const result = await updateResumeLayout('user-1', 'version-1', { templateKey: 'modern' }, client)
    expect(result.error).toBeNull()
    expect(updateMock).toHaveBeenCalledWith({ template_key: 'modern' })
  })

  it('rejects an unknown template key without writing anything', async () => {
    const { client, updateMock } = makeFakeClient()
    const result = await updateResumeLayout('user-1', 'version-1', { templateKey: 'not-a-real-template' }, client)
    expect(result.error).toContain('Unknown template')
    expect(updateMock).not.toHaveBeenCalled()
  })

  it('filters unknown section keys out of a requested section order before persisting', async () => {
    const { client, updateMock } = makeFakeClient()
    await updateResumeLayout('user-1', 'version-1', { sectionOrder: ['skills', 'not-a-real-section', 'employment'] }, client)
    expect(updateMock).toHaveBeenCalledWith({ section_order: ['skills', 'employment'] })
  })

  it('is a no-op (no write, no error) when neither sectionOrder nor templateKey is provided', async () => {
    const { client, updateMock } = makeFakeClient()
    const result = await updateResumeLayout('user-1', 'version-1', {}, client)
    expect(result.error).toBeNull()
    expect(updateMock).not.toHaveBeenCalled()
  })

  it('surfaces a database error from the update call', async () => {
    const { client } = makeFakeClient({ updateError: { message: 'write failed' } })
    const result = await updateResumeLayout('user-1', 'version-1', { templateKey: 'minimal' }, client)
    expect(result.error).toBe('write failed')
  })
})
