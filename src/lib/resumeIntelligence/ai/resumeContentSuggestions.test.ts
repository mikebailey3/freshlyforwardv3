import { describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createResumeContentSuggestion, decideResumeContentSuggestion } from './resumeContentSuggestions'
import type { ResumeAIContentProvider, ResumeAISuggestionResult } from './resumeAIProvider'
import { NullResumeAIContentProvider } from './resumeAIProvider'

function fakeProvider(result: ResumeAISuggestionResult): ResumeAIContentProvider {
  return { suggest: () => Promise.resolve(result) }
}

function makeInsertClient(insertResult: { id: string } | null = { id: 'sugg-1' }, error: { message: string } | null = null) {
  const singleMock = vi.fn().mockResolvedValue({ data: insertResult, error })
  const selectMock = vi.fn().mockReturnValue({ single: singleMock })
  const insertMock = vi.fn().mockReturnValue({ select: selectMock })
  const fromMock = vi.fn().mockReturnValue({ insert: insertMock })
  return { client: { from: fromMock } as unknown as SupabaseClient, insertMock }
}

const baseInput = {
  userId: 'user-1',
  resumeVersionId: 'v-1',
  targetField: 'summary',
  currentText: 'Old summary.',
  availableEvidence: ['Led a team of 5 engineers to ship the new checkout flow.'],
}

describe('createResumeContentSuggestion', () => {
  it('skips (no error) when the provider has nothing available -- e.g. the Null provider', async () => {
    const { client, insertMock } = makeInsertClient()
    const result = await createResumeContentSuggestion(baseInput, new NullResumeAIContentProvider(), false, client)
    expect(result.skipped).toBe(true)
    expect(result.error).toBeNull()
    expect(insertMock).not.toHaveBeenCalled()
  })

  it('persists a grounded proposal as a pending suggestion', async () => {
    const provider = fakeProvider({ available: true, proposedText: 'Led a team of 5 engineers to ship checkout.', evidenceReference: 'Led a team of 5 engineers' })
    const { client, insertMock } = makeInsertClient()
    const result = await createResumeContentSuggestion(baseInput, provider, false, client)
    expect(result.error).toBeNull()
    expect(result.suggestionId).toBe('sugg-1')
    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: 'user-1', resume_version_id: 'v-1', proposed_text: 'Led a team of 5 engineers to ship checkout.', evidence_reference: 'Led a team of 5 engineers' }),
    )
  })

  it('refuses to persist a proposal that fails the grounding check -- never writes an ungrounded suggestion', async () => {
    const provider = fakeProvider({ available: true, proposedText: 'Led a team of 500 engineers.', evidenceReference: 'Led a team of 500 engineers' })
    const { client, insertMock } = makeInsertClient()
    const result = await createResumeContentSuggestion(baseInput, provider, false, client)
    expect(result.skipped).toBe(true)
    expect(result.error).toContain('literal substring')
    expect(insertMock).not.toHaveBeenCalled()
  })

  it('surfaces a database error without pretending the suggestion was skipped', async () => {
    const provider = fakeProvider({ available: true, proposedText: 'Led a team of 5 engineers to ship checkout.', evidenceReference: 'Led a team of 5 engineers' })
    const { client } = makeInsertClient(null, { message: 'insert failed' })
    const result = await createResumeContentSuggestion(baseInput, provider, false, client)
    expect(result.skipped).toBe(false)
    expect(result.error).toBe('insert failed')
  })
})

function makeDecideClient(existing: { id: string; status: string } | null, updateError: { message: string } | null = null) {
  const maybeSingleMock = vi.fn().mockResolvedValue({ data: existing, error: null })
  const eqUserMock = vi.fn().mockReturnValue({ maybeSingle: maybeSingleMock })
  const eqIdMock = vi.fn().mockReturnValue({ eq: eqUserMock })
  const selectMock = vi.fn().mockReturnValue({ eq: eqIdMock })

  const updateEqMock = vi.fn().mockResolvedValue({ error: updateError })
  const updateMock = vi.fn().mockReturnValue({ eq: updateEqMock })

  const fromMock = vi.fn().mockReturnValue({ select: selectMock, update: updateMock })
  return { client: { from: fromMock } as unknown as SupabaseClient, updateMock }
}

describe('decideResumeContentSuggestion', () => {
  it('refuses to decide a suggestion that does not belong to this member', async () => {
    const { client, updateMock } = makeDecideClient(null)
    const result = await decideResumeContentSuggestion('user-1', 'sugg-1', 'reject', undefined, client)
    expect(result.error).toContain('not found')
    expect(updateMock).not.toHaveBeenCalled()
  })

  it('refuses to re-decide an already-reviewed suggestion', async () => {
    const { client, updateMock } = makeDecideClient({ id: 'sugg-1', status: 'reviewed' })
    const result = await decideResumeContentSuggestion('user-1', 'sugg-1', 'reject', undefined, client)
    expect(result.error).toContain('already been reviewed')
    expect(updateMock).not.toHaveBeenCalled()
  })

  it('records an explicit accept decision, moving status to reviewed', async () => {
    const { client, updateMock } = makeDecideClient({ id: 'sugg-1', status: 'pending' })
    const result = await decideResumeContentSuggestion('user-1', 'sugg-1', 'accept_as_canonical', undefined, client)
    expect(result.error).toBeNull()
    expect(updateMock).toHaveBeenCalledWith(expect.objectContaining({ status: 'reviewed', decision: 'accept_as_canonical' }))
  })

  it('records an edited value alongside an accept_edited_canonical decision', async () => {
    const { client, updateMock } = makeDecideClient({ id: 'sugg-1', status: 'pending' })
    await decideResumeContentSuggestion('user-1', 'sugg-1', 'accept_edited_canonical', 'My edited text', client)
    expect(updateMock).toHaveBeenCalledWith(expect.objectContaining({ decision_edited_value: 'My edited text' }))
  })
})
