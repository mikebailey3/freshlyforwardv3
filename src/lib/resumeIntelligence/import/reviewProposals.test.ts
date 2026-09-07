import { describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { fetchProposalsForReview, recordProposalDecision } from './reviewProposals'
import type { ProposalRow } from './reviewProposals'

function makeRow(overrides: Partial<ProposalRow> = {}): ProposalRow {
  return {
    id: 'row-1',
    source_document_id: 'doc-1',
    destination_kind: 'canonical-profile',
    destination_field: 'full_name',
    destination_array_index: null,
    candidate_value: 'Jamie Rivera',
    proposed_action: 'create',
    confidence: 'medium',
    provenance_section_kind: 'contact',
    provenance_block_orders: [0],
    provenance_source_excerpt: 'Jamie Rivera',
    provenance_page: 1,
    provenance_matched_rule: 'NAME_HEURISTIC_FIRST_CAPITALIZED_LINE',
    status: 'pending',
    decision: null,
    ...overrides,
  }
}

function makeFakeClient(opts: { fetchRows?: ProposalRow[]; profileUpdateError?: { message: string } | null; proposalUpdateError?: { message: string } | null } = {}) {
  const { fetchRows = [makeRow()], profileUpdateError = null, proposalUpdateError = null } = opts

  const orderMock = vi.fn().mockResolvedValue({ data: fetchRows, error: null })
  const isMock = vi.fn().mockReturnValue({ order: orderMock })
  const eqDocMock = vi.fn().mockReturnValue({ is: isMock })
  const eqUserMock = vi.fn().mockReturnValue({ eq: eqDocMock })
  const selectMock = vi.fn().mockReturnValue({ eq: eqUserMock })

  const profileEqMock = vi.fn().mockResolvedValue({ error: profileUpdateError })
  const profileUpdateMock = vi.fn().mockReturnValue({ eq: profileEqMock })

  const proposalUpdateEqMock = vi.fn().mockResolvedValue({ error: proposalUpdateError })
  const proposalUpdateMock = vi.fn().mockReturnValue({ eq: proposalUpdateEqMock })

  const fromMock = vi.fn((table: string) => {
    if (table === 'resume_field_proposals') return { select: selectMock, update: proposalUpdateMock }
    if (table === 'member_profiles') return { update: profileUpdateMock }
    throw new Error(`unexpected table in test: ${table}`)
  })

  return { client: { from: fromMock } as unknown as SupabaseClient, fromMock, selectMock, profileUpdateMock, proposalUpdateMock }
}

describe('fetchProposalsForReview', () => {
  it('fetches non-superseded proposals for the given document, ordered by creation', async () => {
    const rows = [makeRow(), makeRow({ id: 'row-2' })]
    const { client, selectMock } = makeFakeClient({ fetchRows: rows })
    const result = await fetchProposalsForReview('user-1', 'doc-1', client)
    expect(result).toEqual(rows)
    expect(selectMock).toHaveBeenCalled()
  })
})

describe('recordProposalDecision', () => {
  it('applies the canonical write and marks the row reviewed when it succeeds', async () => {
    const { client, profileUpdateMock, proposalUpdateMock } = makeFakeClient()
    const row = makeRow()
    const result = await recordProposalDecision('user-1', row, 'accept_as_canonical', undefined, client)
    expect(result.errors).toEqual([])
    expect(profileUpdateMock).toHaveBeenCalledWith({ full_name: 'Jamie Rivera' })
    expect(proposalUpdateMock).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'reviewed', decision: 'accept_as_canonical' }),
    )
  })

  it('does not mark the row reviewed when the canonical write is rejected (e.g. the email column gap)', async () => {
    const row = makeRow({ destination_field: 'email', candidate_value: 'jamie@example.com' })
    const { client, proposalUpdateMock } = makeFakeClient()
    const result = await recordProposalDecision('user-1', row, 'accept_as_canonical', undefined, client)
    expect(result.errors).toHaveLength(1)
    expect(proposalUpdateMock).not.toHaveBeenCalled()
  })

  it('reject: marks the row reviewed with no canonical write at all', async () => {
    const { client, profileUpdateMock, proposalUpdateMock } = makeFakeClient()
    const row = makeRow()
    const result = await recordProposalDecision('user-1', row, 'reject', undefined, client)
    expect(result.errors).toEqual([])
    expect(profileUpdateMock).not.toHaveBeenCalled()
    expect(proposalUpdateMock).toHaveBeenCalledWith(expect.objectContaining({ decision: 'reject' }))
  })

  it('keep_existing_canonical and reject remain distinguishable in the persisted row', async () => {
    const { client, proposalUpdateMock } = makeFakeClient()
    await recordProposalDecision('user-1', makeRow(), 'keep_existing_canonical', undefined, client)
    expect(proposalUpdateMock).toHaveBeenCalledWith(expect.objectContaining({ status: 'reviewed', decision: 'keep_existing_canonical' }))
  })

  it('reconstructs a canonical-profile-array destination from destination_array_index correctly', async () => {
    const { client, proposalUpdateMock } = makeFakeClient()
    const row = makeRow({
      destination_kind: 'canonical-profile-array',
      destination_field: 'skills',
      destination_array_index: 'append',
      proposed_action: 'create',
    })
    const result = await recordProposalDecision('user-1', row, 'use_as_resume_specific_only', undefined, client)
    // A brand-new (proposedAction=create) canonical-array fact used resume-specific-only is the Phase 3 orphan guard -- expect it rejected, row not marked reviewed.
    expect(result.errors).toHaveLength(1)
    expect(proposalUpdateMock).not.toHaveBeenCalled()
  })
})
