import { describe, expect, it } from 'vitest'
import { CLICHES, findCliches, hasMetric, rewriteBullet, VERB_MAP, WEAK_OPENERS } from './index'

/**
 * Shared, deterministic text-quality primitives extracted from
 * linkedinOptimizer.ts (Resume Intelligence Phase 1, item 2). These are
 * consumed by both linkedinOptimizer.ts (unchanged behavior, proven by
 * ../linkedinOptimizer.test.ts) and the new
 * src/lib/resumeIntelligence/{contentStrength,quantification}.ts modules.
 */
describe('hasMetric', () => {
  it('detects a digit', () => expect(hasMetric('reduced costs by 20 percent')).toBe(true))
  it('detects a percent sign', () => expect(hasMetric('grew revenue 30%')).toBe(true))
  it('detects a dollar sign', () => expect(hasMetric('saved $50,000 annually')).toBe(true))
  it('returns false with no digit, percent, or dollar sign', () => expect(hasMetric('improved team morale')).toBe(false))
})

describe('findCliches', () => {
  it('finds a known cliché case-insensitively', () => {
    expect(findCliches('Hardworking self-starter with a proven track record')).toEqual(
      expect.arrayContaining(['hardworking', 'self-starter', 'proven track record']),
    )
  })

  it('returns an empty array when no clichés are present', () => {
    expect(findCliches('Led a team of 6 engineers to ship a payments platform')).toEqual([])
  })
})

describe('rewriteBullet', () => {
  it('strips a weak opener and prepends a mapped strong verb', () => {
    expect(rewriteBullet('Responsible for managing a team of 5')).toBe('Led managing a team of 5')
  })

  it('falls back to "Delivered" when no verb pattern matches', () => {
    expect(rewriteBullet('worked on something entirely unrelated to any keyword')).toMatch(/^Delivered /)
  })

  it('appends a quantify-it hint when the rewrite has no metric', () => {
    expect(rewriteBullet('helped with onboarding')).toContain('[quantify it:')
  })

  it('does not append a quantify-it hint when a metric survives into the rewrite', () => {
    expect(rewriteBullet('Reduced churn by 20%')).not.toContain('[quantify it:')
  })
})

describe('CLICHES / WEAK_OPENERS / VERB_MAP', () => {
  it('are non-empty, so a downstream consumer never silently gets a no-op detector', () => {
    expect(CLICHES.length).toBeGreaterThan(0)
    expect(WEAK_OPENERS.length).toBeGreaterThan(0)
    expect(VERB_MAP.length).toBeGreaterThan(0)
  })
})
