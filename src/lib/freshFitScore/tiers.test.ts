import { describe, it, expect } from 'vitest'
import { getFreshFitTier, FRESHFIT_TIER_LABELS } from './tiers'

describe('getFreshFitTier', () => {
  it('classifies scores into the locked OE 2.0 bands (Excellent 75-100 / Good 50-74 / Fair <50)', () => {
    expect(getFreshFitTier(100)).toBe('excellent')
    expect(getFreshFitTier(82)).toBe('excellent')
    expect(getFreshFitTier(75)).toBe('excellent')
    expect(getFreshFitTier(74)).toBe('good')
    expect(getFreshFitTier(63)).toBe('good')
    expect(getFreshFitTier(50)).toBe('good')
    expect(getFreshFitTier(49)).toBe('fair')
    expect(getFreshFitTier(42)).toBe('fair')
    expect(getFreshFitTier(0)).toBe('fair')
  })

  it('has a human label for every tier', () => {
    for (const tier of ['excellent', 'good', 'fair'] as const) {
      expect(FRESHFIT_TIER_LABELS[tier]).toBeTruthy()
    }
  })
})
