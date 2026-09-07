import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { RoadmapPage } from './RoadmapPage'
import type { CareerTimelineEvent } from '@/types'

const { mockGetRoadmapMilestones } = vi.hoisted(() => ({ mockGetRoadmapMilestones: vi.fn() }))

vi.mock('@/lib/roadmap', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/roadmap')>()
  // Only the fetch is mocked -- groupRoadmapMilestones/formatRoadmapEventDate
  // stay real so these tests prove the actual integration, not a stand-in.
  return { ...actual, getRoadmapMilestones: mockGetRoadmapMilestones }
})

vi.mock('@/lib/supabase', () => {
  const makeBuilder = () => {
    const builder: Record<string, unknown> = {}
    const chain = () => builder
    builder.select = chain
    builder.eq = chain
    builder.in = chain
    builder.maybeSingle = () => Promise.resolve({ data: null, error: null })
    builder.then = (resolve: (value: { data: null; error: null; count: number }) => void) =>
      resolve({ data: null, error: null, count: 0 })
    return builder
  }
  return { supabase: { from: () => makeBuilder() } }
})

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'user-1' }, profile: { full_name: 'Ada Lovelace', plan_id: null } }),
}))

vi.mock('@/hooks/useEntitlements', () => ({
  useEntitlements: () => ({ canAccess: () => true }),
}))

const { mockUseBadges } = vi.hoisted(() => ({ mockUseBadges: vi.fn() }))
vi.mock('@/hooks/useBadges', () => ({ useBadges: mockUseBadges }))

function renderPage() {
  return render(
    <MemoryRouter>
      <RoadmapPage />
    </MemoryRouter>,
  )
}

