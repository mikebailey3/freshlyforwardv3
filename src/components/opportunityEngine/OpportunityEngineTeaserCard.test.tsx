import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { OpportunityEngineTeaserCard } from './OpportunityEngineTeaserCard'
import type { JobMatchWithJob } from '@/types'

function makeMatch(): JobMatchWithJob {
  return {
    id: 'm1', member_id: 'user-1', scraped_job_id: 'job-1', fresh_fit_score: 88,
    matched_skills: [], missing_skills: [], score_breakdown: {}, dismissed_at: null,
    promoted_opportunity_id: null, computed_at: '2026-01-01',
    scraped_job: {
      id: 'job-1', source: 'greenhouse', external_id: 'e1', title: 'Staff Engineer', company: 'Acme',
      location: 'Remote', description: '', salary_text: null, employment_type: null,
      posting_url: 'https://example.com', posted_at: null, search_query: null,
      is_active: true, scraped_at: '', created_at: '',
    },
  }
}

function renderCard(topMatch: JobMatchWithJob | null) {
  return render(
    <MemoryRouter>
      <OpportunityEngineTeaserCard topMatch={topMatch} />
    </MemoryRouter>,
  )
}

describe('OpportunityEngineTeaserCard', () => {
  it('shows the top match title, company, and FreshFit score with a CTA into Opportunity Engine', () => {
    renderCard(makeMatch())
    expect(screen.getByText('Staff Engineer')).toBeInTheDocument()
    expect(screen.getByText('Acme')).toBeInTheDocument()
    expect(screen.getByText('88')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /opportunity engine/i })).toHaveAttribute('href', '/opportunity-engine')
  })

  it('shows a minimal no-fake-data state with a CTA when there is no top match', () => {
    renderCard(null)
    expect(screen.queryByText('Staff Engineer')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: /opportunity engine/i })).toHaveAttribute('href', '/opportunity-engine')
  })
})
