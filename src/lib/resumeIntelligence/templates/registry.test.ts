import { describe, it, expect } from 'vitest'
import { RESUME_TEMPLATES, resolveTemplate, TEMPLATE_KEYS } from './registry'

describe('resume template registry', () => {
  it('ships exactly the five specified templates', () => {
    expect(TEMPLATE_KEYS.sort()).toEqual(['ats_classic', 'executive', 'minimal', 'modern', 'professional'].sort())
  })

  it('never sets decorative=true for any template (ATS-safety anti-pattern guardrail)', () => {
    for (const template of RESUME_TEMPLATES) {
      expect(template.decorative).toBe(false)
    }
  })

  it('never uses a multi-column layout (parsing-interference guardrail)', () => {
    for (const template of RESUME_TEMPLATES) {
      expect(template.layout).toBe('single-column')
    }
  })

  it('marks every template ATS-safe given the single-column, non-decorative constraints above', () => {
    for (const template of RESUME_TEMPLATES) {
      expect(template.isAtsSafe).toBe(true)
    }
  })

  it('resolveTemplate falls back to the first template for an unknown key rather than throwing', () => {
    expect(resolveTemplate('not-a-real-template').key).toBe('ats_classic')
  })

  it('resolveTemplate returns the exact requested template when known', () => {
    expect(resolveTemplate('modern').key).toBe('modern')
  })
})
