import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { CareerSuccessRoadmapTeaser } from './CareerSuccessRoadmapTeaser'
import { isRoadmapMilestoneEvent } from '@/lib/roadmap'
import type { CareerTimelineEvent } from '@/types'

// Regression guard for the "must never diverge" contract documented in
// CareerSuccessRoadmapTeaser.tsx's own comments: that file (part of the
// locked Career Success surface, Sub-Project 7) implements its own,
// separate, unexported isRoadmapEvent() predicate rather than importing
// from src/lib/roadmap.ts -- a deliberate prior decision to avoid coupling
// a locked surface to /roadmap's internals. This test does NOT edit or
// import from inside that file; instead it renders the real, unmodified
// component against a mixed fixture and proves its rendered milestone
// count matches what the new, independently-implemented
// isRoadmapMilestoneEvent() (src/lib/roadmap.ts) would classify -- so the
// two filters silently drifting apart would fail this test immediately,
// without requiring the teaser to ever be touched.

const { mockGetTimeline } = vi.hoisted(() => ({ mockGetTimeline: vi.fn() }))

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'user-1' } }),
}))

vi.mock('@/lib/profile', () => ({
  getTimeline: mockGetTimeline,
}))

function renderTeaser() {
  return render(
    <MemoryRouter>
      <CareerSuccessRoadmapTeaser />
    </MemoryRouter>,
  )
}

function event(overrides: Partial<CareerTimelineEvent> = {}): CareerTimelineEvent {
  return {
    id: 'e1',
    user_id: 'user-1',
    event_type: 'career_roadmap',
    event_title: 'Untitled',
    event_description: null,
    event_date: '2026-01-01T00:00:00.000Z',
    metadata: {},
    created_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

describe('CareerSuccessRoadmapTeaser / RoadmapPage filter parity', () => {
  it('renders the same milestone count AND the same most-recent item that isRoadmapMilestoneEvent() would compute, for a mixed fixture', async () => {
    // Distinct titles matter here: cardinality alone can't catch a filter
    // that swaps WHICH event types it treats as roadmap-relevant while
    // keeping the same total count (e.g. matching interview_scheduled +
    // offer_received instead of career_roadmap + promotion_coaching would
    // still yield a count of 2 here). Asserting on the identity of the
    // first qualifying item closes that gap.
    const fixture = [
      event({ id: 'a', event_type: 'career_roadmap', event_title: 'Roadmap item A' }),
      event({ id: 'b', event_type: 'promotion_coaching', event_title: 'Roadmap item B' }),
      event({ id: 'c', event_type: 'application_submitted', event_title: 'Not a milestone C' }),
      event({ id: 'd', event_type: 'interview_scheduled', event_title: 'Not a milestone D' }),
      event({ id: 'e', event_type: 'offer_received', event_title: 'Not a milestone E' }),
    ]
    const matches = fixture.filter(isRoadmapMilestoneEvent)
    const expectedCount = matches.length
    const expectedMostRecentTitle = matches[0].event_title
    mockGetTimeline.mockResolvedValue(fixture)

    renderTeaser()

    await waitFor(() =>
      expect(screen.getByText(new RegExp(`You have ${expectedCount} roadmap milestone`))).toBeInTheDocument(),
    )
    expect(screen.getByText(`Most recent: ${expectedMostRecentTitle}`)).toBeInTheDocument()
  })

  it('renders the true empty state when nothing in the fixture is roadmap-relevant, matching isRoadmapMilestoneEvent()', async () => {
    const fixture = [
      event({ id: 'c', event_type: 'application_submitted' }),
      event({ id: 'd', event_type: 'interview_scheduled' }),
    ]
    expect(fixture.filter(isRoadmapMilestoneEvent)).toHaveLength(0)
    mockGetTimeline.mockResolvedValue(fixture)

    renderTeaser()

    await waitFor(() =>
      expect(screen.getByText("Your roadmap hasn't been built yet. Ask your Career Strategist to build one.")).toBeInTheDocument(),
    )
  })

  it('renders a count and most-recent title matching isRoadmapMilestoneEvent() when every fixture item is roadmap-relevant', async () => {
    const fixture = [
      event({ id: 'a', event_type: 'career_roadmap', event_title: 'First roadmap item' }),
      event({ id: 'b', event_type: 'promotion_coaching', event_title: 'Second roadmap item' }),
      event({ id: 'f', event_type: 'career_roadmap', event_title: 'Third roadmap item' }),
    ]
    const matches = fixture.filter(isRoadmapMilestoneEvent)
    expect(matches).toHaveLength(3)
    mockGetTimeline.mockResolvedValue(fixture)

    renderTeaser()

    await waitFor(() =>
      expect(screen.getByText(new RegExp(`You have ${matches.length} roadmap milestone`))).toBeInTheDocument(),
    )
    expect(screen.getByText(`Most recent: ${matches[0].event_title}`)).toBeInTheDocument()
  })
})
