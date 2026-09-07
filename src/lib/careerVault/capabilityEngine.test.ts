import { describe, it, expect } from 'vitest'
import { inferCapabilities, CAPABILITY_RULES } from './capabilityEngine'

describe('inferCapabilities', () => {
  it('suggests Inventory Management and Financial Performance for a financial inventory statement', () => {
    const suggestions = inferCapabilities('Reduced inventory loss by $31,000.')
    const names = suggestions.map((s) => s.skillName)
    expect(names).toContain('Inventory Management')
    expect(names).toContain('Financial Performance')
    for (const s of suggestions) expect(s.reason.length).toBeGreaterThan(0)
  })

  it('suggests People Development and Leadership for a people-development statement', () => {
    const suggestions = inferCapabilities('Developed three associates who were later promoted into leadership.')
    const names = suggestions.map((s) => s.skillName)
    expect(names).toContain('People Development')
    expect(names).toContain('Leadership')
  })

  it('suggests Inventory Management from a category-only keyword with no numbers (anti-fabrication: suggestion is plausibility, not a fabricated fact)', () => {
    const suggestions = inferCapabilities('I improved inventory.')
    expect(suggestions.map((s) => s.skillName)).toEqual(['Inventory Management'])
  })

  it('returns an empty array, not an error, for a statement matching no rule', () => {
    const suggestions = inferCapabilities('I came to work on time every day.')
    expect(suggestions).toEqual([])
  })

  it('suggests Problem Solving for a fix/solve statement (fix round 1 -- previously untested rule)', () => {
    const suggestions = inferCapabilities('Fixed a recurring shrink issue that was costing the store money.')
    expect(suggestions.map((s) => s.skillName)).toContain('Problem Solving')
  })

  it('suggests Operational Execution for a process/streamlining statement (fix round 1 -- previously untested rule)', () => {
    const suggestions = inferCapabilities('Streamlined the receiving process to cut wait times.')
    expect(suggestions.map((s) => s.skillName)).toContain('Operational Execution')
  })

  it('every rule in the table has a non-empty reason (fix round 1 -- systematic check, not just incidental coverage)', () => {
    for (const rule of CAPABILITY_RULES) {
      expect(rule.reason.length).toBeGreaterThan(0)
    }
  })
})
