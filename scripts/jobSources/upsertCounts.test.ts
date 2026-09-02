import { describe, it, expect } from 'vitest'
import { computeUpsertCounts } from './upsertCounts'

describe('computeUpsertCounts', () => {
  it('counts every incoming id as inserted when none already exist', () => {
    expect(computeUpsertCounts([], ['a', 'b', 'c'])).toEqual({ inserted: 3, updated: 0 })
  })

  it('counts every incoming id as updated when all already exist', () => {
    expect(computeUpsertCounts(['a', 'b'], ['a', 'b'])).toEqual({ inserted: 0, updated: 2 })
  })

  it('splits a mixed batch correctly', () => {
    expect(computeUpsertCounts(['a'], ['a', 'b', 'c'])).toEqual({ inserted: 2, updated: 1 })
  })

  it('returns zeros for an empty incoming batch', () => {
    expect(computeUpsertCounts(['a', 'b'], [])).toEqual({ inserted: 0, updated: 0 })
  })
})
