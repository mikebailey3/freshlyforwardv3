import { describe, it, expect, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { ensureEmploymentEntryIds, ensureEmploymentEntryIdsForUser } from './employmentEntryIds'
import type { EmploymentEntry } from '@/types'

function makeFakeClient(updateError: string | null = null) {
  const eqMock = vi.fn().mockResolvedValue({ error: updateError ? { message: updateError } : null })
  const updateMock = vi.fn().mockReturnValue({ eq: eqMock })
  const fromMock = vi.fn().mockReturnValue({ update: updateMock })
  return { client: { from: fromMock } as unknown as SupabaseClient, updateMock, eqMock, fromMock }
}

describe('ensureEmploymentEntryIds', () => {
  it('assigns an id to entries missing one and reports changed=true', () => {
    const entries: EmploymentEntry[] = [
      { company: 'Acme', title: 'Manager', start_date: '2020-01', end_date: null, current: true, description: '' },
    ]
    const { entries: result, changed } = ensureEmploymentEntryIds(entries)
    expect(changed).toBe(true)
    expect(result[0].id).toBeTruthy()
  })

  it('preserves existing ids and reports changed=false when nothing is missing', () => {
    const entries: EmploymentEntry[] = [
      { id: 'entry-123', company: 'Acme', title: 'Manager', start_date: '2020-01', end_date: null, current: true, description: '' },
    ]
    const { entries: result, changed } = ensureEmploymentEntryIds(entries)
    expect(changed).toBe(false)
    expect(result[0].id).toBe('entry-123')
  })
})

describe('ensureEmploymentEntryIdsForUser', () => {
  it('does not call update when no ids were missing', async () => {
    const { client, fromMock } = makeFakeClient()
    const entries: EmploymentEntry[] = [
      { id: 'entry-1', company: 'Acme', title: 'Manager', start_date: '2020-01', end_date: null, current: true, description: '' },
    ]
    await ensureEmploymentEntryIdsForUser('user-1', entries, client)
    expect(fromMock).not.toHaveBeenCalled()
  })

  it('persists backfilled entries when ids were missing', async () => {
    const { client, fromMock, updateMock, eqMock } = makeFakeClient()
    const entries: EmploymentEntry[] = [
      { company: 'Acme', title: 'Manager', start_date: '2020-01', end_date: null, current: true, description: '' },
    ]
    const { entries: result, error } = await ensureEmploymentEntryIdsForUser('user-1', entries, client)
    expect(error).toBeNull()
    expect(result[0].id).toBeTruthy()
    expect(fromMock).toHaveBeenCalledWith('member_profiles')
    expect(updateMock).toHaveBeenCalledWith({ employment_history: result })
    expect(eqMock).toHaveBeenCalledWith('user_id', 'user-1')
  })
})
