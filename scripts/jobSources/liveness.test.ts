import { describe, it, expect } from 'vitest'
import { selectJobsToDeactivate, isStaleByAge } from './liveness'

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
