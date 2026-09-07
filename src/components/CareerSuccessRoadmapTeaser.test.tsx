import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { CareerSuccessRoadmapTeaser } from './CareerSuccessRoadmapTeaser'

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

function event(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'e1',
    event_type: 'career_roadmap',
    event_title: 'Promotion to Senior PM',
    event_description: null,
    event_date: '2026-01-01',
    ...overrides,
  }
}

describe('CareerSuccessRoadmapTeaser', () => {
  it('shows milestone count and the most recent milestone title when data exists', async () => {
    mockGetTimeline.mockResolvedValue([event(), event({ id: 'e2', event_type: 'promotion_coaching', event_title: 'Leadership skill review' })])

    renderTeaser()

    await waitFor(() => expect(screen.getByText('You have 2 roadmap milestones.')).toBeInTheDocument())
    expect(screen.getByText('Most recent: Promotion to Senior PM')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /View your roadmap/i })).toHaveAttribute('href', '/roadmap')
  })

  it('ignores timeline events that are not roadmap/promotion_coaching types', async () => {
    mockGetTimeline.mockResolvedValue([event({ event_type: 'application_submitted', event_title: 'Applied to Acme' })])

    renderTeaser()

    await waitFor(() =>
      expect(screen.getByText("Your roadmap hasn't been built yet. Ask your Career Strategist to build one.")).toBeInTheDocument(),
    )
    expect(screen.queryByText(/Applied to Acme/)).not.toBeInTheDocument()
  })

  it('shows the true empty state (the expected common case) honestly, not as an error', async () => {
    mockGetTimeline.mockResolvedValue([])

    renderTeaser()

    await waitFor(() =>
      expect(screen.getByText("Your roadmap hasn't been built yet. Ask your Career Strategist to build one.")).toBeInTheDocument(),
    )
    // Only one link to /roadmap -- this teaser must not duplicate
    // RoadmapPage's own "Ask your Strategist" messaging CTA.
    expect(screen.getAllByRole('link')).toHaveLength(1)
    expect(screen.queryByRole('link', { name: /messages/i })).not.toBeInTheDocument()
  })

  it('degrades to the empty state and does not crash when the fetch rejects', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    mockGetTimeline.mockRejectedValue(new Error('network down'))

    renderTeaser()

    await waitFor(() =>
      expect(screen.getByText("Your roadmap hasn't been built yet. Ask your Career Strategist to build one.")).toBeInTheDocument(),
    )
    expect(consoleSpy).toHaveBeenCalled()
    consoleSpy.mockRestore()
  })
})
