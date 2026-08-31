// src/lib/forwardDna/skills.test.ts
import { describe, it, expect, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getSkillStates, upsertSkillState, syncSkillsFromProfile } from './skills'

function makeFakeClient(opts: { existingSkills?: { skill_name: string }[]; error?: string } = {}) {
  const selectEq = vi.fn().mockResolvedValue({
    data: opts.existingSkills ?? [],
    error: opts.error ? { message: opts.error } : null,
  })
  const selectMock = vi.fn().mockReturnValue({ eq: selectEq })
  const upsertMock = vi.fn().mockResolvedValue({ error: opts.error ? { message: opts.error } : null })
  const fromMock = vi.fn().mockReturnValue({ select: selectMock, upsert: upsertMock })
  return { client: { from: fromMock } as unknown as SupabaseClient, selectEq, upsertMock, fromMock }
}

describe('getSkillStates', () => {
  it('returns rows for the given user', async () => {
    const { client } = makeFakeClient({ existingSkills: [{ skill_name: 'excel' }] })
    const { skills, error } = await getSkillStates('u1', client)
    expect(error).toBeNull()
    expect(skills).toEqual([{ skill_name: 'excel' }])
  })
})

describe('upsertSkillState', () => {
  it('upserts with the correct conflict target', async () => {
    const { client, upsertMock } = makeFakeClient()
    const { error } = await upsertSkillState('u1', 'excel', 'demonstrated', 'built quarterly reports', client)
    expect(error).toBeNull()
    expect(upsertMock).toHaveBeenCalledWith(
      { user_id: 'u1', skill_name: 'excel', state: 'demonstrated', evidence_note: 'built quarterly reports' },
      { onConflict: 'user_id,skill_name' }
    )
  })
})

describe('syncSkillsFromProfile', () => {
  it('inserts only skills missing from career_skills, as claimed', async () => {
    const { client, upsertMock } = makeFakeClient({ existingSkills: [{ skill_name: 'excel' }] })
    const { error } = await syncSkillsFromProfile('u1', ['excel', 'leadership'], client)
    expect(error).toBeNull()
    expect(upsertMock).toHaveBeenCalledWith(
      [{ user_id: 'u1', skill_name: 'leadership', state: 'claimed' }],
      { onConflict: 'user_id,skill_name', ignoreDuplicates: true }
    )
  })

  it('does nothing when every flat skill is already tracked', async () => {
    const { client, upsertMock } = makeFakeClient({ existingSkills: [{ skill_name: 'excel' }] })
    await syncSkillsFromProfile('u1', ['excel'], client)
    expect(upsertMock).not.toHaveBeenCalled()
  })

  it('does nothing when the flat skill list is empty', async () => {
    const { client, upsertMock } = makeFakeClient()
    await syncSkillsFromProfile('u1', [], client)
    expect(upsertMock).not.toHaveBeenCalled()
  })
})
