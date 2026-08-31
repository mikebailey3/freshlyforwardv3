// src/lib/forwardDna/scope.test.ts
import { describe, it, expect, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getAllScopeForUser, upsertScope, dollarsToCents, centsToDollars } from './scope'

function makeFakeClient(opts: { scopeRows?: unknown[]; selectError?: string; upsertError?: string } = {}) {
  const eqMock = vi.fn().mockResolvedValue({
    data: opts.scopeRows ?? [],
    error: opts.selectError ? { message: opts.selectError } : null,
  })
  const selectMock = vi.fn().mockReturnValue({ eq: eqMock })
  const upsertMock = vi.fn().mockResolvedValue({ error: opts.upsertError ? { message: opts.upsertError } : null })
  const fromMock = vi.fn().mockReturnValue({ select: selectMock, upsert: upsertMock })
  return { client: { from: fromMock } as unknown as SupabaseClient, selectMock, eqMock, upsertMock, fromMock }
}

describe('getAllScopeForUser', () => {
  it('returns rows for the given user', async () => {
    const rows = [{ id: 's1', user_id: 'u1', employment_entry_id: 'e1' }]
    const { client, eqMock } = makeFakeClient({ scopeRows: rows })
    const { scope, error } = await getAllScopeForUser('u1', client)
    expect(error).toBeNull()
    expect(scope).toEqual(rows)
    expect(eqMock).toHaveBeenCalledWith('user_id', 'u1')
  })

  it('surfaces a select error', async () => {
    const { client } = makeFakeClient({ selectError: 'boom' })
    const { error } = await getAllScopeForUser('u1', client)
    expect(error).toBe('boom')
  })
})

describe('upsertScope', () => {
  it('upserts with the correct conflict target', async () => {
    const { client, upsertMock } = makeFakeClient()
    const { error } = await upsertScope('u1', 'e1', { team_size: 5 }, client)
    expect(error).toBeNull()
    expect(upsertMock).toHaveBeenCalledWith(
      { user_id: 'u1', employment_entry_id: 'e1', team_size: 5 },
      { onConflict: 'user_id,employment_entry_id' }
    )
  })
})

describe('dollarsToCents / centsToDollars', () => {
  it('round-trips a dollar amount', () => {
    expect(dollarsToCents('1500.50')).toBe(150050)
    expect(centsToDollars(150050)).toBe('1500.5')
  })

  it('treats empty input as null', () => {
    expect(dollarsToCents('')).toBeNull()
    expect(centsToDollars(null)).toBe('')
  })
})
