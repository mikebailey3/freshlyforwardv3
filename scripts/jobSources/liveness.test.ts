import { describe, it, expect } from 'vitest'
import {
  selectJobsToDeactivate,
  isStaleByAge,
  isHealthyFetchResult,
  nextMissCount,
  shouldDeactivateForMisses,
  MAX_CONSECUTIVE_MISSES,
} from './liveness'

describe('selectJobsToDeactivate', () => {
  it('returns ids that are active but no longer seen', () => {
    expect(selectJobsToDeactivate(['a', 'b', 'c'], ['a', 'c'])).toEqual(['b'])
  })

  it('returns an empty array when everything is still seen', () => {
    expect(selectJobsToDeactivate(['a', 'b'], ['a', 'b'])).toEqual([])
  })

  it('returns everything when nothing was seen this run', () => {
    expect(selectJobsToDeactivate(['a', 'b'], [])).toEqual(['a', 'b'])
  })
})

describe('isStaleByAge', () => {
  const now = new Date('2026-06-01T00:00:00.000Z')

  it('is false for a posting scraped recently', () => {
    expect(isStaleByAge('2026-05-30T00:00:00.000Z', 45, now)).toBe(false)
  })

  it('is true for a posting older than the max age', () => {
    expect(isStaleByAge('2026-03-01T00:00:00.000Z', 45, now)).toBe(true)
  })
})

describe('isHealthyFetchResult (OE 2.0 Phase 8 -- outage guard)', () => {
  it('trusts any result, including zero, when nothing was previously on file', () => {
    expect(isHealthyFetchResult(0, 0)).toBe(true)
  })

  it('trusts a small existing set going to zero -- a 1-2 job employer closing up is unremarkable', () => {
    expect(isHealthyFetchResult(1, 0)).toBe(true)
    expect(isHealthyFetchResult(4, 0)).toBe(true)
  })

  it('trusts a meaningful-size result that retains most of what was on file', () => {
    expect(isHealthyFetchResult(20, 18)).toBe(true)
  })

  it('rejects a meaningful-size result that comes back suspiciously empty -- a likely feed outage, not 20 simultaneous closures', () => {
    expect(isHealthyFetchResult(20, 0)).toBe(false)
    expect(isHealthyFetchResult(20, 2)).toBe(false)
  })

  it('is right at the boundary: exactly 20% retained still counts as healthy', () => {
    expect(isHealthyFetchResult(10, 2)).toBe(true)
    expect(isHealthyFetchResult(10, 1)).toBe(false)
  })
})

describe('nextMissCount / shouldDeactivateForMisses (OE 2.0 Phase 8 -- consecutive-miss streak)', () => {
  it('resets to 0 the moment a job is seen again, regardless of its prior streak', () => {
    expect(nextMissCount(2, true)).toBe(0)
  })

  it('increments by exactly 1 for each miss', () => {
    expect(nextMissCount(0, false)).toBe(1)
    expect(nextMissCount(1, false)).toBe(2)
    expect(nextMissCount(2, false)).toBe(3)
  })

  it('never deactivates on the first or second miss', () => {
    expect(shouldDeactivateForMisses(1)).toBe(false)
    expect(shouldDeactivateForMisses(2)).toBe(false)
  })

  it('deactivates once the streak reaches the documented threshold', () => {
    expect(shouldDeactivateForMisses(MAX_CONSECUTIVE_MISSES)).toBe(true)
    expect(shouldDeactivateForMisses(MAX_CONSECUTIVE_MISSES + 1)).toBe(true)
  })

  it('MAX_CONSECUTIVE_MISSES is the documented value of 3', () => {
    expect(MAX_CONSECUTIVE_MISSES).toBe(3)
  })

  it('a full end-to-end miss streak: two misses then a re-appearance never crosses the threshold', () => {
    let missCount = 0
    missCount = nextMissCount(missCount, false) // miss 1
    expect(shouldDeactivateForMisses(missCount)).toBe(false)
    missCount = nextMissCount(missCount, false) // miss 2
    expect(shouldDeactivateForMisses(missCount)).toBe(false)
    missCount = nextMissCount(missCount, true) // seen again -- resets
    expect(missCount).toBe(0)
    expect(shouldDeactivateForMisses(missCount)).toBe(false)
  })

  it('a full end-to-end miss streak: three consecutive misses does cross the threshold', () => {
    let missCount = 0
    for (let i = 0; i < MAX_CONSECUTIVE_MISSES; i++) missCount = nextMissCount(missCount, false)
    expect(shouldDeactivateForMisses(missCount)).toBe(true)
  })
})
