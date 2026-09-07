import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { AchievementVaultPage } from './AchievementVaultPage'
import type { Badge, MemberBadge } from '@/types'

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'user-1' }, profile: { user_id: 'user-1' } }),
}))

const { mockFrom } = vi.hoisted(() => ({ mockFrom: vi.fn() }))

vi.mock('@/lib/supabase', () => ({
  supabase: { from: mockFrom },
}))

function makeBadge(overrides: Partial<Badge>): Badge {
  return {
    id: overrides.id ?? 'badge-1', slug: overrides.slug ?? 'vault-test-membership-badge', name: 'Vault Test Membership Badge',
    description: 'A fixture badge used only in this test file.', badge_type: 'membership', color_scheme: 'gold',
    icon: 'Award', sort_order: 1, is_active: true, created_at: '',
    ...overrides,
  } as Badge
}

function makeMemberBadge(badge: Badge): MemberBadge {
  return {
    id: `mb-${badge.id}`, user_id: 'user-1', badge_id: badge.id, awarded_at: '2026-01-01', badge,
  } as unknown as MemberBadge
}

/** Minimal chainable Supabase query-builder double, thenable like the
 * real one, matching the pattern already used by DashboardPage.test.tsx. */
function makeBuilder(data: unknown) {
  const builder: Record<string, unknown> = {}
  const chain = () => builder
  builder.select = chain
  builder.eq = chain
  builder.order = chain
  builder.then = (resolve: (value: { data: unknown; error: null }) => void) => resolve({ data, error: null })
  return builder
}

function setUpBadges(allBadges: Badge[], earned: Badge[]) {
  mockFrom.mockImplementation((table: string) => {
    if (table === 'badges') return makeBuilder(allBadges)
    if (table === 'member_badges') return makeBuilder(earned.map(makeMemberBadge))
    return makeBuilder([])
  })
}

function renderPage() {
  return render(
    <MemoryRouter>
      <AchievementVaultPage />
    </MemoryRouter>,
  )
}

describe('AchievementVaultPage', () => {
  it('shows the earned/total count and renders both membership and achievement sections', async () => {
    const membership = makeBadge({ id: 'm1', slug: 'vault-test-membership-badge', badge_type: 'membership', name: 'Vault Test Membership Badge' })
    const achievement = makeBadge({ id: 'a1', slug: 'first-application', badge_type: 'achievement', name: 'First Application' })
    setUpBadges([membership, achievement], [membership])

    renderPage()

    await waitFor(() => expect(screen.getByText('1 of 2 badges earned. Every badge is earned through real progress.')).toBeInTheDocument())
    expect(screen.getByText('Membership Badges')).toBeInTheDocument()
    expect(screen.getByText('Achievement Badges')).toBeInTheDocument()
    expect(screen.getAllByText('Vault Test Membership Badge').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('First Application')).toBeInTheDocument()
  })

  it('shows the empty state only when zero badges have been earned', async () => {
    const achievement = makeBadge({ id: 'a1', slug: 'first-application', badge_type: 'achievement', name: 'First Application' })
    setUpBadges([achievement], [])

    renderPage()

    await waitFor(() => expect(screen.getByText("You haven't earned any badges yet. Complete your Career Profile, submit applications, and land interviews to start unlocking achievements.")).toBeInTheDocument())
  })

  it('does not show the empty state once at least one badge is earned', async () => {
    const achievement = makeBadge({ id: 'a1', slug: 'first-application', badge_type: 'achievement', name: 'First Application' })
    setUpBadges([achievement], [achievement])

    renderPage()

    await waitFor(() => expect(screen.getByText('First Application')).toBeInTheDocument())
    expect(screen.queryByText(/haven't earned any badges yet/)).not.toBeInTheDocument()
  })
})
