import { describe, it, expect } from 'vitest'
import { computeConfidence } from './confidence'
import type { FreshFitDimensionResult } from './types'

function dim(overrides: Partial<FreshFitDimensionResult> = {}): FreshFitDimensionResult {
  return {
    key: 'skillsEvidence', label: 'Skills & Evidence', score: 80, weight: 0.4,
    status: 'strong', explanation: '', evidence: [], gaps: [], unknowns: [], improvementLink: null,
    ...overrides,
  }
}

describe('computeConfidence', () => {
  it('is high when every dimension has real data', () => {
    expect(computeConfidence([dim(), dim(), dim(), dim(), dim()])).toBe('high')
  })

  it('is medium when exactly one dimension is no-data', () => {
    expect(computeConfidence([dim(), dim(), dim(), dim(), dim({ status: 'no-data' })])).toBe('medium')
  })

  it('is low when two or more dimensions are no-data', () => {
    expect(computeConfidence([dim({ status: 'no-data' }), dim({ status: 'no-data' }), dim(), dim(), dim()])).toBe('low')
  })
})
