import { describe, it, expect, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createCareerWin, getCareerWinsForUser, getCareerWinsWithCapabilities, deleteCareerWin } from './careerWins'

function makeFakeClient(opts: {
  insertResult?: { data: unknown; error?: string }
  winsRows?: unknown[]
  winsError?: string
  capsRows?: unknown[]
  capsError?: string
  deleteError?: string
} = {}) {
  const insertSelectMaybeSingle = vi.fn().mockResolvedValue({
    data: opts.insertResult?.data ?? null,
    error: opts.insertResult?.error ? { message: opts.insertResult.error } : null,
  })
  const insertSelect = vi.fn().mockReturnValue({ maybeSingle: insertSelectMaybeSingle })
  const insertMock = vi.fn().mockReturnValue({ select: insertSelect })

  const winsOrder = vi.fn().mockResolvedValue({
    data: opts.winsRows ?? [],
    error: opts.winsError ? { message: opts.winsError } : null,
  })
  const winsEq = vi.fn().mockReturnValue({ order: winsOrder })
  const winsSelect = vi.fn().mockReturnValue({ eq: winsEq })

  const capsEqStatus = vi.fn().mockResolvedValue({
    data: opts.capsRows ?? [],
    error: opts.capsError ? { message: opts.capsError } : null,
  })
  const capsIn = vi.fn().mockReturnValue({ eq: capsEqStatus })
  const capsSelect = vi.fn().mockReturnValue({ in: capsIn })

  const deleteEq = vi.fn().mockResolvedValue({ error: opts.deleteError ? { message: opts.deleteError } : null })
  const deleteMock = vi.fn().mockReturnValue({ eq: deleteEq })

  const fromMock = vi.fn().mockImplementation((table: string) => {
    if (table === 'career_wins') return { insert: insertMock, select: winsSelect, delete: deleteMock }
    if (table === 'career_win_capabilities') return { select: capsSelect }
    throw new Error(`unexpected table: ${table}`)
  })

  return {
    client: { from: fromMock } as unknown as SupabaseClient,
    insertMock, winsSelect, winsEq, winsOrder, capsSelect, capsIn, capsEqStatus, deleteMock, deleteEq,
  }
}

describe('createCareerWin', () => {
  it('persists original_statement unchanged and returns the created row', async () => {
    const row = { id: 'win-1', original_statement: 'Reduced inventory loss by $31,000.' }
    const { client, insertMock } = makeFakeClient({ insertResult: { data: row } })

    const { careerWin, error } = await createCareerWin(
      'u1',
      {
        originalStatement: 'Reduced inventory loss by $31,000.',
        employmentEntryId: null,
        evidenceType: 'accomplishment',
        category: 'Financial / Operational Impact',
        metricType: 'currency',
        metricValue: 31000,
        metricRaw: '$31,000',
      },
      client
    )

    expect(error).toBeNull()
    expect(careerWin).toEqual(row)
    expect(insertMock).toHaveBeenCalledWith({
      user_id: 'u1',
      employment_entry_id: null,
      original_statement: 'Reduced inventory loss by $31,000.',
      evidence_type: 'accomplishment',
      category: 'Financial / Operational Impact',
      metric_type: 'currency',
      metric_value: 31000,
      metric_raw: '$31,000',
    })
  })
})

describe('getCareerWinsForUser', () => {
  it('returns rows ordered newest-first for the given user', async () => {
    const rows = [{ id: 'win-1' }]
    const { client, winsEq } = makeFakeClient({ winsRows: rows })
    const { careerWins, error } = await getCareerWinsForUser('u1', client)
    expect(error).toBeNull()
    expect(careerWins).toEqual(rows)
    expect(winsEq).toHaveBeenCalledWith('user_id', 'u1')
  })
})

describe('getCareerWinsWithCapabilities', () => {
  it('attaches only confirmed capabilities to their matching win', async () => {
    const wins = [{ id: 'win-1' }, { id: 'win-2' }]
    const caps = [{ id: 'cap-1', career_win_id: 'win-1', status: 'confirmed' }]
    const { client } = makeFakeClient({ winsRows: wins, capsRows: caps })

    const { careerWins, error } = await getCareerWinsWithCapabilities('u1', client)
    expect(error).toBeNull()
    expect(careerWins[0].capabilities).toEqual([caps[0]])
    expect(careerWins[1].capabilities).toEqual([])
  })

  it('returns an empty array without querying capabilities when there are no wins', async () => {
    const { client, capsSelect } = makeFakeClient({ winsRows: [] })
    const { careerWins, error } = await getCareerWinsWithCapabilities('u1', client)
    expect(error).toBeNull()
    expect(careerWins).toEqual([])
    expect(capsSelect).not.toHaveBeenCalled()
  })

  it('fails closed (empty array, not partial data) when the wins query errors (fix round 1)', async () => {
    const { client } = makeFakeClient({ winsError: 'connection reset' })
    const { careerWins, error } = await getCareerWinsWithCapabilities('u1', client)
    expect(error).toBe('connection reset')
    expect(careerWins).toEqual([])
  })

  it('fails closed (empty array, not wins-with-empty-capabilities) when the capabilities query errors (fix round 1)', async () => {
    const { client } = makeFakeClient({ winsRows: [{ id: 'win-1' }], capsError: 'connection reset' })
    const { careerWins, error } = await getCareerWinsWithCapabilities('u1', client)
    expect(error).toBe('connection reset')
    expect(careerWins).toEqual([])
  })
})

describe('deleteCareerWin', () => {
  it('deletes by id', async () => {
    const { client, deleteEq } = makeFakeClient()
    const { error } = await deleteCareerWin('win-1', client)
    expect(error).toBeNull()
    expect(deleteEq).toHaveBeenCalledWith('id', 'win-1')
  })
})
