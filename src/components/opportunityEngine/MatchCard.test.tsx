import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MatchCard } from './MatchCard'
import type { JobMatchWithJob } from '@/types'

function makeMatch(overrides: Omit<Partial<JobMatchWithJob>, 'scraped_job'> & { scraped_job?: Partial<JobMatchWithJob['scraped_job']> } = {}): JobMatchWithJob {
  const { scraped_job, ...matchOverrides } = overrides
  return {
    id: 'm1', member_id: 'user-1', scraped_job_id: 'job-1', fresh_fit_score: 90,
    matched_skills: ['React', 'TypeScript'], missing_skills: [], score_breakdown: {},
    dismissed_at: null, promoted_opportunity_id: null, computed_at: '2026-01-01',
    scraped_job: {
      id: 'job-1', source: 'greenhouse', external_id: 'e1', title: 'Senior Engineer', company: 'Acme',
      location: 'Remote', description: '', salary_text: '$150k', employment_type: 'Full-time',
      posting_url: 'https://example.com/job/1', posted_at: null, search_query: null,
      is_active: true, scraped_at: '2026-01-01', created_at: '2026-01-01',
      ...scraped_job,
    },
    ...matchOverrides,
  }
}

describe('MatchCard', () => {
  it('renders the job title, company, FreshFit score, and matched skills', () => {
    render(<MatchCard match={makeMatch()} onDismiss={vi.fn()} />)
    expect(screen.getByText('Senior Engineer')).toBeInTheDocument()
    expect(screen.getByText('Acme')).toBeInTheDocument()
    expect(screen.getByText('90')).toBeInTheDocument()
    expect(screen.getByText('React')).toBeInTheDocument()
  })

  it('calls onDismiss with the match id when the dismiss button is clicked', async () => {
    const onDismiss = vi.fn()
    render(<MatchCard match={makeMatch({ id: 'to-dismiss' })} onDismiss={onDismiss} />)
    screen.getByRole('button', { name: /dismiss/i }).click()
    expect(onDismiss).toHaveBeenCalledWith('to-dismiss')
  })

  it('shows View Posting only for a safe https URL', () => {
    render(<MatchCard match={makeMatch({ scraped_job: { posting_url: 'javascript:alert(1)' } })} onDismiss={vi.fn()} />)
    expect(screen.queryByRole('link', { name: /view posting/i })).not.toBeInTheDocument()
  })

  it('shows a "Sent to Strategist" indicator and de-emphasized styling for promoted matches, while keeping dismiss available', () => {
    render(<MatchCard match={makeMatch({ promoted_opportunity_id: 'opp-1' })} onDismiss={vi.fn()} />)
    expect(screen.getByText(/sent to strategist/i)).toBeInTheDocument()
    // Dismiss must still work on promoted matches -- current production
    // behavior preserved exactly, no new restriction introduced.
    expect(screen.getByRole('button', { name: /dismiss/i })).toBeInTheDocument()
  })
})
