import { describe, it, expect } from 'vitest'
import { buildWhyItMatches } from './opportunityEngine'
import type { JobMatchWithJob } from '@/types'

function makeMatch(overrides: Partial<JobMatchWithJob> = {}): JobMatchWithJob {
  return {
    id: 'm1', member_id: 'u1', scraped_job_id: 'j1', fresh_fit_score: 72,
    matched_skills: ['sql', 'excel'], missing_skills: [], score_breakdown: {},
    dismissed_at: null, promoted_opportunity_id: null, computed_at: '2026-01-01',
    scraped_job: {
      id: 'j1', source: 'greenhouse', external_id: '1', title: 'Analyst', company: 'Acme',
      location: null, description: '', salary_text: null, employment_type: null, posting_url: '',
      posted_at: null, search_query: null, is_active: true, scraped_at: '', created_at: '',
    },
    ...overrides,
  }
}

describe('buildWhyItMatches', () => {
  it('describes matched skills without Forward DNA evidence', () => {
    expect(buildWhyItMatches(makeMatch())).toBe('FreshFit score 72/100. Matched skills: sql, excel.')
  })

  it('calls out strong Forward DNA evidence when present', () => {
    const text = buildWhyItMatches(
      makeMatch({ score_breakdown: { skillsCoverage: 40, roleRelevance: 10, locationFit: 10, keywordDensity: 5, dnaSkillEvidence: 12, scopeFit: 5 } })
    )
    expect(text).toContain('strong fit')
  })

  it('calls out partial Forward DNA evidence when present but low', () => {
    const text = buildWhyItMatches(
      makeMatch({ score_breakdown: { skillsCoverage: 40, roleRelevance: 10, locationFit: 10, keywordDensity: 5, dnaSkillEvidence: 5, scopeFit: 0 } })
    )
    expect(text).toContain('partial fit')
  })
})
