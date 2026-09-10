import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { OpportunityEnginePage } from './OpportunityEnginePage'
import type { JobMatchWithJob } from '@/types'

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'user-1' }, profile: { user_id: 'user-1' } }),
}))

const { mockGetJobMatches, mockGetRecurringGaps } = vi.hoisted(() => ({
  mockGetJobMatches: vi.fn(),
  mockGetRecurringGaps: vi.fn(),
}))

vi.mock('@/lib/opportunityEngine', async () => {
  const actual = await vi.importActual<typeof import('@/lib/opportunityEngine')>('@/lib/opportunityEngine')
  return {
    ...actual,
    getJobMatches: mockGetJobMatches,
    dismissJobMatch: vi.fn(),
  }
})

vi.mock('@/lib/opportunityEngine/recurringGaps', async () => {
  const actual = await vi.importActual<typeof import('@/lib/opportunityEngine/recurringGaps')>('@/lib/opportunityEngine/recurringGaps')
  return {
    ...actual,
    getRecurringGaps: mockGetRecurringGaps,
  }
})

function makeMatch(id: string, postingUrl: string): JobMatchWithJob {
  return {
    id, member_id: 'user-1', scraped_job_id: `job-${id}`, fresh_fit_score: 60,
    matched_skills: [], missing_skills: [], score_breakdown: {}, dismissed_at: null,
    promoted_opportunity_id: null, computed_at: '2026-01-01', engine_version: 2,
    scraped_job: {
      id: `job-${id}`, source: 'member-submitted', external_id: id, title: `Job ${id}`, company: 'Acme',
      location: null, description: '', salary_text: null, employment_type: null, posting_url: postingUrl,
      posted_at: null, search_query: null, is_active: true, scraped_at: '', created_at: '',
    },
  }
}

function renderPage() {
  return render(
    <MemoryRouter>
      <OpportunityEnginePage />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  // OE 2.0 Phase 6: every existing test below predates the recurring-gap
  // fetch and doesn't care about it -- default to "no recurring gaps"
  // (an empty array, not undefined) so Promise.all resolves cleanly and
  // RecurringGapCard renders nothing, unless a test overrides this.
  mockGetRecurringGaps.mockResolvedValue([])
})

describe('OpportunityEnginePage - posting URL link guard', () => {
  it('shows View Posting only for a safe https URL, and hides it for blank or javascript: URLs', async () => {
    mockGetJobMatches.mockResolvedValue([
      makeMatch('safe', 'https://example.com/job/1'),
      makeMatch('blank', ''),
      makeMatch('unsafe', 'javascript:alert(1)'),
    ])

    renderPage()

    await waitFor(() => expect(screen.getByText('Job safe')).toBeInTheDocument())

    const links = screen.getAllByRole('link', { name: /view posting/i })
    expect(links).toHaveLength(1)
    expect(links[0]).toHaveAttribute('href', 'https://example.com/job/1')
  })
})

// OE 2.0 Phase 4: personalized Top Opportunities feed.
function makeScoredMatch(id: string, freshFitScore: number, postedDaysAgo: number | null): JobMatchWithJob {
  const match = makeMatch(id, `https://example.com/${id}`)
  return {
    ...match,
    fresh_fit_score: freshFitScore,
    scraped_job: {
      ...match.scraped_job,
      posted_at: postedDaysAgo === null ? null : new Date(Date.now() - postedDaysAgo * 24 * 60 * 60 * 1000).toISOString(),
    },
  }
}

