import { describe, it, expect } from 'vitest'
import { getFreshFitTier, DEFAULT_PRESENTATION_TIERS, PRESENTATION_TIER_LABELS } from './opportunityEngineTiers'

describe('getFreshFitTier', () => {
  it('returns "highest" at or above the highest threshold (default 75)', () => {
    expect(getFreshFitTier(75)).toBe('highest')
    expect(getFreshFitTier(100)).toBe('highest')
  })

  it('returns "stronger" between the stronger and highest thresholds (default 50-74)', () => {
    expect(getFreshFitTier(50)).toBe('stronger')
    expect(getFreshFitTier(74)).toBe('stronger')
  })

  it('returns "other" below the stronger threshold (default <50)', () => {
    expect(getFreshFitTier(49)).toBe('other')
    expect(getFreshFitTier(0)).toBe('other')
  })

  it('accepts custom, configurable thresholds instead of the defaults', () => {
    // Explicitly not treating 75/50 as fixed/validated -- these must stay
    // adjustable as real FreshFit score distribution data comes in.
    const looseThresholds = { highest: 90, stronger: 60 }
    expect(getFreshFitTier(80, looseThresholds)).toBe('stronger')
    expect(getFreshFitTier(90, looseThresholds)).toBe('highest')
    expect(getFreshFitTier(59, looseThresholds)).toBe('other')
  })

  it('exposes the default thresholds as a named, importable constant (not a magic number)', () => {
    expect(DEFAULT_PRESENTATION_TIERS).toEqual({ highest: 75, stronger: 50 })
  })

  it('uses neutral, non-absolute labels rather than quality claims like "Excellent"/"Good"', () => {
    expect(PRESENTATION_TIER_LABELS.highest).toBe('Highest Fit')
    expect(PRESENTATION_TIER_LABELS.stronger).toBe('Stronger Fits')
    expect(PRESENTATION_TIER_LABELS.other).toBe('Other Matches')
  })
})
