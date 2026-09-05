import { describe, it, expect } from 'vitest'
import { getFreshFitTier, FRESHFIT_TIER_LABELS } from './tiers'

describe('getFreshFitTier', () => {
  it('classifies example scores exactly as specified', () => {
    expect(getFreshFitTier(82)).toBe('strong')
    expect(getFreshFitTier(74)).toBe('good')
    expect(getFreshFitTier(63)).toBe('good')
    expect(getFreshFitTier(51)).toBe('fair')
    expect(getFreshFitTier(42)).toBe('fair')
    expect(getFreshFitTier(31)).toBe('weak')
  })

  it('has a human label for every tier', () => {
    for (const tier of ['strong', 'good', 'fair', 'weak'] as const) {
      expect(FRESHFIT_TIER_LABELS[tier]).toBeTruthy()
    }
  })

  it('handles the exact boundary values', () => {
    expect(getFreshFitTier(80)).toBe('strong')
    expect(getFreshFitTier(60)).toBe('good')
    expect(getFreshFitTier(45)).toBe('fair')
    expect(getFreshFitTier(0)).toBe('weak')
    expect(getFreshFitTier(100)).toBe('strong')
  })
})
