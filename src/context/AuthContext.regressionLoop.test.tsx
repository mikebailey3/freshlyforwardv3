import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import { useEffect } from 'react'
import { AuthProvider, useAuth } from './AuthContext'

// Regression test for the render-loop bug: `refreshProfile` used to be a
// plain function recreated on every AuthProvider render, so any consumer
// effect depending on it (DashboardPage, CareerProfilePage, ForwardDnaPage,
// OnboardingPage all do this in real code) would re-fire forever, each
// re-fire calling refreshProfile() -> fetchProfile() -> setProfile() ->
// another AuthProvider render -> a brand-new refreshProfile identity ->
// repeat. This test uses the REAL AuthProvider (not a mocked useAuth) with
// only the Supabase client mocked, same chainable-builder convention as
// DashboardPage.test.tsx.

const { mockFrom, mockGetSession, mockOnAuthStateChange, memberProfilesCallCount } = vi.hoisted(() => ({
  mockFrom: vi.fn(),
  mockGetSession: vi.fn(),
  mockOnAuthStateChange: vi.fn(),
  memberProfilesCallCount: { current: 0 },
}))

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: mockFrom,
    auth: {
      getSession: mockGetSession,
      onAuthStateChange: mockOnAuthStateChange,
    },
  },
}))

interface QueryResult {
  data: unknown
  error: null
}

/** Same minimal chainable Supabase query-builder double used in
 * DashboardPage.test.tsx: every chain method returns itself, and it's
 * also thenable so both `await builder` and `await builder.maybeSingle()`
 * resolve. */
function makeBuilder(result: QueryResult) {
  const builder: Record<string, unknown> = {}
  const chain = () => builder
  builder.select = chain
  builder.eq = chain
  builder.limit = chain
  builder.maybeSingle = () => Promise.resolve(result)
  builder.then = (resolve: (value: QueryResult) => void) => resolve(result)
  return builder
}

const FAKE_USER = { id: 'user-1', app_metadata: {} }
const FAKE_SESSION = { user: FAKE_USER }

beforeEach(() => {
  vi.clearAllMocks()
  memberProfilesCallCount.current = 0

  mockGetSession.mockResolvedValue({ data: { session: FAKE_SESSION } })
  mockOnAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } })

  mockFrom.mockImplementation((table: string) => {
    if (table === 'member_profiles') {
      memberProfilesCallCount.current += 1
      return makeBuilder({ data: { id: 'profile-1', user_id: 'user-1', is_strategist: false }, error: null })
    }
    // strategist_assignments (and anything else): harmless empty result.
    return makeBuilder({ data: [], error: null })
  })
})

/**
 * Mimics DashboardPage's real problematic pattern exactly: an effect
 * depending on `[user, refreshProfile]` from `useAuth()` that calls
 * `await refreshProfile()` inside itself. Before the fix, `refreshProfile`
 * gets a brand-new identity every single AuthProvider render (including
 * ones triggered by its own `setProfile` call), so this effect re-fires
 * without end.
 */
function DashboardLikeConsumer() {
  const { user, refreshProfile } = useAuth()

  useEffect(() => {
    if (!user) return
    void refreshProfile()
  }, [user, refreshProfile])

  return null
}

describe('AuthContext - refreshProfile render-loop regression', () => {
  it('queries member_profiles a small bounded number of times, not an unbounded/growing count', async () => {
    render(
      <AuthProvider>
        <DashboardLikeConsumer />
      </AuthProvider>,
    )

    // Expected exactly 2 calls once things settle:
    //   1. AuthProvider's own one-time mount effect fetches the profile
    //      once getSession() resolves and `user` is set.
    //   2. DashboardLikeConsumer's effect fires exactly once, when `user`
    //      first flips from null to the real user, and calls
    //      refreshProfile() itself.
    // With `fetchProfile` memoized on `[]` and `refreshProfile` memoized
    // on `[user, fetchProfile]` (both stable once `user` stops changing),
    // no further re-fires should happen -- this is the exact bounded
    // count the traced root-cause chain predicts.
    await waitFor(() => expect(memberProfilesCallCount.current).toBeGreaterThanOrEqual(1))

    // Give a runaway loop a real window to reveal itself: if
    // `refreshProfile` were still unstable, dozens-to-hundreds of extra
    // calls would pile up in this window.
    await new Promise((resolve) => setTimeout(resolve, 300))
    const settledCount = memberProfilesCallCount.current
    expect(settledCount).toBe(2)

    // Confirm the count has genuinely stopped growing, not just paused.
    await new Promise((resolve) => setTimeout(resolve, 300))
    expect(memberProfilesCallCount.current).toBe(settledCount)
  })
})
