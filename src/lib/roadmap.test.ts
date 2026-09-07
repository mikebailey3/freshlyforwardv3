import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const { mockRpc, mockFrom } = vi.hoisted(() => ({ mockRpc: vi.fn(), mockFrom: vi.fn() }))

vi.mock('@/lib/supabase', () => ({
  supabase: { rpc: mockRpc, from: mockFrom },
}))

import {
  addRoadmapMilestone,
  isRoadmapMilestoneEvent,
  getRoadmapMilestones,
  groupRoadmapMilestones,
  dateInputValueToRoadmapEventDate,
  formatRoadmapEventDate,
  roadmapEventDateToCalendarDay,
} from './roadmap'
import type { CareerTimelineEvent } from '@/types'

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

function event(overrides: Partial<CareerTimelineEvent> = {}): CareerTimelineEvent {
  return {
    id: 'e1',
    user_id: 'member-1',
    event_type: 'career_roadmap',
    event_title: 'Untitled',
    event_description: null,
    event_date: '2026-01-15T00:00:00.000Z',
    metadata: {},
    created_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

describe('isRoadmapMilestoneEvent', () => {
  it('is true for career_roadmap and promotion_coaching', () => {
    expect(isRoadmapMilestoneEvent(event({ event_type: 'career_roadmap' }))).toBe(true)
    expect(isRoadmapMilestoneEvent(event({ event_type: 'promotion_coaching' }))).toBe(true)
  })

  it('is false for unrelated timeline event types', () => {
    expect(isRoadmapMilestoneEvent(event({ event_type: 'application_submitted' }))).toBe(false)
    expect(isRoadmapMilestoneEvent(event({ event_type: 'interview_scheduled' }))).toBe(false)
  })
})

describe('getRoadmapMilestones', () => {
  const mockEq = vi.fn()
  const mockIn = vi.fn()

  beforeEach(() => {
    mockFrom.mockReset()
    mockEq.mockReset()
    mockIn.mockReset()
  })

  function mockSelectResult(result: { data: CareerTimelineEvent[] | null; error: { message: string } | null }) {
    mockIn.mockReturnValue(Promise.resolve(result))
    mockEq.mockReturnValue({ in: mockIn })
    mockFrom.mockReturnValue({
      select: () => ({ eq: mockEq }),
    })
  }

  it('queries career_timeline scoped to the user and pre-filtered to roadmap event types', async () => {
    mockSelectResult({
      data: [event({ id: 'a', event_type: 'career_roadmap' })],
      error: null,
    })

    const result = await getRoadmapMilestones('member-1')

    expect(mockFrom).toHaveBeenCalledWith('career_timeline')
    expect(mockEq).toHaveBeenCalledWith('user_id', 'member-1')
    expect(mockIn).toHaveBeenCalledWith('event_type', ['career_roadmap', 'promotion_coaching'])
    expect(result.milestones.map((m) => m.id)).toEqual(['a'])
  })

  it('surfaces a Supabase error instead of swallowing it into an empty array', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    mockSelectResult({ data: null, error: { message: 'network down' } })

    const result = await getRoadmapMilestones('member-1')

    expect(result).toEqual({ milestones: [], error: 'network down' })
    expect(consoleSpy).toHaveBeenCalled()
    consoleSpy.mockRestore()
  })

  it('returns an empty, error-free result for a genuinely empty timeline', async () => {
    mockSelectResult({ data: [], error: null })

    const result = await getRoadmapMilestones('member-1')

    expect(result).toEqual({ milestones: [], error: null })
  })
})

describe('date helpers (timezone-safe calendar-date round-trip)', () => {
  it('anchors a date-input value at UTC midnight', () => {
    expect(dateInputValueToRoadmapEventDate('2026-03-15')).toBe('2026-03-15T00:00:00.000Z')
  })

  it('formats a stored UTC-midnight date back to the same calendar day, regardless of local timezone', () => {
    // The whole point of this helper: no matter what timezone the test
    // runner/browser is in, formatting must never shift the calendar day.
    expect(formatRoadmapEventDate('2026-03-15T00:00:00.000Z')).toBe('Mar 15, 2026')
    expect(formatRoadmapEventDate('2026-12-31T00:00:00.000Z')).toBe('Dec 31, 2026')
    expect(formatRoadmapEventDate('2026-01-01T00:00:00.000Z')).toBe('Jan 1, 2026')
  })

  it('roadmapEventDateToCalendarDay slices the calendar day regardless of time-of-day', () => {
    expect(roadmapEventDateToCalendarDay('2026-03-15T00:00:00.000Z')).toBe('2026-03-15')
    expect(roadmapEventDateToCalendarDay('2026-03-15T14:30:00.000Z')).toBe('2026-03-15')
  })

  it('degrades to a safe fallback instead of throwing on an unparsable event_date', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(formatRoadmapEventDate('')).toBe('Unknown date')
    expect(formatRoadmapEventDate('not-a-date')).toBe('Unknown date')
    expect(consoleSpy).toHaveBeenCalled()
    consoleSpy.mockRestore()
  })

  it('round-trips a date-input value through both helpers without any day shift', () => {
    const original = '2026-06-01'
    const stored = dateInputValueToRoadmapEventDate(original)
    expect(formatRoadmapEventDate(stored)).toBe('Jun 1, 2026')
  })
})

