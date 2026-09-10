import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { StrategistOpportunityEnginePage } from './StrategistOpportunityEnginePage'
import type { JobMatchScoreBreakdown, JobMatchWithJob } from '@/types'

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'strategist-1' }, role: 'strategist' }),
}))

vi.mock('@/lib/operations', () => ({
  getAssignedMembers: vi.fn().mockResolvedValue([{ member_id: 'member-1' }]),
}))

const { mockFrom } = vi.hoisted(() => ({ mockFrom: vi.fn() }))
vi.mock('@/lib/supabase', () => ({ supabase: { from: mockFrom } }))

const { mockGetJobMatchesForStrategist, mockPromoteMatch } = vi.hoisted(() => ({
  mockGetJobMatchesForStrategist: vi.fn(),
  mockPromoteMatch: vi.fn(),
}))

vi.mock('@/lib/opportunityEngine', async () => {
  const actual = await vi.importActual<typeof import('@/lib/opportunityEngine')>('@/lib/opportunityEngine')
  return {
    ...actual,
    getJobMatchesForStrategist: mockGetJobMatchesForStrategist,
    promoteMatchToOpportunity: mockPromoteMatch,
  }
})

function makeBreakdown(hasBlocker: boolean): JobMatchScoreBreakdown {
  return {
    skillsCoverage: 0, roleRelevance: 0, locationFit: 0, keywordDensity: 0,
    v2: {
      tier: 'good', confidence: 'high', dimensions: [],
      hardConstraints: hasBlocker
        ? [{ key: 'jobsToAvoidExclusion', label: 'Roles/Companies to Avoid', status: 'hard_blocker', reason: 'matches an avoided company' }]
        : [{ key: 'jobsToAvoidExclusion', label: 'Roles/Companies to Avoid', status: 'confirmed_match', reason: 'ok' }],
      unknowns: [],
      recommendation: { key: 'worth_a_look', headline: '', detail: '' },
    },
  }
}

function makeMatch(id: string, title: string, hasBlocker: boolean): JobMatchWithJob {
  return {
    id, member_id: 'member-1', scraped_job_id: `job-${id}`, fresh_fit_score: 70,
    matched_skills: [], missing_skills: [], score_breakdown: makeBreakdown(hasBlocker), dismissed_at: null,
    promoted_opportunity_id: null, computed_at: '2026-01-01', engine_version: 2,
    scraped_job: {
      id: `job-${id}`, source: 'greenhouse', external_id: id, title, company: 'Acme',
      location: null, description: '', salary_text: null, employment_type: null, posting_url: '',
      posted_at: null, search_query: null, is_active: true, scraped_at: '', created_at: '',
    },
  }
}

function renderPage() {
  return render(
    <MemoryRouter>
      <StrategistOpportunityEnginePage />
    </MemoryRouter>,
  )
}

describe('StrategistOpportunityEnginePage - OE 2.0 Phase 3 flagged matches', () => {
  it('shows a "Needs review" badge only on the match with a hard-constraint blocker', async () => {
    mockFrom.mockReturnValue({
      select: () => ({ in: () => Promise.resolve({ data: [{ user_id: 'member-1', full_name: 'Jane Doe' }] }) }),
    })
    mockGetJobMatchesForStrategist.mockResolvedValue([
      makeMatch('clean', 'Data Analyst', false),
      makeMatch('flagged', 'Call Center Rep', true),
    ])

    renderPage()

    await waitFor(() => expect(screen.getByText('Data Analyst')).toBeInTheDocument())
    expect(screen.getAllByText('Needs review')).toHaveLength(1)
  })

  it('does not render the "show flagged only" toggle when nothing is flagged', async () => {
    mockFrom.mockReturnValue({
      select: () => ({ in: () => Promise.resolve({ data: [{ user_id: 'member-1', full_name: 'Jane Doe' }] }) }),
    })
    mockGetJobMatchesForStrategist.mockResolvedValue([makeMatch('clean', 'Data Analyst', false)])

    renderPage()

    await waitFor(() => expect(screen.getByText('Data Analyst')).toBeInTheDocument())
    expect(screen.queryByText(/show flagged only/i)).not.toBeInTheDocument()
  })

  it('filters the grid down to only flagged matches when the toggle is checked', async () => {
    mockFrom.mockReturnValue({
      select: () => ({ in: () => Promise.resolve({ data: [{ user_id: 'member-1', full_name: 'Jane Doe' }] }) }),
    })
    mockGetJobMatchesForStrategist.mockResolvedValue([
      makeMatch('clean', 'Data Analyst', false),
      makeMatch('flagged', 'Call Center Rep', true),
    ])

    renderPage()

    await waitFor(() => expect(screen.getByText('Data Analyst')).toBeInTheDocument())
    expect(screen.getByText('Call Center Rep')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('checkbox', { name: /show flagged only/i }))

    await waitFor(() => expect(screen.queryByText('Data Analyst')).not.toBeInTheDocument())
    expect(screen.getByText('Call Center Rep')).toBeInTheDocument()
  })
})
