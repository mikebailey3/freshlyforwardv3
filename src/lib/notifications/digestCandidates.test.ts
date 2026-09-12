import { describe, expect, it } from 'vitest'
import { selectDigestCandidates, MAX_MATCHES_PER_DIGEST, type DigestCandidateMatch } from './digestCandidates'

function makeMatch(overrides: Partial<DigestCandidateMatch> = {}): DigestCandidateMatch {
  return {
    id: 'm1', freshFitScore: 80, title: 'Data Analyst', company: 'Acme',
    postingUrl: 'https://example.com/1', dismissedAt: null, promotedOpportunityId: null,
    ...overrides,
  }
}

describe('selectDigestCandidates', () => {
  it('excludes dismissed matches', () => {
    const result = selectDigestCandidates([makeMatch({ dismissedAt: '2026-01-01' })], [])
    expect(result).toEqual([])
  })

  it('excludes already-promoted matches -- they have their own surface already', () => {
    const result = selectDigestCandidates([makeMatch({ promotedOpportunityId: 'opp-1' })], [])
    expect(result).toEqual([])
  })

  it('excludes fair-tier matches -- not exciting enough for an email', () => {
    const result = selectDigestCandidates([makeMatch({ freshFitScore: 40 })], [])
    expect(result).toEqual([])
  })

  it('includes good and excellent tier matches', () => {
    const result = selectDigestCandidates([makeMatch({ id: 'good', freshFitScore: 60 }), makeMatch({ id: 'excellent', freshFitScore: 90 })], [])
    expect(result.map((m) => m.id).sort()).toEqual(['excellent', 'good'])
  })

  it('excludes matches already present in previouslySentMatchIds -- duplicate suppression', () => {
    const result = selectDigestCandidates([makeMatch({ id: 'm1' }), makeMatch({ id: 'm2' })], ['m1'])
    expect(result.map((m) => m.id)).toEqual(['m2'])
  })

  it('sorts by freshFitScore descending', () => {
    const result = selectDigestCandidates(
      [makeMatch({ id: 'low', freshFitScore: 55 }), makeMatch({ id: 'high', freshFitScore: 95 })],
      []
    )
    expect(result.map((m) => m.id)).toEqual(['high', 'low'])
  })

  it('caps the result at MAX_MATCHES_PER_DIGEST even when more are eligible', () => {
    const matches = Array.from({ length: MAX_MATCHES_PER_DIGEST + 3 }, (_, i) => makeMatch({ id: `m${i}`, freshFitScore: 60 + i }))
    const result = selectDigestCandidates(matches, [])
    expect(result).toHaveLength(MAX_MATCHES_PER_DIGEST)
  })

  it('returns an empty array when nothing is eligible, without throwing', () => {
    expect(selectDigestCandidates([], [])).toEqual([])
  })
})
