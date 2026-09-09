import { describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { listResumeVersions } from './listResumeVersions'

function makeFakeClient(rows: Record<string, unknown>[] = []) {
  const orderMock = vi.fn().mockResolvedValue({ data: rows, error: null })
  const eqArchivedMock = vi.fn().mockReturnValue({ order: orderMock })
  const eqMemberMock = vi.fn().mockReturnValue({ eq: eqArchivedMock })
  const selectMock = vi.fn().mockReturnValue({ eq: eqMemberMock })
  const fromMock = vi.fn().mockReturnValue({ select: selectMock })
  return { client: { from: fromMock } as unknown as SupabaseClient, fromMock, eqMemberMock, eqArchivedMock, orderMock }
}

describe('listResumeVersions', () => {
  it('lists non-archived versions for the member, Master first', async () => {
    const { client } = makeFakeClient([
      { id: 'v1', title: 'Master Resume', is_master: true, is_archived: false, target_opportunity_id: null, created_at: '2026-01-01' },
      { id: 'v2', title: 'Tailored for Acme', is_master: false, is_archived: false, target_opportunity_id: 'opp-1', created_at: '2026-01-02' },
    ])
    const result = await listResumeVersions('user-1', client)
    expect(result).toHaveLength(2)
    expect(result[0].isMaster).toBe(true)
    expect(result[1].targetOpportunityId).toBe('opp-1')
  })

  it('excludes archived versions via the query filter', async () => {
    const { client, eqArchivedMock } = makeFakeClient([])
    await listResumeVersions('user-1', client)
    expect(eqArchivedMock).toHaveBeenCalledWith('is_archived', false)
  })
})
