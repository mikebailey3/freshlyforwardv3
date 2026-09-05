import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
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
