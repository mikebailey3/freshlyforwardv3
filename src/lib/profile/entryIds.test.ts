import { describe, it, expect, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  ensureEntryIds,
  ensureEntryIdsForUser,
  ensureEducationEntryIds,
  ensureEducationEntryIdsForUser,
  ensureCertificationEntryIds,
  ensureCertificationEntryIdsForUser,
} from './entryIds'
import type { EducationEntry, CertificationEntry } from '@/types'

/** A required field keeps this a non-weak type for TS's object-literal checks -- the generic core is domain-agnostic, this is just a minimal stand-in for "some entry shape with an optional id". */
interface TestEntry {
  id?: string
  name: string
}

function makeFakeClient(updateError: string | null = null) {
  const eqMock = vi.fn().mockResolvedValue({ error: updateError ? { message: updateError } : null })
  const updateMock = vi.fn().mockReturnValue({ eq: eqMock })
  const fromMock = vi.fn().mockReturnValue({ update: updateMock })
  return { client: { from: fromMock } as unknown as SupabaseClient, updateMock, eqMock, fromMock }
}

/**
 * Domain-neutral core, shared by employment (via the preserved
 * src/lib/forwardDna/employmentEntryIds.ts API), education, and
 * certifications -- one implementation, not three copies.
 */
describe('ensureEntryIds (generic core)', () => {
  it('assigns an id to entries missing one and reports changed=true', () => {
    const entries: TestEntry[] = [{ name: 'unlabeled' }]
    const { entries: result, changed } = ensureEntryIds(entries)
    expect(changed).toBe(true)
    expect(result[0].id).toBeTruthy()
  })

  it('preserves an existing id exactly -- never regenerates or changes it', () => {
    const entries = [{ id: 'entry-existing-123', name: 'labeled' }]
    const { entries: result, changed } = ensureEntryIds(entries)
    expect(changed).toBe(false)
    expect(result[0].id).toBe('entry-existing-123')
  })

  it('in a mixed list, only the entry missing an id is touched', () => {
    const entries = [{ id: 'keep-me', name: 'a' }, { name: 'b' }]
    const { entries: result, changed } = ensureEntryIds(entries)
    expect(changed).toBe(true)
    expect(result[0].id).toBe('keep-me')
    expect(result[1].id).toBeTruthy()
    expect(result[1].id).not.toBe('keep-me')
  })

  it('is idempotent -- a second run over its own output makes no further changes', () => {
    const first = ensureEntryIds([{ name: 'a' }, { id: 'kept', name: 'b' }])
    const second = ensureEntryIds(first.entries)
    expect(second.changed).toBe(false)
    expect(second.entries).toEqual(first.entries)
  })

  it('returns an empty array unchanged for an empty list', () => {
    const { entries: result, changed } = ensureEntryIds([])
    expect(changed).toBe(false)
    expect(result).toEqual([])
  })
})

describe('ensureEntryIdsForUser (generic persistence)', () => {
  it('does not call update when no ids were missing', async () => {
    const { client, fromMock } = makeFakeClient()
    await ensureEntryIdsForUser('user-1', 'education', [{ id: 'e1', name: 'x' }], client)
    expect(fromMock).not.toHaveBeenCalled()
  })

  it('persists the backfilled array under the given profile column', async () => {
    const { client, fromMock, updateMock, eqMock } = makeFakeClient()
    const { entries: result, error } = await ensureEntryIdsForUser<TestEntry>('user-1', 'education', [{ name: 'x' }], client)
    expect(error).toBeNull()
    expect(result[0].id).toBeTruthy()
    expect(fromMock).toHaveBeenCalledWith('member_profiles')
    expect(updateMock).toHaveBeenCalledWith({ education: result })
    expect(eqMock).toHaveBeenCalledWith('user_id', 'user-1')
  })

  it('surfaces a persistence error rather than throwing', async () => {
    const { client } = makeFakeClient('write failed')
    const { error } = await ensureEntryIdsForUser<TestEntry>('user-1', 'education', [{ name: 'x' }], client)
    expect(error).toBe('write failed')
  })
})

describe('ensureEducationEntryIds / ensureEducationEntryIdsForUser', () => {
  it('assigns missing ids and writes to the education column', async () => {
    const entries: EducationEntry[] = [{ institution: 'MIT', degree: 'BS', field: 'CS', graduation_year: '2010' }]
    const pure = ensureEducationEntryIds(entries)
    expect(pure.changed).toBe(true)
    expect(pure.entries[0].id).toBeTruthy()

    const { client, updateMock } = makeFakeClient()
    const { entries: persisted } = await ensureEducationEntryIdsForUser('user-1', entries, client)
    expect(updateMock).toHaveBeenCalledWith({ education: persisted })
  })

  it('preserves an existing education id', () => {
    const entries: EducationEntry[] = [{ id: 'entry-edu-1', institution: 'MIT', degree: 'BS', field: 'CS', graduation_year: '2010' }]
    const { entries: result, changed } = ensureEducationEntryIds(entries)
    expect(changed).toBe(false)
    expect(result[0].id).toBe('entry-edu-1')
  })
})

describe('ensureCertificationEntryIds / ensureCertificationEntryIdsForUser', () => {
  it('assigns missing ids and writes to the certifications column', async () => {
    const entries: CertificationEntry[] = [{ name: 'PMP', issuer: 'PMI', date: '2022', expiry: null }]
    const pure = ensureCertificationEntryIds(entries)
    expect(pure.changed).toBe(true)
    expect(pure.entries[0].id).toBeTruthy()

    const { client, updateMock } = makeFakeClient()
    const { entries: persisted } = await ensureCertificationEntryIdsForUser('user-1', entries, client)
    expect(updateMock).toHaveBeenCalledWith({ certifications: persisted })
  })

  it('preserves an existing certification id', () => {
    const entries: CertificationEntry[] = [{ id: 'entry-cert-1', name: 'PMP', issuer: 'PMI', date: '2022', expiry: null }]
    const { entries: result, changed } = ensureCertificationEntryIds(entries)
    expect(changed).toBe(false)
    expect(result[0].id).toBe('entry-cert-1')
  })
})
