import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { RoadmapPage } from './RoadmapPage'

const { mockGetTimeline } = vi.hoisted(() => ({ mockGetTimeline: vi.fn() }))

// This test exists purely as a regression guard: RoadmapPage.tsx itself is
// NOT modified anywhere in the roadmap write-path repair -- it locks in
// today's read behavior so a future change can't silently break it.

vi.mock('@/lib/supabase', () => {
  const makeBuilder = () => {
    const builder: Record<string, unknown> = {}
    const chain = () => builder
    builder.select = chain
    builder.eq = chain
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

vi.mock('@/hooks/useBadges', () => ({
  useBadges: () => ({
    loading: false,
    earnedBadges: [],
    membershipBadges: [],
    achievementBadges: [],
    hasBadge: () => false,
    refresh: vi.fn(),
  }),
}))

vi.mock('@/lib/profile', () => ({
  getTimeline: mockGetTimeline,
}))

function renderPage() {
  return render(
    <MemoryRouter>
      <RoadmapPage />
    </MemoryRouter>,
  )
}

describe('RoadmapPage (read-side regression guard)', () => {
  it('renders only career_roadmap/promotion_coaching events, filtering out unrelated timeline types', async () => {
    mockGetTimeline.mockResolvedValue([
      { id: 'e1', event_type: 'career_roadmap', event_title: 'Promotion review', event_description: null, event_date: '2026-01-01' },
      { id: 'e2', event_type: 'application_submitted', event_title: 'Applied to Acme', event_description: null, event_date: '2026-01-02' },
      { id: 'e3', event_type: 'promotion_coaching', event_title: 'Coaching session', event_description: null, event_date: '2026-01-03' },
    ])

    renderPage()

    await waitFor(() => expect(screen.getByText('Promotion review')).toBeInTheDocument())
    expect(screen.getByText('Coaching session')).toBeInTheDocument()
    expect(screen.queryByText('Applied to Acme')).not.toBeInTheDocument()
  })

  it('shows the true empty state, unchanged, when no roadmap milestones exist', async () => {
    mockGetTimeline.mockResolvedValue([])

    renderPage()

    await waitFor(() =>
      expect(screen.getByText(/Your roadmap hasn't been built yet/)).toBeInTheDocument(),
    )
    expect(screen.getByRole('link', { name: /Ask your Strategist to build one/i })).toHaveAttribute('href', '/messages')
  })
})
