import { describe, it, expect } from 'vitest'
import { analyzeTailoringFit } from './analyzeTailoringFit'

const jd = 'We need someone strong in project management, SQL, and customer service, ideally also skilled in Salesforce.'

describe('analyzeTailoringFit', () => {
  it('classifies a JD skill already included on this resume version as matchedIncluded', () => {
    const result = analyzeTailoringFit(jd, ['project management', 'sql', 'customer service', 'salesforce'], ['project management'])
    expect(result.matchedIncluded).toEqual(['project management'])
  })

  it('classifies a JD skill that is true of the member (canonical) but not turned on for this version as matchedNotIncluded -- safe to suggest, not new information', () => {
    const result = analyzeTailoringFit(jd, ['project management', 'sql', 'customer service', 'salesforce'], ['project management'])
    expect(result.matchedNotIncluded.sort()).toEqual(['customer service', 'salesforce', 'sql'])
  })

  it('never suggests a JD skill absent from the canonical Profile -- classified notOnFile, never matchedNotIncluded (anti-fabrication)', () => {
    const result = analyzeTailoringFit(jd, ['project management'], [])
    // The dictionary also separately matches bare 'management' and 'sales'
    // substrings (e.g. within 'Salesforce') -- distinct dictionary entries
    // from 'project management', so they correctly fall to notOnFile too
    // since the canonical Profile only has the exact 'project management' string.
    expect(result.notOnFile).toContain('customer service')
    expect(result.notOnFile).toContain('salesforce')
    expect(result.notOnFile).toContain('sql')
    expect(result.notOnFile).not.toContain('project management')
    expect(result.matchedNotIncluded).toEqual(['project management'])
    expect(result.matchedIncluded).toEqual([])
  })

  it('is case-insensitive when matching canonical/included skills against JD-found skills', () => {
    const result = analyzeTailoringFit(jd, ['SQL'], [])
    expect(result.matchedNotIncluded).toContain('sql')
  })

  it('returns empty buckets for a JD with no recognizable skill-dictionary terms', () => {
    const result = analyzeTailoringFit('We are a fun, fast-growing company!', ['sql'], [])
    expect(result.jdSkillsFound).toEqual([])
    expect(result.matchedIncluded).toEqual([])
    expect(result.matchedNotIncluded).toEqual([])
    expect(result.notOnFile).toEqual([])
  })
})
