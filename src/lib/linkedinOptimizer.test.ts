import { describe, expect, it } from 'vitest'
import { computeLinkedInScore, generateHeadlineSuggestion, rewriteBullet } from './linkedinOptimizer'

/**
 * Characterization tests for the pre-extraction behavior of
 * linkedinOptimizer.ts. Written before the shared text-quality primitives
 * (clichés, weak openers, hasMetric, verb map) are extracted into
 * src/lib/textQuality/ -- this file must still pass, unchanged, after that
 * extraction. That's the regression proof for Resume Intelligence Phase 1
 * item 2.
 */
describe('computeLinkedInScore', () => {
  it('scores an empty profile at zero with issues on every section', () => {
    const result = computeLinkedInScore({
      headline: '',
      about: '',
      experience_bullets: '',
      skills: [],
      target_role: null,
    })
    expect(result.score).toBe(0)
    expect(result.headline.points).toBe(0)
    expect(result.about.points).toBe(0)
    expect(result.experience.points).toBe(0)
    expect(result.skills.points).toBe(0)
    expect(result.headline.issues.length).toBeGreaterThan(0)
  })

  it('flags clichés in the headline and withholds the cliché points', () => {
    const result = computeLinkedInScore({
      headline: 'Hardworking team player with excellent communication skills',
      about: '',
      experience_bullets: '',
      skills: [],
      target_role: null,
    })
    expect(result.headline.issues.some((i) => i.includes('Generic phrase'))).toBe(true)
  })

  it('rewards a well-structured, keyword-matched headline', () => {
    const result = computeLinkedInScore({
      headline: 'Senior Product Manager | Roadmap Strategy & Growth | Helping teams ship faster',
      about: '',
      experience_bullets: '',
      skills: ['product management'],
      target_role: 'Product Manager',
    })
    expect(result.headline.points).toBeGreaterThan(10)
  })

  it('rewards a long, quantified about section with a call to action and no clichés', () => {
    const about = `${'Led cross-functional teams to grow revenue 30% year over year. '.repeat(15)}Feel free to reach out if you would like to connect.`
    const result = computeLinkedInScore({
      headline: '',
      about,
      experience_bullets: '',
      skills: [],
      target_role: null,
    })
    expect(result.about.points).toBe(30)
    expect(result.about.issues).toEqual([])
  })

  it('flags weak-opener bullets and suggests a rewrite of the first one', () => {
    const result = computeLinkedInScore({
      headline: '',
      about: '',
      experience_bullets: 'Responsible for managing the support team\nResolved 200+ customer tickets weekly',
      skills: [],
      target_role: null,
    })
    expect(result.experience.issues.some((i) => i.includes('weak/passive phrase'))).toBe(true)
    expect(result.experience.suggestion).toContain('Responsible for managing the support team')
  })

  it('scores skills higher with more entries and recognized keywords', () => {
    const few = computeLinkedInScore({
      headline: '',
      about: '',
      experience_bullets: '',
      skills: ['excel'],
      target_role: null,
    })
    const many = computeLinkedInScore({
      headline: '',
      about: '',
      experience_bullets: '',
      skills: ['leadership', 'project management', 'sales', 'marketing', 'analytics', 'excel', 'sql'],
      target_role: null,
    })
    expect(many.skills.points).toBeGreaterThan(few.skills.points)
  })
})

describe('rewriteBullet', () => {
  it('strips a weak opener, capitalizes, and prepends a mapped strong verb', () => {
    expect(rewriteBullet('Responsible for managing a team of 5')).toBe('Led managing a team of 5')
  })

  it('appends a quantify-it hint when no metric is present', () => {
    const rewritten = rewriteBullet('helped with customer onboarding')
    expect(rewritten).toContain('[quantify it:')
  })

  it('does not append a quantify hint when a metric is already present', () => {
    const rewritten = rewriteBullet('Reduced churn by 20%')
    expect(rewritten).not.toContain('[quantify it:')
  })
})

describe('generateHeadlineSuggestion', () => {
  it('falls back to placeholders when role and skills are missing', () => {
    expect(generateHeadlineSuggestion(null, [])).toBe(
      'Your Target Role | Your Top Skills | Helping [audience] achieve [outcome]',
    )
  })

  it('uses the target role and top two skills when provided', () => {
    expect(generateHeadlineSuggestion('Product Manager', ['strategy', 'growth', 'analytics'])).toBe(
      'Product Manager | strategy & growth | Helping [audience] achieve [outcome]',
    )
  })
})
