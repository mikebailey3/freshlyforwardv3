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
    const result = computeRecommendation('excellent', blocked, false, 90)
    expect(result.key).toBe('read_details_first')
  })

  it('recommends pursuing excellent matches with no blockers', () => {
    expect(computeRecommendation('excellent', noBlockers, false, 90).key).toBe('strong_pursue')
  })

  it('recommends a look for good matches with no blockers', () => {
    expect(computeRecommendation('good', noBlockers, false, 60).key).toBe('worth_a_look')
  })

  it('recommends closing the gap first for fair matches (score 40-49) with confirmed gaps', () => {
    expect(computeRecommendation('fair', noBlockers, true, 45).key).toBe('close_the_gap_first')
  })

  it('recommends a look for fair matches (score 40-49) with no confirmed gaps', () => {
    expect(computeRecommendation('fair', noBlockers, false, 45).key).toBe('worth_a_look')
  })

  it('recommends against low-confidence fair matches (score below 40) regardless of confirmed gaps', () => {
    expect(computeRecommendation('fair', noBlockers, false, 31).key).toBe('likely_not_a_fit')
    expect(computeRecommendation('fair', noBlockers, true, 0).key).toBe('likely_not_a_fit')
  })
})
