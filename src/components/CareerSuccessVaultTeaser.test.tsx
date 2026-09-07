import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { CareerSuccessVaultTeaser } from './CareerSuccessVaultTeaser'
import type { Badge, MemberBadge } from '@/types'

const { mockUseBadges } = vi.hoisted(() => ({ mockUseBadges: vi.fn() }))

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'user-1' } }),
}))

vi.mock('@/hooks/useBadges', () => ({
  useBadges: mockUseBadges,
}))

function makeBadge(overrides: Partial<Badge> = {}): Badge {
  return {
    id: 'badge-1',
    slug: 'first-application',
    name: 'First Application',
    description: 'Submitted your first application.',
    badge_type: 'achievement',
    color_scheme: 'green',
    icon: 'Award',
    sort_order: 1,
    is_active: true,
    created_at: '',
    ...overrides,
  } as Badge
}

function makeMemberBadge(badge: Badge): MemberBadge {
  return { id: `mb-${badge.id}`, user_id: 'user-1', badge_id: badge.id, awarded_at: '2026-01-01', badge } as MemberBadge
}

function renderTeaser() {
  return render(
    <MemoryRouter>
      <CareerSuccessVaultTeaser />
    </MemoryRouter>,
  )
}

describe('CareerSuccessVaultTeaser', () => {
  it('shows a concise summary (count + most recent badge) when badges are earned', async () => {
    const badge = makeBadge()
    mockUseBadges.mockReturnValue({ earnedBadges: [makeMemberBadge(badge)], loading: false })

    renderTeaser()

    await waitFor(() => expect(screen.getByText('1 badge earned.')).toBeInTheDocument())
    expect(screen.getByText('Most recent: First Application')).toBeInTheDocument()
    // Concise summary only -- must not render a full badge grid (no second
    // badge name, no locked/unearned badge listing).
    expect(screen.getAllByText(/First Application/).length).toBe(1)
    expect(screen.getByRole('link', { name: /View Achievement Vault/i })).toHaveAttribute('href', '/achievement-vault')
  })

  it('pluralizes correctly for multiple earned badges', async () => {
    const b1 = makeBadge({ id: 'b1', name: 'First Application' })
    const b2 = makeBadge({ id: 'b2', name: 'First Interview' })
    mockUseBadges.mockReturnValue({ earnedBadges: [makeMemberBadge(b2), makeMemberBadge(b1)], loading: false })

    renderTeaser()

    await waitFor(() => expect(screen.getByText('2 badges earned.')).toBeInTheDocument())
    expect(screen.getByText('Most recent: First Interview')).toBeInTheDocument()
  })

  it('shows the honest empty state when zero badges are earned', async () => {
    mockUseBadges.mockReturnValue({ earnedBadges: [], loading: false })

    renderTeaser()

    await waitFor(() =>
      expect(
        screen.getByText(/No badges earned yet\. Complete your Career Profile and land your first interview/),
      ).toBeInTheDocument(),
    )
  })

  it('shows a loading state while badges are being fetched', () => {
    mockUseBadges.mockReturnValue({ earnedBadges: [], loading: true })

    renderTeaser()

    expect(screen.getByText('Your evidence')).toBeInTheDocument()
    expect(screen.queryByText(/No badges earned yet/)).not.toBeInTheDocument()
  })
})
