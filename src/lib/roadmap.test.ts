import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockRpc } = vi.hoisted(() => ({ mockRpc: vi.fn() }))

vi.mock('@/lib/supabase', () => ({
  supabase: { rpc: mockRpc },
}))

import { addRoadmapMilestone } from './roadmap'

describe('addRoadmapMilestone', () => {
  beforeEach(() => {
    mockRpc.mockReset()
  })

  it('calls the add_roadmap_milestone RPC with the expected params and returns the milestone', async () => {
    const fakeRow = { id: 'm1', user_id: 'member-1', event_type: 'career_roadmap', event_title: 'Promotion review', event_description: null, event_date: '2026-01-01', metadata: {}, created_at: '2026-01-01' }
    mockRpc.mockResolvedValue({ data: fakeRow, error: null })

    const result = await addRoadmapMilestone({
      memberId: 'member-1',
      title: 'Promotion review',
      description: 'Q1 check-in',
      eventDate: '2026-01-01',
      idempotencyKey: 'key-abc',
    })

    expect(mockRpc).toHaveBeenCalledWith('add_roadmap_milestone', {
      p_member_id: 'member-1',
      p_title: 'Promotion review',
      p_description: 'Q1 check-in',
      p_event_date: '2026-01-01',
      p_idempotency_key: 'key-abc',
    })
    expect(result).toEqual({ milestone: fakeRow, error: null })
  })

  it('surfaces the error instead of swallowing it when the RPC rejects the call', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    mockRpc.mockResolvedValue({ data: null, error: { message: 'Not authorized to add a roadmap milestone for this member' } })

    const result = await addRoadmapMilestone({ memberId: 'member-2', title: 'Should fail' })

    expect(result.milestone).toBeNull()
    expect(result.error).toBe('Not authorized to add a roadmap milestone for this member')
    expect(consoleSpy).toHaveBeenCalled()
    consoleSpy.mockRestore()
  })

  it('defaults optional fields to null rather than undefined when omitted', async () => {
    mockRpc.mockResolvedValue({ data: { id: 'm3', user_id: 'member-3', event_type: 'career_roadmap', event_title: 'Minimal call', event_description: null, event_date: '2026-01-01', metadata: {}, created_at: '2026-01-01' }, error: null })

    await addRoadmapMilestone({ memberId: 'member-3', title: 'Minimal call' })

    expect(mockRpc).toHaveBeenCalledWith('add_roadmap_milestone', {
      p_member_id: 'member-3',
      p_title: 'Minimal call',
      p_description: null,
      p_event_date: null,
      p_idempotency_key: null,
    })
  })

  it('returns an error instead of an unchecked cast when the RPC resolves with no error but malformed data', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    mockRpc.mockResolvedValue({ data: null, error: null })

    const result = await addRoadmapMilestone({ memberId: 'member-4', title: 'Malformed response' })

    expect(result).toEqual({ milestone: null, error: 'Unexpected response from server' })
    expect(consoleSpy).toHaveBeenCalled()
    consoleSpy.mockRestore()
  })
})
