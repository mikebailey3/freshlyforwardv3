import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { CareerCompassResultsPage } from './CareerCompassResultsPage'
import type { ArchetypeResult, ReadinessResult, PlanRecommendation } from '@/types/careerCompass'

const { mockLocation, mockMaybeSingle } = vi.hoisted(() => ({
  mockLocation: { state: null as unknown },
  mockMaybeSingle: vi.fn(),
}))

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return { ...actual, useLocation: () => mockLocation }
})

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: mockMaybeSingle,
          })),
        })),
      })),
    })),
  },
}))

const archetype: ArchetypeResult = {
  dimensionScores: {
    peopleFocus: 50, leadershipDrive: 50, structurePreference: 50,
    ambiguityTolerance: 50, analyticalOrientation: 50, workPace: 50,
  },
  archetypeScores: { driver: 80, connector: 60, strategist: 40, builder: 30, explorer: 20, creator: 10 },
  primaryArchetype: 'driver',
  secondaryArchetype: 'connector',
}

const readiness: ReadinessResult = {
  dimensionScores: { careerDirection: 70, resumePositioning: 40, searchStrategy: 60, applicationResults: 50, interviewConfidence: 30 },
  supportNeed: 50,
  urgency: 50,
  transitionType: 'advancement',
  isComplexTransition: false,
  overallScore: 58,
  primaryBarrier: 'interviewPerformance',
  secondaryBarrier: 'resumePositioning',
}

const recommendation: PlanRecommendation = {
  planSlug: 'career-growth',
  serviceFitPct: 85,
  reasons: ['Interview performance is your biggest opportunity right now.'],
}

function renderPage(initialEntry = '/career-compass/results') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <CareerCompassResultsPage />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mockLocation.state = null
})

describe('CareerCompassResultsPage', () => {
  it('renders from location.state (fast path) without querying Supabase', async () => {
    mockLocation.state = { assessmentId: 'assess-1', archetype, readiness, recommendation }

    renderPage()

    expect(screen.getByText(/You're a Driver/)).toBeInTheDocument()
    expect(screen.getByText(/strong Connector traits/)).toBeInTheDocument()
    expect(screen.getByText('Forward Readiness: 58%')).toBeInTheDocument()
    expect(screen.getByText(/Interview confidence/)).toBeInTheDocument()
    expect(screen.getByText('Recommended: Career Growth')).toBeInTheDocument()
    expect(screen.getByText('Interview performance is your biggest opportunity right now.')).toBeInTheDocument()
    expect(mockMaybeSingle).not.toHaveBeenCalled()
  })

  it('falls back to a Supabase query when location.state is absent, using the assessmentId query param', async () => {
    mockMaybeSingle.mockResolvedValue({
      data: {
        dimension_scores: archetype.dimensionScores,
        archetype_scores: archetype.archetypeScores,
        primary_archetype: 'builder',
        secondary_archetype: 'explorer',
        readiness_scores: readiness.dimensionScores,
        primary_barrier: 'resumePositioning',
        secondary_barrier: 'searchStrategy',
        recommended_plan_slug: 'career-kickstart',
        service_fit_pct: 90,
        reasons: ['Your resume is holding back an otherwise clear direction.'],
      },
      error: null,
    })

    renderPage('/career-compass/results?assessmentId=assess-2')

    await waitFor(() => expect(screen.getByText(/You're a Builder/)).toBeInTheDocument())
    expect(screen.getByText(/strong Explorer traits/)).toBeInTheDocument()
    expect(screen.getByText('Recommended: Career Kickstart')).toBeInTheDocument()
    expect(screen.getByText('Your resume is holding back an otherwise clear direction.')).toBeInTheDocument()
    expect(mockMaybeSingle).toHaveBeenCalledTimes(1)
  })

  it('renders the empty state when neither location.state nor a valid query param yields a result', async () => {
    renderPage('/career-compass/results')

    expect(screen.getByText("We couldn't find those results.")).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Retake the assessment' })).toHaveAttribute('href', '/career-compass')
    expect(mockMaybeSingle).not.toHaveBeenCalled()
  })

  it('renders the empty state when the Supabase lookup returns nothing', async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: null })

    renderPage('/career-compass/results?assessmentId=missing')

    await waitFor(() => expect(screen.getByText("We couldn't find those results.")).toBeInTheDocument())
  })

  it('renders the empty state instead of stalling forever when the Supabase request itself rejects', async () => {
    mockMaybeSingle.mockRejectedValue(new Error('network down'))

    renderPage('/career-compass/results?assessmentId=assess-3')

    await waitFor(() => expect(screen.getByText("We couldn't find those results.")).toBeInTheDocument())
  })

  it('renders a positive framing, not a rejection, when planSlug is null', async () => {
    mockLocation.state = {
      assessmentId: 'assess-1',
      archetype,
      readiness,
      recommendation: { planSlug: null, serviceFitPct: 0, reasons: ['Your readiness is strong across the board.'] },
    }

    renderPage()

    expect(screen.getByText("You're in great shape -- no purchase needed right now.")).toBeInTheDocument()
    expect(screen.getByText('Your readiness is strong across the board.')).toBeInTheDocument()
    expect(screen.queryByText(/Recommended:/)).not.toBeInTheDocument()
  })

  it('shows the honest sign-in copy and correct CTAs', () => {
    mockLocation.state = { assessmentId: 'assess-1', archetype, readiness, recommendation }

    renderPage()

    expect(screen.getByRole('link', { name: 'Save My Career Compass' })).toHaveAttribute('href', '/signup?compass=1')
    const signInLink = screen.getByRole('link', { name: /Sign in instead/ })
    expect(signInLink).toHaveAttribute('href', '/signin?redirect=%2Fdashboard')
    // Regression guard: this href must never carry compass=saved -- doing so
    // would trigger the dashboard's "results saved" banner even though
    // signing in (as opposed to signing up) does NOT actually save this
    // result, directly contradicting the disclosure text right below it.
    expect(signInLink.getAttribute('href')).not.toContain('compass')
    expect(screen.getByText(/Signing in won't keep this specific result/)).toBeInTheDocument()
  })
})
