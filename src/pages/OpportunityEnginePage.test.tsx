import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { OpportunityEnginePage } from './OpportunityEnginePage'
import type { JobMatchWithJob } from '@/types'

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'user-1' }, profile: { user_id: 'user-1' } }),
}))

const { mockGetJobMatches } = vi.hoisted(() => ({ mockGetJobMatches: vi.fn() }))

vi.mock('@/lib/opportunityEngine', () => ({
  getJobMatches: mockGetJobMatches,
  dismissJobMatch: vi.fn(),
}))

function makeMatch(
  id: string,
  postingUrl: string,
  overrides: Omit<Partial<JobMatchWithJob>, 'scraped_job'> & { scraped_job?: Partial<JobMatchWithJob['scraped_job']> } = {}
): JobMatchWithJob {
  const { scraped_job, ...matchOverrides } = overrides
  return {
    id, member_id: 'user-1', scraped_job_id: `job-${id}`, fresh_fit_score: 60,
    matched_skills: [], missing_skills: [], score_breakdown: {}, dismissed_at: null,
    promoted_opportunity_id: null, computed_at: '2026-01-01',
    scraped_job: {
      id: `job-${id}`, source: 'member-submitted', external_id: id, title: `Job ${id}`, company: 'Acme',
      location: null, description: '', salary_text: null, employment_type: null, posting_url: postingUrl,
      posted_at: null, search_query: null, is_active: true, scraped_at: '', created_at: '',
      ...scraped_job,
    },
    ...matchOverrides,
  }
}

function renderPage() {
  return render(
    <MemoryRouter>
      <OpportunityEnginePage />
    </MemoryRouter>,
  )
}

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

describe('OpportunityEnginePage - empty state', () => {
  it('shows the richer empty state explaining Opportunity Engine and FreshFit when there are no matches', async () => {
    mockGetJobMatches.mockResolvedValue([])

    renderPage()

    await waitFor(() => expect(screen.getByText('No matches yet')).toBeInTheDocument())
    expect(screen.getByText(/0.100 fit score/i)).toBeInTheDocument()
  })
})

describe('OpportunityEnginePage - dismiss action preserved', () => {
  it('removes a match from the list when its dismiss button is clicked', async () => {
    mockGetJobMatches.mockResolvedValue([makeMatch('one', 'https://example.com/1')])

    renderPage()

    await waitFor(() => expect(screen.getByText('Job one')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: /dismiss/i }))

    await waitFor(() => expect(screen.queryByText('Job one')).not.toBeInTheDocument())
  })
})

describe('OpportunityEnginePage - Submit a Job action preserved', () => {
  it('opens the Submit a Job modal', async () => {
    mockGetJobMatches.mockResolvedValue([])

    renderPage()

    await waitFor(() => expect(screen.getByText('No matches yet')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: /submit a job/i }))

    expect(screen.getByRole('heading', { name: 'Submit a Job' })).toBeInTheDocument()
  })
})

describe('OpportunityEnginePage - promoted match presentation', () => {
  it('shows the Sent to Strategist indicator while keeping dismiss available', async () => {
    mockGetJobMatches.mockResolvedValue([
      makeMatch('promoted', 'https://example.com/1', { promoted_opportunity_id: 'opp-1' }),
    ])

    renderPage()

    await waitFor(() => expect(screen.getByText('Job promoted')).toBeInTheDocument())
    expect(screen.getByText(/sent to strategist/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /dismiss/i })).toBeInTheDocument()
  })
})

describe('OpportunityEnginePage - filter combinations', () => {
  it('narrows the list with the Remote toggle and shows a no-results message with no matches out of the box', async () => {
    mockGetJobMatches.mockResolvedValue([
      makeMatch('remote', 'https://example.com/1', { fresh_fit_score: 90, scraped_job: { location: 'Remote' } }),
      makeMatch('onsite', 'https://example.com/2', { fresh_fit_score: 40, scraped_job: { location: 'Chicago, IL' } }),
    ])

    renderPage()

    await waitFor(() => expect(screen.getByText('Job remote')).toBeInTheDocument())
    expect(screen.getByText('Job onsite')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /^remote$/i }))

    expect(screen.getByText('Job remote')).toBeInTheDocument()
    expect(screen.queryByText('Job onsite')).not.toBeInTheDocument()
  })

  it('shows a no-results message (not the full empty state) when filters exclude every match', async () => {
    mockGetJobMatches.mockResolvedValue([
      makeMatch('onsite', 'https://example.com/1', { scraped_job: { location: 'Chicago, IL' } }),
    ])

    renderPage()

    await waitFor(() => expect(screen.getByText('Job onsite')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: /^remote$/i }))

    expect(screen.queryByText('Job onsite')).not.toBeInTheDocument()
    expect(screen.getByText(/no matches (match|found)/i)).toBeInTheDocument()
  })
})
