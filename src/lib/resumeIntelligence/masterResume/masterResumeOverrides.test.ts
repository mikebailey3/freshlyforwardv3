import { describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { setMasterResumeSummaryOverride } from './masterResumeOverrides'

function makeFakeClient(master: { id: string } | null = { id: 'version-1' }) {
  const maybeSingleMock = vi.fn().mockResolvedValue({ data: master, error: null })
  const eqArchivedMock = vi.fn().mockReturnValue({ maybeSingle: maybeSingleMock })
  const eqMasterMock = vi.fn().mockReturnValue({ eq: eqArchivedMock })
  const eqMemberMock = vi.fn().mockReturnValue({ eq: eqMasterMock })
  const selectMock = vi.fn().mockReturnValue({ eq: eqMemberMock })

  const updateEqMock = vi.fn().mockResolvedValue({ error: null })
  const updateMock = vi.fn().mockReturnValue({ eq: updateEqMock })

  const fromMock = vi.fn().mockReturnValue({ select: selectMock, update: updateMock })
  return { client: { from: fromMock } as unknown as SupabaseClient, fromMock, updateMock, updateEqMock }
}

describe('setMasterResumeSummaryOverride', () => {
  it('writes resume-specific summary_override onto the member\'s active Master resume_versions row, not member_profiles', async () => {
    const { client, fromMock, updateMock, updateEqMock } = makeFakeClient()
    const result = await setMasterResumeSummaryOverride('user-1', 'A punchier summary for this version only.', client)
    expect(result.error).toBeNull()
    expect(fromMock).toHaveBeenCalledWith('resume_versions')
    expect(updateMock).toHaveBeenCalledWith({ summary_override: 'A punchier summary for this version only.' })
    expect(updateEqMock).toHaveBeenCalledWith('id', 'version-1')
  })

  it('clearing the override (null) is a valid, distinct write -- reverts to the canonical summary', async () => {
    const { client, updateMock } = makeFakeClient()
    await setMasterResumeSummaryOverride('user-1', null, client)
    expect(updateMock).toHaveBeenCalledWith({ summary_override: null })
  })

  it('reports an error rather than writing anywhere when no active Master Resume exists', async () => {
    const { client, updateMock } = makeFakeClient(null)
    const result = await setMasterResumeSummaryOverride('user-1', 'text', client)
    expect(result.error).toContain('No active Master Resume')
    expect(updateMock).not.toHaveBeenCalled()
  })
})