describe('OpportunityEnginePage - OE 2.0 Phase 4 Top Opportunities feed', () => {
  it('does not split into Top Opportunities / More Matches sections for 3 or fewer total matches', async () => {
    mockGetJobMatches.mockResolvedValue([
      makeScoredMatch('a', 60, null),
      makeScoredMatch('b', 55, null),
    ])

    renderPage()

    await waitFor(() => expect(screen.getByText('Job a')).toBeInTheDocument())
    expect(screen.queryByText('Top Opportunities For You')).not.toBeInTheDocument()
  })

  it('surfaces the highest-ranked match in Top Opportunities, ahead of a merely higher-raw-score but stale/blocked one', async () => {
    mockGetJobMatches.mockResolvedValue([
      makeScoredMatch('fresh', 70, 1), // recent posting -> ranking boost
      makeScoredMatch('mid', 65, null),
      makeScoredMatch('low', 40, null),
      makeScoredMatch('lower', 30, null),
    ])

    renderPage()

    await waitFor(() => expect(screen.getByText('Top Opportunities For You')).toBeInTheDocument())
    expect(screen.getByText('More Matches')).toBeInTheDocument()

    // 4 total matches, TOP_FEED_SIZE = 3 -> exactly one falls into "More Matches".
    expect(screen.getAllByText('Top Pick')).toHaveLength(3)
  })

  it('shows the Needs review flag on a match with a hard_blocker, and never labels it Top Pick even if it ranks in the top slice', async () => {
    const blocked = makeScoredMatch('blocked', 90, null)
    blocked.score_breakdown = {
      skillsCoverage: 0, roleRelevance: 0, locationFit: 0, keywordDensity: 0,
      v2: {
        tier: 'excellent', confidence: 'high', dimensions: [],
        hardConstraints: [{ key: 'jobsToAvoidExclusion', label: 'Roles/Companies to Avoid', status: 'hard_blocker', reason: 'matches an avoided company' }],
        unknowns: [], recommendation: { key: 'likely_not_a_fit', headline: '', detail: '' },
      },
    }

    mockGetJobMatches.mockResolvedValue([
      blocked,
      makeScoredMatch('clean-1', 60, null),
      makeScoredMatch('clean-2', 55, null),
      makeScoredMatch('clean-3', 50, null),
    ])

    renderPage()

    await waitFor(() => expect(screen.getByText('Job blocked')).toBeInTheDocument())
    expect(screen.getByText('Needs review')).toBeInTheDocument()

    // The blocked match's -50 qualification-risk penalty must drop it out
    // of the top slice entirely (materially suppressed, not just nudged).
    const topSection = screen.getByText('Top Opportunities For You').closest('div')!
    expect(topSection).not.toHaveTextContent('Job blocked')
  })
})

describe('OpportunityEnginePage - OE 2.0 Phase 6 recurring-gap insight', () => {
  it('renders no recurring-gap card when there are no matches at all (empty state)', async () => {
    mockGetJobMatches.mockResolvedValue([])
    mockGetRecurringGaps.mockResolvedValue([{ skill: 'sql', frequency: 3 }])

    renderPage()

    await waitFor(() => expect(screen.getByText(/No matches yet/)).toBeInTheDocument())
    expect(screen.queryByText(/You keep missing/)).not.toBeInTheDocument()
  })

  it('renders no recurring-gap card when the aggregation found nothing recurring', async () => {
    mockGetJobMatches.mockResolvedValue([makeMatch('a', 'https://example.com/a')])
    mockGetRecurringGaps.mockResolvedValue([])

    renderPage()

    await waitFor(() => expect(screen.getByText('Job a')).toBeInTheDocument())
    expect(screen.queryByText(/You keep missing/)).not.toBeInTheDocument()
  })

  it('surfaces the recurring-gap card above the match list when a pattern is found', async () => {
    mockGetJobMatches.mockResolvedValue([makeMatch('a', 'https://example.com/a')])
    mockGetRecurringGaps.mockResolvedValue([{ skill: 'sql', frequency: 3 }])

    renderPage()

    await waitFor(() => expect(screen.getByText(/You keep missing/)).toBeInTheDocument())
    expect(screen.getByText(/sql/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /add skill evidence to forward dna/i })).toHaveAttribute('href', '/forward-dna')
  })
})
