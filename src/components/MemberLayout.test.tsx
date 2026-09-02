import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { MemberLayout } from './MemberLayout'

// Task 7: the /dashboard nav item's label changed from 'Dashboard'
// (desktop sidebar) / 'Home' (mobile bottom nav) to 'ForwardOS Home' in
// both places -- this is the only change this task makes to this file,
// so this test is narrowly scoped to that one label, not full nav
// fidelity.

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
  useAuth: () => ({
    user: { id: 'user-1' },
    profile: { full_name: 'Ada Lovelace', plan_id: null },
    signOut: vi.fn().mockResolvedValue(undefined),
  }),
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

function renderLayout() {
  return render(
    <MemoryRouter>
      <MemberLayout>
        <div>page content</div>
      </MemberLayout>
    </MemoryRouter>,
  )
}

describe('MemberLayout - Task 7 nav label', () => {
  it('renders "ForwardOS Home" as the /dashboard nav label in both the desktop sidebar and mobile bottom nav', () => {
    renderLayout()

    const forwardOsHomeLinks = screen.getAllByText('ForwardOS Home')
    expect(forwardOsHomeLinks.length).toBe(2)
    forwardOsHomeLinks.forEach((el) => {
      expect(el.closest('a')).toHaveAttribute('href', '/dashboard')
    })
  })

  it('never renders the bare string "Dashboard" as a nav label', () => {
    renderLayout()

    expect(screen.queryByText('Dashboard')).not.toBeInTheDocument()
  })
})
