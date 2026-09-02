import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useTopJobMatch } from './useTopJobMatch'
import type { JobMatchWithJob } from '@/types'

const { mockGetJobMatches } = vi.hoisted(() => ({ mockGetJobMatches: vi.fn() }))

vi.mock('@/lib/opportunityEngine', () => ({
  getJobMatches: mockGetJobMatches,
}))

function makeMatch(id: string, score: number): JobMatchWithJob {
  return {
    id, member_id: 'user-1', scraped_job_id: `job-${id}`, fresh_fit_score: score,
    matched_skills: [], missing_skills: [], score_breakdown: {}, dismissed_at: null,
    promoted_opportunity_id: null, computed_at: '2026-01-01',
    scraped_job: {
      id: `job-${id}`, source: 'greenhouse', external_id: id, title: `Job ${id}`, company: 'Acme',
      location: null, description: '', salary_text: null, employment_type: null,
      posting_url: 'https://example.com', posted_at: null, search_query: null,
      is_active: true, scraped_at: '', created_at: '',
    },
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('useTopJobMatch', () => {
  it('starts loading and resolves to null with loading false when there is no user id', async () => {
    const { result } = renderHook(() => useTopJobMatch(undefined))
    expect(result.current.loading).toBe(false)
    expect(result.current.topMatch).toBeNull()
    expect(mockGetJobMatches).not.toHaveBeenCalled()
  })

  it('returns the first match from getJobMatches (already sorted by score desc)', async () => {
    mockGetJobMatches.mockResolvedValue([makeMatch('best', 90), makeMatch('rest', 40)])

    const { result } = renderHook(() => useTopJobMatch('user-1'))
    expect(result.current.loading).toBe(true)

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.topMatch?.id).toBe('best')
  })

  it('resolves to null when the member has no matches', async () => {
    mockGetJobMatches.mockResolvedValue([])

    const { result } = renderHook(() => useTopJobMatch('user-1'))

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.topMatch).toBeNull()
  })

  it('fails closed to null (not a stuck loading state) if the fetch rejects', async () => {
    mockGetJobMatches.mockRejectedValue(new Error('network error'))

    const { result } = renderHook(() => useTopJobMatch('user-1'))

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.topMatch).toBeNull()
  })
})
