import { describe, it, expect } from 'vitest'
import { computeRecommendation } from './recommendation'
import type { FreshFitHardConstraint } from './types'

const noBlockers: FreshFitHardConstraint[] = [
  { key: 'compensationFloor', label: 'Compensation Floor', status: 'unknown', reason: '' },
]
const blocked: FreshFitHardConstraint[] = [
  { key: 'remoteRequirement', label: 'Remote Requirement', status: 'hard_blocker', reason: 'On-site, no relocation.' },
]

describe('computeRecommendation', () => {
  it('recommends reading the details first whenever any hard constraint is blocked, regardless of tier', () => {
    const result = computeRecommendation('strong', blocked, false)
    expect(result.key).toBe('read_details_first')
  })

  it('recommends pursuing strong matches with no blockers', () => {
    expect(computeRecommendation('strong', noBlockers, false).key).toBe('strong_pursue')
  })

  it('recommends a look for good matches with no blockers', () => {
    expect(computeRecommendation('good', noBlockers, false).key).toBe('worth_a_look')
  })

  it('recommends closing the gap first for fair matches with confirmed gaps', () => {
    expect(computeRecommendation('fair', noBlockers, true).key).toBe('close_the_gap_first')
  })

  it('recommends a look for fair matches with no confirmed gaps', () => {
    expect(computeRecommendation('fair', noBlockers, false).key).toBe('worth_a_look')
  })

  it('recommends against weak matches', () => {
    expect(computeRecommendation('weak', noBlockers, false).key).toBe('likely_not_a_fit')
  })
})
