import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { DashboardPage } from './DashboardPage'
import type { ArchetypeKey } from '@/types/careerCompass'

// This test only exercises the Career Compass card added to DashboardPage --
// not full dashboard fidelity. Everything else the page fetches is mocked
// to resolve to harmless empty values so the page clears its top-level
// `loading` gate quickly.

const { mockFrom } = vi.hoisted(() => ({ mockFrom: vi.fn() }))

vi.mock('@/lib/supabase', () => ({
  supabase: { from: mockFrom },
}))

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'user-1' },
    profile: { full_name: 'Ada Lovelace', plan_id: null, subscription_status: 'active' },
    refreshProfile: vi.fn().mockResolvedValue(undefined),
  }),
}))

vi.mock('@/hooks/useEntitlements', () => ({
  useEntitlements: () => ({ canAccess: () => false }),
}))

vi.mock('@/lib/profile', () => ({
  ensureProfile: vi.fn().mockResolvedValue(undefined),
  calculateSearchReadiness: () => ({ score: 50, missing: [] }),
  getReadinessFixLink: () => '/profile',
}))

vi.mock('@/lib/blog', () => ({
  getRecentPublishedPosts: vi.fn().mockResolvedValue([]),
}))

interface QueryResult {
  data: unknown
  error: null
}

/** Minimal chainable Supabase query-builder double: every chain method
 * returns itself, and it's also thenable (like the real query builder)
 * so both `await builder` and `await builder.maybeSingle()` resolve. */
function makeBuilder(result: QueryResult) {
  const builder: Record<string, unknown> = {}
  const chain = () => builder
  builder.select = chain
  builder.eq = chain
  builder.order = chain
  builder.gte = chain
  builder.limit = chain
  builder.maybeSingle = () => Promise.resolve(result)
  builder.then = (resolve: (value: QueryResult) => void) => resolve(result)
  return builder
}

function setCompassRow(row: { primary_archetype: ArchetypeKey; recommended_plan_slug: string | null } | null) {
  mockFrom.mockImplementation((table: string) => {
    if (table === 'career_compass_results') {
      return makeBuilder({ data: row, error: null })
    }
    return makeBuilder({ data: [], error: null })
  })
}

function renderPage() {
  return render(
    <MemoryRouter>
      <DashboardPage />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('DashboardPage - Career Compass card', () => {
  it('shows the Discover CTA linking to /career-compass when no result row exists', async () => {
    setCompassRow(null)

    renderPage()

    await waitFor(() => expect(screen.getByText('Discover your Career Compass')).toBeInTheDocument())
    expect(screen.getByRole('link', { name: 'Start Now' })).toHaveAttribute('href', '/career-compass')
    expect(screen.queryByRole('link', { name: 'Retake' })).not.toBeInTheDocument()
  })

  it('shows the primary archetype label and a Retake link when a result row exists', async () => {
    setCompassRow({ primary_archetype: 'driver', recommended_plan_slug: 'career-growth' })

    renderPage()

    await waitFor(() => expect(screen.getByText("You're a Driver.")).toBeInTheDocument())
    expect(screen.getByRole('link', { name: 'Retake' })).toHaveAttribute('href', '/career-compass')
    expect(screen.queryByText('Discover your Career Compass')).not.toBeInTheDocument()
  })
})