describe('groupRoadmapMilestones', () => {
  it('returns an all-empty result for no milestones', () => {
    expect(groupRoadmapMilestones([], new Date('2026-06-15T12:00:00.000Z'))).toEqual({
      next: null,
      upcoming: [],
      overdue: [],
    })
  })

  it('treats a single upcoming milestone as `next`, with both lists empty', () => {
    const m = event({ id: 'a', event_date: '2026-06-20T00:00:00.000Z' })
    const result = groupRoadmapMilestones([m], new Date('2026-06-15T12:00:00.000Z'))
    expect(result).toEqual({ next: m, upcoming: [], overdue: [] })
  })

  it('treats a single overdue milestone as overdue, with no `next`', () => {
    const m = event({ id: 'a', event_date: '2026-06-10T00:00:00.000Z' })
    const result = groupRoadmapMilestones([m], new Date('2026-06-15T12:00:00.000Z'))
    expect(result).toEqual({ next: null, upcoming: [], overdue: [m] })
  })

  it('boundary: a milestone dated exactly today is upcoming, never overdue', () => {
    const m = event({ id: 'a', event_date: '2026-06-15T00:00:00.000Z' })
    // `now` is later the same UTC calendar day -- must still count as today, not overdue.
    const result = groupRoadmapMilestones([m], new Date('2026-06-15T23:59:00.000Z'))
    expect(result.next).toEqual(m)
    expect(result.overdue).toEqual([])
  })

  it('partitions and sorts a mixed set correctly, with `next` as the earliest upcoming item', () => {
    const farFuture = event({ id: 'far-future', event_date: '2026-08-01T00:00:00.000Z' })
    const nearFuture = event({ id: 'near-future', event_date: '2026-06-20T00:00:00.000Z' })
    const recentPast = event({ id: 'recent-past', event_date: '2026-06-10T00:00:00.000Z' })
    const distantPast = event({ id: 'distant-past', event_date: '2026-05-01T00:00:00.000Z' })

    const result = groupRoadmapMilestones(
      [farFuture, recentPast, nearFuture, distantPast],
      new Date('2026-06-15T12:00:00.000Z'),
    )

    expect(result.next).toEqual(nearFuture)
    expect(result.upcoming).toEqual([farFuture])
    expect(result.overdue).toEqual([distantPast, recentPast])
  })

  it('all-overdue: no `next`, overdue list sorted oldest (most overdue) first', () => {
    const lessOverdue = event({ id: 'less-overdue', event_date: '2026-06-12T00:00:00.000Z' })
    const moreOverdue = event({ id: 'more-overdue', event_date: '2026-06-01T00:00:00.000Z' })

    const result = groupRoadmapMilestones([lessOverdue, moreOverdue], new Date('2026-06-15T12:00:00.000Z'))

    expect(result.next).toBeNull()
    expect(result.overdue).toEqual([moreOverdue, lessOverdue])
    expect(result.upcoming).toEqual([])
  })

  it('preserves both milestones when two share the exact same date, using created_at as a stable tiebreaker', () => {
    const earlierCreated = event({ id: 'earlier-created', event_date: '2026-06-20T00:00:00.000Z', created_at: '2026-01-01T00:00:00.000Z' })
    const laterCreated = event({ id: 'later-created', event_date: '2026-06-20T00:00:00.000Z', created_at: '2026-01-02T00:00:00.000Z' })

    // Fed in reverse-creation order on purpose, to prove the sort -- not
    // incidental array order -- determines the result.
    const result = groupRoadmapMilestones([laterCreated, earlierCreated], new Date('2026-06-15T12:00:00.000Z'))

    expect(result.next).toEqual(earlierCreated)
    expect(result.upcoming).toEqual([laterCreated])
  })

  describe('local vs UTC "today" semantics', () => {
    const originalTZ = process.env.TZ

    beforeEach(() => {
      process.env.TZ = 'America/New_York'
    })

    afterEach(() => {
      process.env.TZ = originalTZ
    })

    it("uses the viewer's local calendar day for \"today\", not the UTC calendar day", () => {
      // 2026-06-15T23:30:00Z is already 2026-06-16 in UTC, but it's still
      // 2026-06-15, 7:30pm in America/New_York (UTC-4 in June, DST). A
      // milestone targeted at 2026-06-15 must read as due-today (upcoming)
      // for this Eastern-time viewer, not overdue.
      const now = new Date('2026-06-15T23:30:00.000Z')
      const milestone = event({ id: 'a', event_date: '2026-06-15T00:00:00.000Z' })

      const result = groupRoadmapMilestones([milestone], now)

      expect(result.next).toEqual(milestone)
      expect(result.overdue).toEqual([])
    })
  })
})
