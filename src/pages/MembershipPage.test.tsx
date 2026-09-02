// src/pages/MembershipPage.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { MembershipPage } from './MembershipPage'

const { mockRefreshProfile } = vi.hoisted(() => ({
  mockRefreshProfile: vi.fn().mockResolvedValue(undefined),
}))

// A stable, non-fresh profile object -- MembershipPage's plan-lookup effect
// depends on `[user, profile]`, so a new object literal per render would
// re-fire that effect on every re-render (same trap documented in
// ForwardDnaPage.test.tsx).
const { mockAuthUser, mockAuthProfile } = vi.hoisted(() => ({
  mockAuthUser: { id: 'u1' },
  mockAuthProfile: { plan_id: 'plan-1', subscription_status: 'active' },
}))

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    user: mockAuthUser,
    profile: mockAuthProfile,
    session: { access_token: 'test-access-token' },
    refreshProfile: mockRefreshProfile,
  }),
}))

const testPlan = {
  id: 'plan-1',
  slug: 'career-growth',
  name: 'Career Growth',
  description: 'Growth plan',
  price_cents: 9900,
  interval: 'month',
  features: ['Feature A'],
  badge: null,
}

// Update is a spy so tests can assert this component never calls it
// directly for pause/resume/cancel anymore (the server now performs
// that write). MembershipPage wraps its content in the real MemberLayout,
// which independently fires its own membership_plans/messages/notifications
// queries with different chain shapes (.maybeSingle(), bare .then()) -- so
// this reuses the proven chainable+thenable query-builder double from
// ForwardDnaPage.test.tsx/DashboardPage.test.tsx, keyed per-table so
// membership_plans specifically resolves the test plan.
const { mockFrom, mockUpdate } = vi.hoisted(() => ({ mockFrom: vi.fn(), mockUpdate: vi.fn() }))

function makeBuilder(result: { data: unknown; error: null }, table: string) {
  const builder: Record<string, unknown> = {}
  const chain = () => builder
  builder.select = chain
  builder.eq = chain
  builder.order = chain
  builder.gte = chain
  builder.limit = chain
  builder.update = (...args: unknown[]) => {
    mockUpdate(table, ...args)
    return builder
  }
  builder.maybeSingle = () => Promise.resolve(result)
  builder.then = (resolve: (value: typeof result) => void) => resolve(result)
  return builder
}

mockFrom.mockImplementation((table: string) => {
  if (table === 'membership_plans') return makeBuilder({ data: testPlan, error: null }, table)
  return makeBuilder({ data: null, error: null }, table)
})

vi.mock('@/lib/supabase', () => ({
  supabase: { from: mockFrom },
}))

function renderPage() {
  return render(
    <MemoryRouter>
      <MembershipPage />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal('fetch', vi.fn())
  vi.stubGlobal('confirm', vi.fn().mockReturnValue(true))
})

describe('MembershipPage - handlePause', () => {
  it('sends { action: "pause" } in the POST body, never updates member_profiles directly, and calls refreshProfile on a fallback response', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ fallback: true }),
    } as Response)

    renderPage()

    await waitFor(() => expect(screen.getByText('Career Growth')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: /Pause Membership/i }))

    await waitFor(() => expect(mockRefreshProfile).toHaveBeenCalled())

    const [, options] = vi.mocked(fetch).mock.calls[0]
    expect(JSON.parse(options?.body as string)).toEqual({ action: 'pause' })
    expect(mockUpdate).not.toHaveBeenCalled()

    // The real session token -- not the anon key -- must identify the
    // caller for the edge function's auth.getUser() check.
    const headers = options?.headers as Record<string, string>
    expect(headers.Authorization).toBe('Bearer test-access-token')
  })
})

describe('MembershipPage - handleResume', () => {
  it('sends { action: "resume" } in the POST body, never updates member_profiles directly, and calls refreshProfile on a fallback response', async () => {
    mockAuthProfile.subscription_status = 'paused'
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ fallback: true }),
    } as Response)

    renderPage()

    await waitFor(() => expect(screen.getByText('Career Growth')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: /Resume Membership/i }))

    await waitFor(() => expect(mockRefreshProfile).toHaveBeenCalled())

    const [, options] = vi.mocked(fetch).mock.calls[0]
    expect(JSON.parse(options?.body as string)).toEqual({ action: 'resume' })
    expect(mockUpdate).not.toHaveBeenCalled()

    mockAuthProfile.subscription_status = 'active'
  })
})

describe('MembershipPage - handleCancel', () => {
  it('sends { action: "cancel" } in the POST body, never updates member_profiles directly, and calls refreshProfile on a fallback response', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ fallback: true }),
    } as Response)

    renderPage()

    await waitFor(() => expect(screen.getByText('Career Growth')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: /Cancel Membership/i }))

    await waitFor(() => expect(mockRefreshProfile).toHaveBeenCalled())

    const [, options] = vi.mocked(fetch).mock.calls[0]
    expect(JSON.parse(options?.body as string)).toEqual({ action: 'cancel' })
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('redirects to the Stripe URL when the server returns one, without touching member_profiles or calling refreshProfile', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ url: 'https://stripe.example/portal' }),
    } as Response)

    const originalLocation = window.location
    // @ts-expect-error -- redefining window.location for this test only
    delete window.location
    // @ts-expect-error -- minimal stub, only `href` is used by the component
    window.location = { href: '' }

    renderPage()

    await waitFor(() => expect(screen.getByText('Career Growth')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: /Cancel Membership/i }))

    await waitFor(() => expect(window.location.href).toBe('https://stripe.example/portal'))
    expect(mockUpdate).not.toHaveBeenCalled()
    expect(mockRefreshProfile).not.toHaveBeenCalled()

    // @ts-expect-error -- restoring the original window.location object
    window.location = originalLocation
  })
})

describe('MembershipPage - handlePortal (unchanged, no action sent)', () => {
  it('still sends no body at all for the plain "Manage Billing" button', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ url: 'https://stripe.example/portal' }),
    } as Response)

    const originalLocation = window.location
    // @ts-expect-error -- redefining window.location for this test only
    delete window.location
    // @ts-expect-error -- minimal stub, only `href` is used by the component
    window.location = { href: '' }

    renderPage()

    await waitFor(() => expect(screen.getByText('Career Growth')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: /Manage Billing in Stripe Portal/i }))

    await waitFor(() => expect(window.location.href).toBe('https://stripe.example/portal'))
    const [, options] = vi.mocked(fetch).mock.calls[0]
    expect(options?.body).toBeUndefined()

    // @ts-expect-error -- restoring the original window.location object
    window.location = originalLocation
  })
})
