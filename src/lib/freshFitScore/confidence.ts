import type { FreshFitDimensionResult, FreshFitConfidence } from './types'

/**
 * How much evidence backs this score, as a separate axis from the score
 * itself -- a decent score built on mostly-missing data (sparse Forward
 * DNA, no Career Compass result, no salary data) should read as lower
 * confidence than the same score built on rich data, even though the
 * numeric score itself doesn't change. Deterministic count-based rule,
 * no AI/LLM involved.
 */
export function computeConfidence(dimensions: FreshFitDimensionResult[]): FreshFitConfidence {
  const noDataCount = dimensions.filter((d) => d.status === 'no-data').length
  if (noDataCount === 0) return 'high'
  if (noDataCount === 1) return 'medium'
  return 'low'
}
