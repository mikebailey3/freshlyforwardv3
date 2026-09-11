import { describe, expect, it } from 'vitest'
import { computeQualityMetrics, type MatchOutcomeInput } from './qualityMetrics'

function match(freshFitScore: number, promotedOpportunityId: string | null = null): MatchOutcomeInput {
  return { freshFitScore, promotedOpportunityId }
}

describe('computeQualityMetrics', () => {
  it('returns all three tiers even when a tier has zero matches -- never omits a row', () => {
    const result = computeQualityMetrics([match(80)], new Set())
    expect(result.map((r) => r.tier)).toEqual(['excellent', 'good', 'fair'])
  })

  it('buckets matches into the correct tier using the canonical getFreshFitTier thresholds', () => {
    const result = computeQualityMetrics([match(90), match(60), match(30)], new Set())
    expect(result.find((r) => r.tier === 'excellent')?.totalMatches).toBe(1)
    expect(result.find((r) => r.tier === 'good')?.totalMatches).toBe(1)
    expect(result.find((r) => r.tier === 'fair')?.totalMatches).toBe(1)
  })

  it('never fabricates a promotion rate for a tier with zero matches -- null, not 0', () => {
    const result = computeQualityMetrics([match(90)], new Set())
    expect(result.find((r) => r.tier === 'fair')?.promotionRate).toBeNull()
  })

  it('computes promotionRate as promoted / total within a tier', () => {
    const result = computeQualityMetrics([match(90, 'opp-1'), match(85, null)], new Set())
    const excellent = result.find((r) => r.tier === 'excellent')!
    expect(excellent.totalMatches).toBe(2)
    expect(excellent.promotedCount).toBe(1)
    expect(excellent.promotionRate).toBe(0.5)
  })

  it('never fabricates an application rate when nothing in this tier was promoted -- null, not 0', () => {
    const result = computeQualityMetrics([match(90, null)], new Set())
    expect(result.find((r) => r.tier === 'excellent')?.applicationRate).toBeNull()
  })

  it('computes applicationRate as applied / promoted, using the opportunity-has-application set', () => {
    const result = computeQualityMetrics(
      [match(90, 'opp-1'), match(88, 'opp-2')],
      new Set(['opp-1'])
    )
    const excellent = result.find((r) => r.tier === 'excellent')!
    expect(excellent.promotedCount).toBe(2)
    expect(excellent.appliedCount).toBe(1)
    expect(excellent.applicationRate).toBe(0.5)
  })

  it('handles an entirely empty match list without throwing, every tier at zero/null', () => {
    const result = computeQualityMetrics([], new Set())
    for (const tier of result) {
      expect(tier.totalMatches).toBe(0)
      expect(tier.promotionRate).toBeNull()
      expect(tier.applicationRate).toBeNull()
    }
  })
})
