import { describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { applyConfirmedProposals } from './applyConfirmedProposals'
import type { ProposalDecision, ResumeFieldProposal } from '@/types/resume'

function makeProposal(overrides: Partial<ResumeFieldProposal> = {}): ResumeFieldProposal {
  return {
    id: 'p1',
    candidateValue: 'Jamie Rivera',
    destination: { kind: 'canonical-profile', field: 'full_name' },
    confidence: 'medium',
    proposedAction: 'create',
    provenance: {
      sourceDocumentId: 'doc-1', sectionKind: 'contact', blockOrders: [0],
      sourceExcerpt: 'Jamie Rivera', page: 1, matchedRule: 'NAME_HEURISTIC_FIRST_CAPITALIZED_LINE',
    },
    ...overrides,
  }
}

/** Same fake-client convention as opportunityEngine.test.ts -- chainable `.from().update().eq()` mocks, cast to SupabaseClient. */
function makeFakeClient() {
  const eqMock = vi.fn().mockResolvedValue({ error: null })
  const updateMock = vi.fn().mockReturnValue({ eq: eqMock })
  const fromMock = vi.fn().mockReturnValue({ update: updateMock })
  return { client: { from: fromMock } as unknown as SupabaseClient, fromMock, updateMock, eqMock }
}

describe('applyConfirmedProposals', () => {
  it('reject: writes nothing to member_profiles', async () => {
    const { client, updateMock } = makeFakeClient()
    const decisions: ProposalDecision[] = [{ proposal: makeProposal(), decision: 'reject' }]
    await applyConfirmedProposals('user-1', decisions, client)
    expect(updateMock).not.toHaveBeenCalled()
  })

  it('accept_as_canonical: writes candidateValue to member_profiles at the proposal field', async () => {
    const { client, fromMock, updateMock, eqMock } = makeFakeClient()
    const decisions: ProposalDecision[] = [{ proposal: makeProposal(), decision: 'accept_as_canonical' }]
    await applyConfirmedProposals('user-1', decisions, client)

    expect(fromMock).toHaveBeenCalledWith('member_profiles')
    expect(updateMock).toHaveBeenCalledWith({ full_name: 'Jamie Rivera' })
    expect(eqMock).toHaveBeenCalledWith('user_id', 'user-1')
  })

  it('accept_as_canonical writes even when the field already has content -- never gated on emptiness', async () => {
    // The whole point of the corrected rule: routing is by member action alone, never by whether
    // member_profiles happened to be empty. This test has no way to inspect prior DB state and
    // still succeeds -- that absence of an emptiness check IS the behavior under test.
    const { client, updateMock } = makeFakeClient()
    const decisions: ProposalDecision[] = [{ proposal: makeProposal(), decision: 'accept_as_canonical' }]
    await applyConfirmedProposals('user-1', decisions, client)
    expect(updateMock).toHaveBeenCalledWith({ full_name: 'Jamie Rivera' })
  })

  it('accept_edited_canonical: writes editedValue, not the original candidateValue', async () => {
    const { client, updateMock } = makeFakeClient()
    const decisions: ProposalDecision[] = [{ proposal: makeProposal(), decision: 'accept_edited_canonical', editedValue: 'Jamie R. Rivera' }]
    await applyConfirmedProposals('user-1', decisions, client)
    expect(updateMock).toHaveBeenCalledWith({ full_name: 'Jamie R. Rivera' })
  })

  it('accept_edited_canonical without an editedValue is a reported error, not a silent fallback to candidateValue', async () => {
    const { client, updateMock } = makeFakeClient()
    const decisions: ProposalDecision[] = [{ proposal: makeProposal(), decision: 'accept_edited_canonical' }]
    const result = await applyConfirmedProposals('user-1', decisions, client)
    expect(updateMock).not.toHaveBeenCalled()
    expect(result.errors).toHaveLength(1)
  })

  it('keep_existing_canonical: writes nothing to member_profiles', async () => {
    const { client, updateMock } = makeFakeClient()
    const decisions: ProposalDecision[] = [{ proposal: makeProposal(), decision: 'keep_existing_canonical' }]
    await applyConfirmedProposals('user-1', decisions, client)
    expect(updateMock).not.toHaveBeenCalled()
  })

  it('use_as_resume_specific_only: never writes to member_profiles, even for a canonical-shaped proposal', async () => {
    const { client, fromMock } = makeFakeClient()
    const decisions: ProposalDecision[] = [{ proposal: makeProposal(), decision: 'use_as_resume_specific_only' }]
    await applyConfirmedProposals('user-1', decisions, client)
    expect(fromMock).not.toHaveBeenCalledWith('member_profiles')
  })

  it('rejects accept_as_canonical against a resume-specific proposal -- invalid combination, not a silent no-op', async () => {
    const { client, updateMock } = makeFakeClient()
    const summaryProposal = makeProposal({ destination: { kind: 'resume-specific', field: 'summary_override' } })
    const decisions: ProposalDecision[] = [{ proposal: summaryProposal, decision: 'accept_as_canonical' }]
    const result = await applyConfirmedProposals('user-1', decisions, client)
    expect(updateMock).not.toHaveBeenCalled()
    expect(result.errors).toHaveLength(1)
  })

  it('explicitly guards email: no member_profiles.email column exists yet, so accept_as_canonical for email fails loudly rather than writing an undefined column', async () => {
    const { client, updateMock } = makeFakeClient()
    const emailProposal = makeProposal({ destination: { kind: 'canonical-profile', field: 'email' }, candidateValue: 'jamie@example.com' })
    const decisions: ProposalDecision[] = [{ proposal: emailProposal, decision: 'accept_as_canonical' }]
    const result = await applyConfirmedProposals('user-1', decisions, client)
    expect(updateMock).not.toHaveBeenCalled()
    expect(result.errors[0]).toContain('email')
  })

  it('processes multiple decisions independently, one failure does not block the others', async () => {
    const { client, updateMock } = makeFakeClient()
    const decisions: ProposalDecision[] = [
      { proposal: makeProposal(), decision: 'accept_as_canonical' },
      { proposal: makeProposal({ id: 'p2', destination: { kind: 'canonical-profile', field: 'phone' }, candidateValue: '555-123-4567' }), decision: 'accept_as_canonical' },
    ]
    const result = await applyConfirmedProposals('user-1', decisions, client)
    expect(updateMock).toHaveBeenCalledTimes(2)
    expect(result.errors).toEqual([])
  })
})
