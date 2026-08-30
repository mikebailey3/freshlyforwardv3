import { describe, it, expect } from 'vitest'
import { calculateForwardDnaCompleteness } from './completeness'

const fullyComplete = {
  hasCareerCompassResult: true,
  hasScopeEntry: true,
  hasResponsibilityTag: true,
  hasSkillEvidenceBeyondClaimed: true,
  hasEducationOrCertifications: true,
  hasTargetRoleAndTimeframe: true,
}

describe('calculateForwardDnaCompleteness', () => {
  it('scores 100 when every signal is present', () => {
    const { score, missing } = calculateForwardDnaCompleteness(fullyComplete)
    expect(score).toBe(100)
    expect(missing).toEqual([])
  })

  it('scores 0 and lists every check when nothing is present', () => {
    const { score, missing } = calculateForwardDnaCompleteness({
      hasCareerCompassResult: false,
      hasScopeEntry: false,
      hasResponsibilityTag: false,
      hasSkillEvidenceBeyondClaimed: false,
      hasEducationOrCertifications: false,
      hasTargetRoleAndTimeframe: false,
    })
    expect(score).toBe(0)
    expect(missing).toHaveLength(6)
  })

  it('lists only the missing checks for a partial profile', () => {
    const { missing } = calculateForwardDnaCompleteness({ ...fullyComplete, hasScopeEntry: false })
    expect(missing).toEqual([{ key: 'hasScopeEntry', label: 'Professional scope on at least one role' }])
  })
})