function milestone(overrides: Partial<CareerTimelineEvent> = {}): CareerTimelineEvent {
  return {
    id: 'e1',
    user_id: 'user-1',
    event_type: 'career_roadmap',
    event_title: 'Untitled milestone',
    event_description: null,
    event_date: '2026-01-01T00:00:00.000Z',
    metadata: {},
    created_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

// Computed relative to the real clock (not mocked) so these stay correct
// forever without needing fake-timer/RTL interaction workarounds. The
// exact day-boundary comparison itself is already unit-tested directly
// against groupRoadmapMilestones() in src/lib/roadmap.test.ts -- these
// tests only need "clearly future" / "clearly past" fixtures.
const DAY_MS = 24 * 60 * 60 * 1000
function daysFromNowIso(days: number): string {
  const d = new Date(Date.now() + days * DAY_MS)
  return `${d.toISOString().slice(0, 10)}T00:00:00.000Z`
}

describe('RoadmapPage', () => {
  beforeEach(() => {
    mockGetRoadmapMilestones.mockReset()
    mockUseBadges.mockReset()
    mockUseBadges.mockReturnValue({
      loading: false,
      earnedBadges: [],
      membershipBadges: [],
      achievementBadges: [],
      hasBadge: () => false,
      refresh: vi.fn(),
    })
  })

  it('shows an accessible loading state while fetching', () => {
    mockGetRoadmapMilestones.mockReturnValue(new Promise(() => {}))

    renderPage()

    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(screen.getByText(/loading your roadmap/i)).toBeInTheDocument()
  })

  it('shows an honest error state -- not the empty state -- when the fetch fails', async () => {
    mockGetRoadmapMilestones.mockResolvedValue({ milestones: [], error: 'network down' })

    renderPage()

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())
    expect(screen.queryByText(/hasn't been built yet/i)).not.toBeInTheDocument()
  })

  it('retries the fetch when Try again is clicked after an error', async () => {
    mockGetRoadmapMilestones.mockResolvedValueOnce({ milestones: [], error: 'network down' })
    mockGetRoadmapMilestones.mockResolvedValueOnce({
      milestones: [milestone({ id: 'a', event_title: 'Promotion review', event_date: daysFromNowIso(5) })],
      error: null,
    })

    renderPage()

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: /try again/i }))

    await waitFor(() => expect(screen.getByText('Promotion review')).toBeInTheDocument())
    expect(mockGetRoadmapMilestones).toHaveBeenCalledTimes(2)
  })

  it('shows the true empty state, unchanged link, for zero milestones', async () => {
    mockGetRoadmapMilestones.mockResolvedValue({ milestones: [], error: null })

    renderPage()

    await waitFor(() => expect(screen.getByText(/hasn't been built yet/i)).toBeInTheDocument())
    expect(screen.getByRole('link', { name: /ask your strategist to build one/i })).toHaveAttribute(
      'href',
      '/messages',
    )
  })

  it('renders a single upcoming milestone as the Next milestone hero, with no Upcoming/Overdue headings', async () => {
    mockGetRoadmapMilestones.mockResolvedValue({
      milestones: [milestone({ id: 'a', event_title: 'Promotion review', event_date: daysFromNowIso(5) })],
      error: null,
    })

    renderPage()

    await waitFor(() => expect(screen.getByText('Promotion review')).toBeInTheDocument())
    expect(screen.getByRole('heading', { name: /next milestone/i })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: /^upcoming$/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: /^overdue$/i })).not.toBeInTheDocument()
  })

  it('renders a single overdue milestone with an honest no-upcoming notice and no hero', async () => {
    mockGetRoadmapMilestones.mockResolvedValue({
      milestones: [milestone({ id: 'a', event_title: 'Past due review', event_date: daysFromNowIso(-5) })],
      error: null,
    })

    renderPage()

    await waitFor(() => expect(screen.getByText('Past due review')).toBeInTheDocument())
    expect(screen.queryByRole('heading', { name: /next milestone/i })).not.toBeInTheDocument()
    expect(screen.getByText(/no upcoming milestones/i)).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /^overdue$/i })).toBeInTheDocument()
  })

  it('uses count-agnostic copy in the no-upcoming notice when multiple milestones are overdue', async () => {
    mockGetRoadmapMilestones.mockResolvedValue({
      milestones: [
        milestone({ id: 'a', event_title: 'Past due review one', event_date: daysFromNowIso(-5) }),
        milestone({ id: 'b', event_title: 'Past due review two', event_date: daysFromNowIso(-10) }),
      ],
      error: null,
    })

    renderPage()

    await waitFor(() => expect(screen.getByText('Past due review one')).toBeInTheDocument())
    expect(screen.getByText('Past due review two')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: /next milestone/i })).not.toBeInTheDocument()
    // Copy must not imply exactly one overdue item ("your most recent one")
    // when there are actually several.
    expect(screen.queryByText(/your most recent one/i)).not.toBeInTheDocument()
    expect(screen.getByText(/no upcoming milestones/i)).toBeInTheDocument()

    // Both overdue items sorted oldest (most overdue) first.
    const bodyText = document.body.textContent || ''
    expect(bodyText.indexOf('Past due review two')).toBeLessThan(bodyText.indexOf('Past due review one'))
  })

  it('renders many mixed milestones with hero + Upcoming + Overdue sections in the correct forward-looking order', async () => {
    mockGetRoadmapMilestones.mockResolvedValue({
      milestones: [
        milestone({ id: 'far', event_title: 'Far future goal', event_date: daysFromNowIso(60) }),
        milestone({ id: 'near', event_title: 'Near future goal', event_date: daysFromNowIso(5) }),
        milestone({ id: 'past', event_title: 'Recent past item', event_date: daysFromNowIso(-5) }),
      ],
      error: null,
    })

    renderPage()

    await waitFor(() => expect(screen.getByText('Near future goal')).toBeInTheDocument())
    expect(screen.getByRole('heading', { name: /next milestone/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /^upcoming$/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /^overdue$/i })).toBeInTheDocument()
    expect(screen.getByText('Far future goal')).toBeInTheDocument()
    expect(screen.getByText('Recent past item')).toBeInTheDocument()

    const bodyText = document.body.textContent || ''
    expect(bodyText.indexOf('Near future goal')).toBeLessThan(bodyText.indexOf('Far future goal'))
    expect(bodyText.indexOf('Far future goal')).toBeLessThan(bodyText.indexOf('Recent past item'))
  })

  it('never renders any strategist/member attribution label -- not persisted, so not shown', async () => {
    mockGetRoadmapMilestones.mockResolvedValue({
      milestones: [milestone({ id: 'a', event_title: 'Promotion review', event_date: daysFromNowIso(5) })],
      error: null,
    })

    renderPage()

    await waitFor(() => expect(screen.getByText('Promotion review')).toBeInTheDocument())
    expect(screen.queryByText(/added by/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/strategist added/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/self-logged/i)).not.toBeInTheDocument()
  })

  it('never renders a fabricated "Completed" state, even for a past-dated milestone', async () => {
    mockGetRoadmapMilestones.mockResolvedValue({
      milestones: [milestone({ id: 'a', event_title: 'Past due review', event_date: daysFromNowIso(-5) })],
      error: null,
    })

    renderPage()

    await waitFor(() => expect(screen.getByText('Past due review')).toBeInTheDocument())
    expect(screen.queryByText(/^completed$/i)).not.toBeInTheDocument()
  })

  it('preserves the existing Career Builder badge banner', async () => {
    mockUseBadges.mockReturnValue({
      loading: false,
      earnedBadges: [
        {
          id: 'mb1',
          user_id: 'user-1',
          badge_id: 'b1',
          awarded_at: '2026-01-01T00:00:00.000Z',
          badge: {
            id: 'b1',
            slug: 'career-builder',
            badge_type: 'achievement',
            name: 'Career Builder',
            description: 'Completed a full roadmap',
            icon: 'Map',
            color_scheme: 'gold',
            sort_order: 1,
            is_active: true,
            created_at: '2026-01-01T00:00:00.000Z',
          },
        },
      ],
      membershipBadges: [],
      achievementBadges: [],
      hasBadge: (slug: string) => slug === 'career-builder',
      refresh: vi.fn(),
    })
    mockGetRoadmapMilestones.mockResolvedValue({ milestones: [], error: null })

    renderPage()

    await waitFor(() => expect(screen.getByText(/career builder badge earned/i)).toBeInTheDocument())
  })

  it('preserves the existing goal-achieved banner', async () => {
    mockUseBadges.mockReturnValue({
      loading: false,
      earnedBadges: [],
      membershipBadges: [],
      achievementBadges: [],
      hasBadge: (slug: string) => slug === 'goal-achieved',
      refresh: vi.fn(),
    })
    mockGetRoadmapMilestones.mockResolvedValue({ milestones: [], error: null })

    renderPage()

    await waitFor(() => expect(screen.getByText(/achieved a major career goal/i)).toBeInTheDocument())
  })
})
