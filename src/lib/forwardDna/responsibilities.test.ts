// src/lib/forwardDna/responsibilities.test.ts
import { describe, it, expect, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getAllResponsibilitiesForUser, addResponsibility, removeResponsibility } from './responsibilities'

function makeFakeClient(opts: { rows?: unknown[]; error?: string } = {}) {
  const selectEq = vi.fn().mockResolvedValue({ data: opts.rows ?? [], error: opts.error ? { message: opts.error } : null })
  const selectMock = vi.fn().mockReturnValue({ eq: selectEq })
  const insertMock = vi.fn().mockResolvedValue({ error: opts.error ? { message: opts.error } : null })
  const deleteEq = vi.fn().mockResolvedValue({ error: opts.error ? { message: opts.error } : null })
  const deleteMock = vi.fn().mockReturnValue({ eq: deleteEq })
  const fromMock = vi.fn().mockReturnValue({ select: selectMock, insert: insertMock, delete: deleteMock })
  return { client: { from: fromMock } as unknown as SupabaseClient, selectEq, insertMock, deleteEq, deleteMock, fromMock }
}

describe('getAllResponsibilitiesForUser', () => {
  it('returns rows for the given user', async () => {
    const rows = [{ id: 'r1', tag: 'Managed budget' }]
    const { client } = makeFakeClient({ rows })
    const { responsibilities, error } = await getAllResponsibilitiesForUser('u1', client)
    expect(error).toBeNull()
    expect(responsibilities).toEqual(rows)
  })
})

describe('addResponsibility', () => {
  it('inserts a new tag', async () => {
    const { client, insertMock } = makeFakeClient()
    const { error } = await addResponsibility('u1', 'e1', 'Managed budget', null, client)
    expect(error).toBeNull()
    expect(insertMock).toHaveBeenCalledWith({ user_id: 'u1', employment_entry_id: 'e1', tag: 'Managed budget', category: null })
  })
})

describe('removeResponsibility', () => {
  it('deletes by id', async () => {
    const { client, deleteEq, deleteMock } = makeFakeClient()
    const { error } = await removeResponsibility('r1', client)
    expect(error).toBeNull()
    expect(deleteMock).toHaveBeenCalled()
    expect(deleteEq).toHaveBeenCalledWith('id', 'r1')
  })
})
