import { describe, it, expect } from 'vitest'
import { computeOpportunityRank, rankOpportunities, buildRankHighlight } from './ranking'
import type { FreshFitHardConstraint } from '@/lib/freshFitScore'
import type { JobMatchScoreBreakdown, JobMatchWithJob } from '@/types'

function makeMatch(overrides: Partial<JobMatchWithJob> = {}): JobMatchWithJob {
  return {
    id: 'm1', member_id: 'u1', scraped_job_id: 'j1', fresh_fit_score: 70,
    matched_skills: [], missing_skills: [], score_breakdown: {}, dismissed_at: null,
    promoted_opportunity_id: null, computed_at: '2026-01-01', engine_version: 2,
    scraped_job: {
      id: 'j1', source: 'greenhouse', external_id: '1', title: 'Analyst', company: 'Acme',
      location: null, description: '', salary_text: null, employment_type: null, posting_url: '',
      posted_at: null, search_query: null, is_active: true, scraped_at: '', created_at: '',
    },
    ...overrides,
  }
}

function makeV2Breakdown(opts: {
  careerDirectionScore?: number
  hardConstraints?: FreshFitHardConstraint[]
  confidence?: 'high' | 'medium' | 'low'
} = {}): JobMatchScoreBreakdown {
  const dimensions =
    opts.careerDirectionScore === undefined
      ? []
      : [{ key: 'careerDirection' as const, label: 'Career Direction Alignment', score: opts.careerDirectionScore, weight: 0.15, status: 'moderate' as const, explanation: '', evidence: [], gaps: [], unknowns: [], improvementLink: null }]

  return {
    skillsCoverage: 0, roleRelevance: 0, locationFit: 0, keywordDensity: 0,
    v2: {
      tier: 'good', confidence: opts.confidence ?? 'medium',
      dimensions,
      hardConstraints: opts.hardConstraints ?? [],
      unknowns: [],
      recommendation: { key: 'worth_a_look', headline: '', detail: '' },
    },
  }
}

function daysAgoIso(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
}

