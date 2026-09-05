import { describe, it, expect } from 'vitest'
import { selectMatchesToPersist, selectStaleMatchesToPrune, NOISE_FLOOR, TOP_N_PER_MEMBER } from './jobMatchPersistence'
import type { ScoredCandidate, ExistingMatchRow } from './jobMatchPersistence'

function candidate(jobId: string, score: number): ScoredCandidate {
  return { scrapedJobId: jobId, score }
}

describe('selectMatchesToPersist - ranking + noise floor', () => {
  it('keeps the top N highest-scoring candidates, dropping the rest', () => {
    const candidates = Array.from({ length: TOP_N_PER_MEMBER + 10 }, (_, i) => candidate(`job-${i}`, 50 + i))
    const kept = selectMatchesToPersist(candidates)
    expect(kept.size).toBe(TOP_N_PER_MEMBER)
    // the highest-scoring N should be the ones with the largest indices (highest scores)
    expect(kept.has(`job-${TOP_N_PER_MEMBER + 9}`)).toBe(true)
    expect(kept.has('job-0')).toBe(false)
  })

  it('excludes anything below the noise floor even when there is room under the top-N cap', () => {
    const candidates = [candidate('below', NOISE_FLOOR - 1), candidate('at', NOISE_FLOOR), candidate('above', NOISE_FLOOR + 5)]
    const kept = selectMatchesToPersist(candidates)
    expect(kept.has('below')).toBe(false)
    expect(kept.has('at')).toBe(true)
    expect(kept.has('above')).toBe(true)
  })

  it('persists a below-old-cutoff (35) but above-noise-floor job when the member has few candidates', () => {
    // This is the core behavior change: the old engine's MIN_SCORE_TO_STORE = 35
    // silently dropped anything below it. The new policy persists it as long as
    // it clears the (lower) noise floor and there's room in the member's Top N.
    const candidates = [candidate('mediocre', 25)]
    const kept = selectMatchesToPersist(candidates)
    expect(kept.has('mediocre')).toBe(true)
  })

  it('returns an empty set for no candidates', () => {
    expect(selectMatchesToPersist([]).size).toBe(0)
  })
})

function existingRow(overrides: Partial<ExistingMatchRow> = {}): ExistingMatchRow {
  return { id: 'row-1', scrapedJobId: 'job-1', engineVersion: 2, dismissedAt: null, promotedOpportunityId: null, ...overrides }
}

describe('selectStaleMatchesToPrune', () => {
  it('prunes an untouched v2 row that fell out of the new Top N', () => {
    const rows = [existingRow({ id: 'r1', scrapedJobId: 'stale-job' })]
    const pruned = selectStaleMatchesToPrune(rows, new Set(['kept-job']))
    expect(pruned).toEqual(['r1'])
  })

  it('keeps a row that is still within the new Top N', () => {
    const rows = [existingRow({ id: 'r1', scrapedJobId: 'kept-job' })]
    const pruned = selectStaleMatchesToPrune(rows, new Set(['kept-job']))
    expect(pruned).toEqual([])
  })

  it('never prunes a dismissed row, even if it fell out of the Top N', () => {
    const rows = [existingRow({ id: 'r1', scrapedJobId: 'stale-job', dismissedAt: '2026-01-01' })]
    expect(selectStaleMatchesToPrune(rows, new Set())).toEqual([])
  })

  it('never prunes a promoted row, even if it fell out of the Top N', () => {
    const rows = [existingRow({ id: 'r1', scrapedJobId: 'stale-job', promotedOpportunityId: 'opp-1' })]
    expect(selectStaleMatchesToPrune(rows, new Set())).toEqual([])
  })

  it('never prunes a legacy engine_version=1 row', () => {
    const rows = [existingRow({ id: 'r1', scrapedJobId: 'stale-job', engineVersion: 1 })]
    expect(selectStaleMatchesToPrune(rows, new Set())).toEqual([])
  })

  it('handles a mixed batch correctly', () => {
    const rows = [
      existingRow({ id: 'keep-in-top-n', scrapedJobId: 'a' }),
      existingRow({ id: 'stale', scrapedJobId: 'b' }),
      existingRow({ id: 'dismissed', scrapedJobId: 'c', dismissedAt: '2026-01-01' }),
      existingRow({ id: 'promoted', scrapedJobId: 'd', promotedOpportunityId: 'opp-1' }),
      existingRow({ id: 'legacy', scrapedJobId: 'e', engineVersion: 1 }),
    ]
    expect(selectStaleMatchesToPrune(rows, new Set(['a']))).toEqual(['stale'])
  })
})
