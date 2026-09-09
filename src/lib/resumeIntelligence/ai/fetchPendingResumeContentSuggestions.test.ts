import { describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { fetchPendingResumeContentSuggestions } from './fetchPendingResumeContentSuggestions'

function makeFakeClient(rows: Record<string, unknown>[]) {
  const orderMock = vi.fn().mockResolvedValue({ data: rows, error: null })
  const eqStatusMock = vi.fn().mockReturnValue({ order: orderMock })
  const eqVersionMock = vi.fn().mockReturnValue({ eq: eqStatusMock })
  const eqUserMock = vi.fn().mockReturnValue({ eq: eqVersionMock })
  const selectMock = vi.fn().mockReturnValue({ eq: eqUserMock })
  const fromMock = vi.fn().mockReturnValue({ select: selectMock })
  return { from: fromMock } as unknown as SupabaseClient
}

describe('fetchPendingResumeContentSuggestions', () => {
  it('maps pending suggestion rows to the review-panel shape', async () => {
    const client = makeFakeClient([
      { id: 's1', target_field: 'summary', proposed_text: 'New summary', evidence_reference: 'evidence text', reasoning: 'Because reasons' },
    ])
    const result = await fetchPendingResumeContentSuggestions('user-1', 'v-1', client)
    expect(result).toEqual([{ id: 's1', targetField: 'summary', proposedText: 'New summary', evidenceReference: 'evidence text', reasoning: 'Because reasons' }])
  })

  it('returns an empty array (never fabricates a suggestion) when there are none', async () => {
    const client = makeFakeClient([])
    const result = await fetchPendingResumeContentSuggestions('user-1', 'v-1', client)
    expect(result).toEqual([])
  })
})
