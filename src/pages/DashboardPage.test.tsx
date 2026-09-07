import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
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

  it('renders the Career Vault placeholder card with no link inside the card itself pointing at /career-vault', async () => {
    setCompassRow(null)

    renderPage()

    // Career Vault now legitimately exists and is reachable via the shared
    // MemberLayout nav (recovered 2026-09-08) -- a page-wide "no anchor
    // anywhere links to /career-vault" check is stale now that a real,
    // intentional nav link exists. The invariant this placeholder card
    // actually needs to hold is narrower: it still renders its unchanged
    // "coming soon" content, and the CARD ITSELF still contains no link --
    // a shared/global nav link elsewhere on the page is fine and expected.
    const heading = await screen.findByRole('heading', { name: 'Career Vault \u2014 coming soon' })
    const description = screen.getByText('Track evidence-backed career wins here once Career Vault ships.')

    // Scope to the placeholder card's own DOM subtree by walking up from the
    // heading to the smallest ancestor that also encloses the description
    // text -- accessible-query-based and agnostic to exact wrapper-div
    // nesting depth, so it doesn't hard-code a brittle CSS class or a fixed
    // number of parentElement hops.
    let card: HTMLElement = heading
    while (!card.contains(description)) {
      if (!card.parentElement) {
        throw new Error('Could not find a shared ancestor for the Career Vault placeholder heading and description')
      }
      card = card.parentElement
    }

    const cardLinks = within(card).queryAllByRole('link')
    expect(cardLinks.some((a) => a.getAttribute('href') === '/career-vault')).toBe(false)
  })
})
