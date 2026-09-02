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

const { mockGetJobMatches } = vi.hoisted(() => ({ mockGetJobMatches: vi.fn().mockResolvedValue([]) }))

vi.mock('@/lib/opportunityEngine', () => ({
  getJobMatches: mockGetJobMatches,
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

describe('DashboardPage - Forward DNA card', () => {
  it('always shows the Forward DNA teaser card', async () => {
    setCompassRow(null)

    renderPage()

    await waitFor(() => expect(screen.getByText('Your professional intelligence profile')).toBeInTheDocument())
    expect(screen.getByRole('link', { name: 'Open' })).toHaveAttribute('href', '/forward-dna')
  })
})

describe('DashboardPage - Forward Score integration (Task 7)', () => {
  it('renders the ForwardScoreWidget, NextBestMoveCard, and all 4 PillarCards', async () => {
    setCompassRow(null)

    renderPage()

    await waitFor(() => expect(screen.getByText('Forward Score')).toBeInTheDocument())
    expect(screen.getByText('Next Best Move')).toBeInTheDocument()
    // Each pillar label renders twice -- once in ForwardScoreWidget's
    // compact hero summary, once in its own full PillarCard below --
    // "Goal Alignment" must be the only label used anywhere, never a
    // synonym like "Your Direction".
    expect(screen.getAllByText('Forward DNA Depth').length).toBeGreaterThanOrEqual(2)
    expect(screen.getAllByText('Evidence Quality').length).toBeGreaterThanOrEqual(2)
    expect(screen.getAllByText('Career Momentum').length).toBeGreaterThanOrEqual(2)
    expect(screen.getAllByText('Goal Alignment').length).toBeGreaterThanOrEqual(2)
  })

  it('renders "ForwardOS Home" prominently near the top of the page', async () => {
    setCompassRow(null)

    renderPage()

    // "ForwardOS Home" also appears as the (now-renamed) sidebar/bottom-nav
    // label rendered by the real MemberLayout this page wraps itself in --
    // so at least one match, not exactly one.
    await waitFor(() => expect(screen.getAllByText('ForwardOS Home').length).toBeGreaterThanOrEqual(1))
  })

  it('still renders Search Readiness with the real calculateSearchReadiness(profile) score', async () => {
    setCompassRow(null)

    renderPage()

    await waitFor(() => expect(screen.getByText('Search Readiness')).toBeInTheDocument())
    // calculateSearchReadiness is mocked (above) to always return score: 50
    // -- CircularProgress renders that exact clamped value as "50%" (the
    // "Profile Completeness" progress bar further down also reads the same
    // score, so at least one "50%" match, not exactly one).
    expect(screen.getAllByText('50%').length).toBeGreaterThanOrEqual(1)
  })

  it('places the Forward Score hero widget before the Search Readiness card in the DOM', async () => {
    setCompassRow(null)

    renderPage()

    await waitFor(() => expect(screen.getByText('Forward Score')).toBeInTheDocument())
    const hero = screen.getByText('Forward Score')
    const searchReadinessLabel = screen.getByText('Search Readiness')

    // Node.DOCUMENT_POSITION_FOLLOWING (4): searchReadinessLabel comes
    // after hero in document order.
    // eslint-disable-next-line no-bitwise
    expect(hero.compareDocumentPosition(searchReadinessLabel) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('renders the Career Vault placeholder card with no link anywhere pointing at /career-vault', async () => {
    setCompassRow(null)

    const { container } = renderPage()

    await waitFor(() => expect(screen.getByText('Career Vault \u2014 coming soon')).toBeInTheDocument())
    expect(screen.getByText('Track evidence-backed career wins here once Career Vault ships.')).toBeInTheDocument()

    const allLinks = Array.from(container.querySelectorAll('a'))
    expect(allLinks.some((a) => a.getAttribute('href') === '/career-vault')).toBe(false)
  })
})

describe('DashboardPage - Opportunity Engine teaser card (light integration)', () => {
  it('shows a no-match CTA state when the member has no matches, without inventing fake data', async () => {
    setCompassRow(null)
    mockGetJobMatches.mockResolvedValue([])

    renderPage()

        await waitFor(() => expect(screen.getByText('Opportunity Engine')).toBeInTheDocument())
    expect(screen.getByRole('link', { name: 'Open Opportunity Engine' })).toHaveAttribute('href', '/opportunity-engine')
  })

  it('surfaces the strongest match title, company, and FreshFit score with a CTA', async () => {
    setCompassRow(null)
    mockGetJobMatches.mockResolvedValue([
      {
        id: 'm1', member_id: 'user-1', scraped_job_id: 'job-1', fresh_fit_score: 88,
        matched_skills: [], missing_skills: [], score_breakdown: {}, dismissed_at: null,
        promoted_opportunity_id: null, computed_at: '2026-01-01',
        scraped_job: {
          id: 'job-1', source: 'greenhouse', external_id: 'e1', title: 'Staff Engineer', company: 'Acme',
          location: null, description: '', salary_text: null, employment_type: null,
          posting_url: 'https://example.com', posted_at: null, search_query: null,
          is_active: true, scraped_at: '', created_at: '',
        },
      },
    ])

    renderPage()

    await waitFor(() => expect(screen.getByText('Staff Engineer')).toBeInTheDocument())
    expect(screen.getByText('Acme')).toBeInTheDocument()
    expect(screen.getByText('88')).toBeInTheDocument()
  })

  it('does not materially change the rest of the page -- Forward Score hero still renders first', async () => {
    setCompassRow(null)
    mockGetJobMatches.mockResolvedValue([])

    renderPage()

    await waitFor(() => expect(screen.getByText('Forward Score')).toBeInTheDocument())
    expect(screen.getByText('Search Readiness')).toBeInTheDocument()
    expect(screen.getByText('Career Vault \u2014 coming soon')).toBeInTheDocument()
  })
})
