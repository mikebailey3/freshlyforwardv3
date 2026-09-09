import { describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { applyCanonicalArrayWrite } from './applyCanonicalArrayWrite'
import type { ResumeFieldProposal } from '@/types/resume'

function makeProposal(overrides: Partial<ResumeFieldProposal> = {}): ResumeFieldProposal {
  return {
    id: 'p1',
    candidateValue: 'Senior Engineer\nAcme Corp\nLed a team of 5.',
    destination: { kind: 'canonical-profile-array', field: 'employment_history', index: 'append' },
    confidence: 'medium',
    proposedAction: 'create',
    provenance: {
      sourceDocumentId: 'doc-1', sectionKind: 'employment', blockOrders: [0],
      sourceExcerpt: 'Senior Engineer', page: 1, matchedRule: 'EMPLOYMENT_HEADER_DESCRIPTION_SPLIT',
    },
    ...overrides,
  }
}

/** Chainable fake client: from().select().eq().maybeSingle() for reads, from().update().eq() for writes. */
function makeFakeClient(profile: Record<string, unknown>) {
  const maybeSingleMock = vi.fn().mockResolvedValue({ data: profile, error: null })
  const selectEqMock = vi.fn().mockReturnValue({ maybeSingle: maybeSingleMock })
  const selectMock = vi.fn().mockReturnValue({ eq: selectEqMock })

  const updateEqMock = vi.fn().mockResolvedValue({ error: null })
  const updateMock = vi.fn().mockReturnValue({ eq: updateEqMock })

  const fromMock = vi.fn().mockReturnValue({ select: selectMock, update: updateMock })
  return { client: { from: fromMock } as unknown as SupabaseClient, fromMock, selectMock, updateMock, updateEqMock }
}

const emptyProfile = { employment_history: [], education: [], certifications: [], skills: [] }

describe('applyCanonicalArrayWrite', () => {
  it('create employment: appends a new entry with a generated id, preserving raw text in description, leaving structured fields blank rather than guessing', async () => {
    const { client, updateMock } = makeFakeClient(emptyProfile)
    const error = await applyCanonicalArrayWrite('user-1', makeProposal(), 'accept_as_canonical', undefined, client)
    expect(error).toBeNull()
    expect(updateMock).toHaveBeenCalledTimes(1)
    const [payload] = updateMock.mock.calls[0] as [{ employment_history: { id: string; description: string; company: string; title: string }[] }]
    expect(payload.employment_history).toHaveLength(1)
    expect(payload.employment_history[0].description).toBe('Senior Engineer\nAcme Corp\nLed a team of 5.')
    expect(payload.employment_history[0].company).toBe('')
    expect(typeof payload.employment_history[0].id).toBe('string')
    expect(payload.employment_history[0].id.length).toBeGreaterThan(0)
  })

  it('create with accept_edited_canonical writes the edited value, not the raw candidateValue', async () => {
    const { client, updateMock } = makeFakeClient(emptyProfile)
    await applyCanonicalArrayWrite('user-1', makeProposal(), 'accept_edited_canonical', 'Edited text', client)
    const [payload] = updateMock.mock.calls[0] as [{ employment_history: { description: string }[] }]
    expect(payload.employment_history[0].description).toBe('Edited text')
  })

  it('accept_edited_canonical without an editedValue is a reported error, no write', async () => {
    const { client, updateMock } = makeFakeClient(emptyProfile)
    const error = await applyCanonicalArrayWrite('user-1', makeProposal(), 'accept_edited_canonical', undefined, client)
    expect(error).toContain('editedValue')
    expect(updateMock).not.toHaveBeenCalled()
  })

  it('create certification: lands raw text in name, leaves issuer/date/expiry null', async () => {
    const { client, updateMock } = makeFakeClient(emptyProfile)
    const proposal = makeProposal({
      candidateValue: 'AWS Certified Solutions Architect - Amazon - 2020',
      destination: { kind: 'canonical-profile-array', field: 'certifications', index: 'append' },
    })
    await applyCanonicalArrayWrite('user-1', proposal, 'accept_as_canonical', undefined, client)
    const [payload] = updateMock.mock.calls[0] as [{ certifications: { name: string; issuer: string; date: null; expiry: null }[] }]
    expect(payload.certifications[0]).toMatchObject({ name: 'AWS Certified Solutions Architect - Amazon - 2020', issuer: '', date: null, expiry: null })
  })

  it('create education: lands raw text in degree, leaves institution/field blank', async () => {
    const { client, updateMock } = makeFakeClient(emptyProfile)
    const proposal = makeProposal({
      candidateValue: 'State University\nB.S. Computer Science, 2019',
      destination: { kind: 'canonical-profile-array', field: 'education', index: 'append' },
    })
    await applyCanonicalArrayWrite('user-1', proposal, 'accept_as_canonical', undefined, client)
    const [payload] = updateMock.mock.calls[0] as [{ education: { degree: string; institution: string }[] }]
    expect(payload.education[0]).toMatchObject({ degree: 'State University\nB.S. Computer Science, 2019', institution: '' })
  })

  it('create skill: appends the literal value', async () => {
    const { client, updateMock } = makeFakeClient(emptyProfile)
    const proposal = makeProposal({
      candidateValue: 'TypeScript',
      destination: { kind: 'canonical-profile-array', field: 'skills', index: 'append' },
    })
    await applyCanonicalArrayWrite('user-1', proposal, 'accept_as_canonical', undefined, client)
    const [payload] = updateMock.mock.calls[0] as [{ skills: string[] }]
    expect(payload.skills).toEqual(['TypeScript'])
  })

  it('create skill: does not duplicate a skill already present -- no-op, no write', async () => {
    const { client, updateMock } = makeFakeClient({ ...emptyProfile, skills: ['TypeScript'] })
    const proposal = makeProposal({
      candidateValue: 'TypeScript',
      destination: { kind: 'canonical-profile-array', field: 'skills', index: 'append' },
    })
    const error = await applyCanonicalArrayWrite('user-1', proposal, 'accept_as_canonical', undefined, client)
    expect(error).toBeNull()
    expect(updateMock).not.toHaveBeenCalled()
  })

  it('update employment at an existing index: preserves id/company/title, only refreshes description', async () => {
    const profile = {
      ...emptyProfile,
      employment_history: [{ id: 'entry-emp-1', company: 'Initech', title: 'PM', start_date: '2020-01', end_date: null, current: true, description: 'Old text.' }],
    }
    const { client, updateMock } = makeFakeClient(profile)
    const proposal = makeProposal({
      candidateValue: 'Updated description with new metrics.',
      destination: { kind: 'canonical-profile-array', field: 'employment_history', index: 0 },
      proposedAction: 'update',
    })
    await applyCanonicalArrayWrite('user-1', proposal, 'accept_as_canonical', undefined, client)
    const [payload] = updateMock.mock.calls[0] as [{ employment_history: Record<string, unknown>[] }]
    expect(payload.employment_history[0]).toMatchObject({ id: 'entry-emp-1', company: 'Initech', title: 'PM', description: 'Updated description with new metrics.' })
  })

  it('update at an out-of-bounds index reports an error and writes nothing', async () => {
    const { client, updateMock } = makeFakeClient(emptyProfile)
    const proposal = makeProposal({ destination: { kind: 'canonical-profile-array', field: 'employment_history', index: 5 }, proposedAction: 'update' })
    const error = await applyCanonicalArrayWrite('user-1', proposal, 'accept_as_canonical', undefined, client)
    expect(error).toContain('does not exist')
    expect(updateMock).not.toHaveBeenCalled()
  })

  it('no-op-already-present: never writes, never errors', async () => {
    const { client, updateMock } = makeFakeClient(emptyProfile)
    const proposal = makeProposal({ proposedAction: 'no-op-already-present' })
    const error = await applyCanonicalArrayWrite('user-1', proposal, 'accept_as_canonical', undefined, client)
    expect(error).toBeNull()
    expect(updateMock).not.toHaveBeenCalled()
  })

  it('reports an error and writes nothing when member_profiles cannot be loaded', async () => {
    const client = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ maybeSingle: vi.fn().mockResolvedValue({ data: null, error: { message: 'not found' } }) }) }),
      }),
    } as unknown as SupabaseClient
    const error = await applyCanonicalArrayWrite('user-1', makeProposal(), 'accept_as_canonical', undefined, client)
    expect(error).toContain('Failed to load')
  })
})
