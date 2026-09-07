import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { CareerSuccessPage } from './CareerSuccessPage'

// This file locks down CareerSuccessPage's pre-redesign behavior (catalog
// rendering, feature-gated locked/unlocked cards, the UpgradeModal wiring,
// and the coming-soon ribbon) BEFORE any structural change, per Sub-Project
// 7 Task 1. These assertions must keep passing through every later task in
// this sub-project -- they are the regression tripwire for this page's real
// business logic (the itemFeatureMap/featureRequiredPlan dictionaries and
// the canAccess-driven render branch), which is not allowed to change.

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'user-1' },
    profile: { full_name: 'Jordan Rivera', plan_id: null, subscription_status: 'active' },
  }),
}))

const { mockCanAccess } = vi.hoisted(() => ({ mockCanAccess: vi.fn() }))

vi.mock('@/hooks/useEntitlements', () => ({
  useEntitlements: () => ({ canAccess: mockCanAccess, getFeature: () => undefined }),
}))

vi.mock('@/lib/supabase', () => {
  // Generic chainable, thenable query-builder double -- every method
  // (select/eq/order/limit/maybeSingle) returns itself, and it resolves to
  // an empty result when awaited. Needed because this page also renders the
  // real MemberLayout (messages/notifications/plan lookups), which builds
  // its own differently-shaped query chains than the page's own
  // career_success_items query.
  const builder: Record<string, unknown> = {}
  const chain = () => builder
  builder.select = chain
  builder.eq = chain
  builder.order = chain
  builder.limit = chain
  builder.maybeSingle = () => Promise.resolve({ data: null, error: null })
  builder.then = (resolve: (value: { data: unknown; count: number; error: null }) => void) =>
    resolve({ data: mockItems, count: 0, error: null })
  return { supabase: { from: () => builder } }
})

// Mutable fixture the mocked supabase builder above reads from -- reassigned
// per test via setItems().
let mockItems: Record<string, unknown>[] = []
function setItems(items: Record<string, unknown>[]) {
  mockItems = items
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/career-success']}>
      <CareerSuccessPage />
    </MemoryRouter>,
  )
}

describe('CareerSuccessPage (baseline, pre-redesign)', () => {
  it('renders an unlocked catalog item (no matching featureKey) as a plain content card', async () => {
    mockCanAccess.mockReturnValue(true)
    setItems([
      { id: '1', title: 'Something Unmapped', description: 'Not in the feature map.', icon: 'Sparkles', is_coming_soon: false },
    ])

    renderPage()

    await waitFor(() => expect(screen.getByText('Something Unmapped')).toBeInTheDocument())
    expect(screen.getByText('Not in the feature map.')).toBeInTheDocument()
    expect(screen.queryByText('Upgrade to unlock')).not.toBeInTheDocument()
  })

  it('renders a locked catalog item as LockedFeatureCard when canAccess is false', async () => {
    mockCanAccess.mockReturnValue(false)
    setItems([
      { id: '2', title: 'Promotion Planning', description: 'Plan your next promotion.', icon: 'TrendingUp', is_coming_soon: false },
    ])

    renderPage()

    await waitFor(() => expect(screen.getByText('Promotion Planning')).toBeInTheDocument())
    expect(screen.getByText('Upgrade to unlock')).toBeInTheDocument()
  })

  it('opens the UpgradeModal with the correct feature/plan when a locked card is clicked', async () => {
    mockCanAccess.mockReturnValue(false)
    setItems([
      { id: '3', title: 'Salary Coaching', description: 'Negotiate with confidence.', icon: 'DollarSign', is_coming_soon: false },
    ])

    renderPage()

    await waitFor(() => expect(screen.getByText('Salary Coaching')).toBeInTheDocument())
    fireEvent.click(screen.getByText('Salary Coaching'))

    await waitFor(() => expect(screen.getByText('Included with')).toBeInTheDocument())
    expect(screen.getByText('Career Concierge')).toBeInTheDocument()
  })

  it('renders the coming-soon ribbon and notice for is_coming_soon items', async () => {
    mockCanAccess.mockReturnValue(true)
    setItems([
      { id: '4', title: 'Quarterly Career Reviews', description: 'Regular check-ins.', icon: 'Sparkles', is_coming_soon: true },
    ])

    renderPage()

    await waitFor(() => expect(screen.getByText('Quarterly Career Reviews')).toBeInTheDocument())
    expect(screen.getByText('Coming Soon')).toBeInTheDocument()
    expect(screen.getByText(/This feature is in development/)).toBeInTheDocument()
  })

  it('renders the bottom CTA banner copy', async () => {
    mockCanAccess.mockReturnValue(true)
    setItems([])

    renderPage()

    await waitFor(() =>
      expect(screen.getByText('Your career does not stop at your next job.')).toBeInTheDocument(),
    )
    expect(screen.getByText(/FreshlyForward is built for long-term career success/)).toBeInTheDocument()
  })

  it('renders the page heading', async () => {
    mockCanAccess.mockReturnValue(true)
    setItems([])

    renderPage()

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Career Success' })).toBeInTheDocument())
  })
})
