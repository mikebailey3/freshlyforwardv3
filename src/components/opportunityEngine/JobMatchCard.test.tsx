import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { JobMatchCard } from './JobMatchCard'
import type { JobMatchWithJob } from '@/types'

function makeMatch(overrides: Partial<JobMatchWithJob> = {}): JobMatchWithJob {
  return {
    id: 'match-1', member_id: 'user-1', scraped_job_id: 'job-1', fresh_fit_score: 82,
    matched_skills: ['SQL', 'Forecasting'], missing_skills: [], score_breakdown: {},
    dismissed_at: null, promoted_opportunity_id: null, computed_at: '2026-01-01', engine_version: 2,
    scraped_job: {
      id: 'job-1', source: 'member-submitted', external_id: '1', title: 'Regional Sales Manager',
      company: 'Acme Co', location: 'Remote', description: '', salary_text: '$95k-$115k',
      employment_type: null, posting_url: 'https://example.com/job/1', posted_at: null,
      search_query: null, is_active: true, scraped_at: '', created_at: '',
    },
    ...overrides,
  }
}

describe('JobMatchCard', () => {
  it('renders job details, matched skills, and the FreshFit score badge', () => {
    render(<JobMatchCard match={makeMatch()} onDismiss={vi.fn()} />)
    expect(screen.getByText('Regional Sales Manager')).toBeInTheDocument()
    expect(screen.getByText('Acme Co')).toBeInTheDocument()
    expect(screen.getByText('SQL')).toBeInTheDocument()
    expect(screen.getByText(/FreshFit 82/i)).toBeInTheDocument()
  })

  it('calls onDismiss with the match id when the dismiss button is clicked', () => {
    const onDismiss = vi.fn()
    render(<JobMatchCard match={makeMatch()} onDismiss={onDismiss} />)
    fireEvent.click(screen.getByRole('button', { name: /dismiss match/i }))
    expect(onDismiss).toHaveBeenCalledWith('match-1')
  })

  it('shows a "Sent to Strategist" tag only when the match has been promoted', () => {
    const { rerender } = render(<JobMatchCard match={makeMatch()} onDismiss={vi.fn()} />)
    expect(screen.queryByText('Sent to Strategist')).not.toBeInTheDocument()

    rerender(<JobMatchCard match={makeMatch({ promoted_opportunity_id: 'opp-1' })} onDismiss={vi.fn()} />)
    expect(screen.getByText('Sent to Strategist')).toBeInTheDocument()
  })
})

// OE 2.0 Phase 4: personalized ranking surfaces on the member-facing card.
describe('JobMatchCard - OE 2.0 Phase 4 ranking props', () => {
  it('shows a "Top Pick" badge only when topPick is true and the match is not flagged', () => {
    render(<JobMatchCard match={makeMatch()} onDismiss={vi.fn()} topPick />)
    expect(screen.getByText('Top Pick')).toBeInTheDocument()
  })

  it('never shows "Top Pick" on a flagged match, even if topPick is true -- a flagged match is never presented as a shining pick', () => {
    render(<JobMatchCard match={makeMatch()} onDismiss={vi.fn()} topPick needsReview />)
    expect(screen.queryByText('Top Pick')).not.toBeInTheDocument()
    expect(screen.getByText('Needs review')).toBeInTheDocument()
  })

  it('renders the rank highlight line only when one is provided', () => {
    const { rerender } = render(<JobMatchCard match={makeMatch()} onDismiss={vi.fn()} />)
    expect(screen.queryByText(/Why it's ranked here/i)).not.toBeInTheDocument()

    rerender(<JobMatchCard match={makeMatch()} onDismiss={vi.fn()} rankHighlight="posted in the last 3 days" />)
    expect(screen.getByText(/posted in the last 3 days/i)).toBeInTheDocument()
  })
})
