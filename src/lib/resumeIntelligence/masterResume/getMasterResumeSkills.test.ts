import { describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { extractResumeSkillValues, getMasterResumeSkills } from './getMasterResumeSkills'

describe('extractResumeSkillValues (pure)', () => {
  it('dedupes repeated skill values', () => {
    expect(extractResumeSkillValues([{ skill_value: 'SQL' }, { skill_value: 'SQL' }, { skill_value: 'Excel' }])).toEqual([
      'SQL',
      'Excel',
    ])
  })

  it('returns an empty array for null/undefined rows -- missing data, never a crash', () => {
    expect(extractResumeSkillValues(null)).toEqual([])
    expect(extractResumeSkillValues(undefined)).toEqual([])
  })

  it('filters out malformed rows with an empty/null skill_value', () => {
    expect(extractResumeSkillValues([{ skill_value: null }, { skill_value: 'SQL' }])).toEqual(['SQL'])
  })
})

function makeFakeClient(opts: { master?: { id: string } | null; entries?: { skill_value: string | null }[] }) {
  const masterMaybeSingle = vi.fn().mockResolvedValue({ data: opts.master ?? null, error: null })
  const masterEq3 = vi.fn().mockReturnValue({ maybeSingle: masterMaybeSingle })
  const masterEq2 = vi.fn().mockReturnValue({ eq: masterEq3 })
  const masterEq1 = vi.fn().mockReturnValue({ eq: masterEq2 })
  const masterSelect = vi.fn().mockReturnValue({ eq: masterEq1 })

  const entriesEq3 = vi.fn().mockResolvedValue({ data: opts.entries ?? [], error: null })
  const entriesEq2 = vi.fn().mockReturnValue({ eq: entriesEq3 })
  const entriesEq1 = vi.fn().mockReturnValue({ eq: entriesEq2 })
  const entriesSelect = vi.fn().mockReturnValue({ eq: entriesEq1 })

  const tablesTouched: string[] = []
  const fromMock = vi.fn((table: string) => {
    tablesTouched.push(table)
    if (table === 'resume_versions') return { select: masterSelect }
    if (table === 'resume_entries') return { select: entriesSelect }
    throw new Error(`Unexpected table: ${table}`)
  })

  return { client: { from: fromMock } as unknown as SupabaseClient, tablesTouched, masterEq2, entriesEq2, entriesEq3 }
}

describe('getMasterResumeSkills', () => {
  it('returns an empty array when the member has no active Master Resume', async () => {
    const { client } = makeFakeClient({ master: null })
    const result = await getMasterResumeSkills('user-1', client)
    expect(result).toEqual([])
  })

  it('never queries resume_entries when there is no Master Resume to look up', async () => {
    const { client, tablesTouched } = makeFakeClient({ master: null })
    await getMasterResumeSkills('user-1', client)
    expect(tablesTouched).toEqual(['resume_versions'])
  })

  it('returns the Master Resume\'s claimed skill values, deduped', async () => {
    const { client } = makeFakeClient({
      master: { id: 'version-1' },
      entries: [{ skill_value: 'SQL' }, { skill_value: 'SQL' }, { skill_value: 'Leadership' }],
    })
    const result = await getMasterResumeSkills('user-1', client)
    expect(result).toEqual(['SQL', 'Leadership'])
  })

  it('only looks up the active (non-archived) Master version', async () => {
    const { client, masterEq2 } = makeFakeClient({ master: { id: 'version-1' }, entries: [] })
    await getMasterResumeSkills('user-1', client)
    expect(masterEq2).toHaveBeenCalledWith('is_master', true)
  })

  it('only counts included skill entries', async () => {
    const { client, entriesEq2, entriesEq3 } = makeFakeClient({ master: { id: 'version-1' }, entries: [] })
    await getMasterResumeSkills('user-1', client)
    expect(entriesEq2).toHaveBeenCalledWith('entry_kind', 'skill')
    expect(entriesEq3).toHaveBeenCalledWith('included', true)
  })
})