describe('computeOpportunityRank', () => {
  it('with no v2 data and no posting date, rankScore equals the raw FreshFit score (every factor neutral)', () => {
    const rank = computeOpportunityRank(makeMatch({ fresh_fit_score: 55 }))
    expect(rank.rankScore).toBe(55)
    expect(rank.needsReview).toBe(false)
  })

  it('gives a positive career-goal-alignment nudge for above-average Career Compass alignment, and a negative one for below-average', () => {
    const strong = computeOpportunityRank(makeMatch({ score_breakdown: makeV2Breakdown({ careerDirectionScore: 100 }) }))
    const weak = computeOpportunityRank(makeMatch({ score_breakdown: makeV2Breakdown({ careerDirectionScore: 0 }) }))
    const careerFactor = (r: typeof strong) => r.factors.find((f) => f.key === 'careerGoalAlignment')!.contribution
    expect(careerFactor(strong)).toBe(10)
    expect(careerFactor(weak)).toBe(-10)
  })

  it('treats a missing Career Compass result as neutral, never a penalty', () => {
    const rank = computeOpportunityRank(makeMatch({ score_breakdown: makeV2Breakdown() }))
    expect(rank.factors.find((f) => f.key === 'careerGoalAlignment')!.contribution).toBe(0)
  })

  it('rewards a very recently posted job and penalizes a stale one, treating an unknown date as neutral', () => {
    const fresh = computeOpportunityRank(makeMatch({ scraped_job: { ...makeMatch().scraped_job, posted_at: daysAgoIso(1) } }))
    const stale = computeOpportunityRank(makeMatch({ scraped_job: { ...makeMatch().scraped_job, posted_at: daysAgoIso(45) } }))
    const unknown = computeOpportunityRank(makeMatch())
    const freshnessOf = (r: typeof fresh) => r.factors.find((f) => f.key === 'freshness')!.contribution
    expect(freshnessOf(fresh)).toBe(8)
    expect(freshnessOf(stale)).toBe(-3)
    expect(freshnessOf(unknown)).toBe(0)
  })

  it('falls back to scraped_at when posted_at is missing', () => {
    const rank = computeOpportunityRank(makeMatch({ scraped_job: { ...makeMatch().scraped_job, posted_at: null, scraped_at: daysAgoIso(2) } }))
    expect(rank.factors.find((f) => f.key === 'freshness')!.contribution).toBe(8)
  })

  it('materially suppresses ranking and flags needsReview when a hard_blocker is present -- enough to outrank a much higher raw FreshFit score', () => {
    const blocked = computeOpportunityRank(
      makeMatch({
        fresh_fit_score: 90,
        score_breakdown: makeV2Breakdown({ hardConstraints: [{ key: 'jobsToAvoidExclusion', label: 'Roles/Companies to Avoid', status: 'hard_blocker', reason: 'matches an avoided company' }] }),
      })
    )
    const clean = computeOpportunityRank(makeMatch({ fresh_fit_score: 65, score_breakdown: makeV2Breakdown({ hardConstraints: [{ key: 'remoteRequirement', label: 'Remote Requirement', status: 'confirmed_match', reason: '' }] }) }))

    expect(blocked.needsReview).toBe(true)
    expect(blocked.factors.find((f) => f.key === 'qualificationRisk')!.contribution).toBe(-50)
    expect(blocked.rankScore).toBeLessThan(clean.rankScore)
  })

  it('gives a small bonus when every hard constraint is confirmed_match, and stays neutral when some are merely unknown', () => {
    const allConfirmed = computeOpportunityRank(makeMatch({ score_breakdown: makeV2Breakdown({ hardConstraints: [{ key: 'remoteRequirement', label: 'Remote Requirement', status: 'confirmed_match', reason: '' }] }) }))
    const someUnknown = computeOpportunityRank(makeMatch({ score_breakdown: makeV2Breakdown({ hardConstraints: [{ key: 'compensationFloor', label: 'Compensation Floor', status: 'unknown', reason: '' }] }) }))

    expect(allConfirmed.factors.find((f) => f.key === 'qualificationRisk')!.contribution).toBe(4)
    expect(allConfirmed.needsReview).toBe(false)
    expect(someUnknown.factors.find((f) => f.key === 'qualificationRisk')!.contribution).toBe(0)
  })

  it('rewards high evidence confidence and penalizes low confidence', () => {
    const high = computeOpportunityRank(makeMatch({ score_breakdown: makeV2Breakdown({ confidence: 'high' }) }))
    const low = computeOpportunityRank(makeMatch({ score_breakdown: makeV2Breakdown({ confidence: 'low' }) }))
    expect(high.factors.find((f) => f.key === 'evidenceStrength')!.contribution).toBe(5)
    expect(low.factors.find((f) => f.key === 'evidenceStrength')!.contribution).toBe(-4)
  })
})

describe('rankOpportunities', () => {
  it('sorts matches by rankScore descending, not raw fresh_fit_score or insertion order', () => {
    const blocked = makeMatch({
      id: 'blocked', fresh_fit_score: 90,
      score_breakdown: makeV2Breakdown({ hardConstraints: [{ key: 'jobsToAvoidExclusion', label: 'Roles/Companies to Avoid', status: 'hard_blocker', reason: 'x' }] }),
    })
    const clean = makeMatch({ id: 'clean', fresh_fit_score: 60 })

    const ranked = rankOpportunities([blocked, clean])
    expect(ranked.map((r) => r.match.id)).toEqual(['clean', 'blocked'])
  })
})

describe('buildRankHighlight', () => {
  it('returns the explanation for the strongest positive non-base factor', () => {
    const rank = computeOpportunityRank(makeMatch({ score_breakdown: makeV2Breakdown({ confidence: 'high', careerDirectionScore: 100 }) }))
    const highlight = buildRankHighlight(rank)
    expect(highlight).toContain('career direction')
  })

  it('returns null when nothing about the match is a standout positive', () => {
    const rank = computeOpportunityRank(makeMatch())
    expect(buildRankHighlight(rank)).toBeNull()
  })
})
