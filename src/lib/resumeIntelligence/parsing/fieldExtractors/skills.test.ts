import { beforeEach, describe, expect, it } from 'vitest'
import { extractSkills } from './skills'
import { resetProposalIdCounter } from './helpers'
import type { DetectedSection, ExtractedBlock } from '../types'

function block(text: string, order = 0, kind: ExtractedBlock['kind'] = 'line'): ExtractedBlock {
  return { order, kind, text, page: 1, position: null, styleHint: null }
}

describe('extractSkills', () => {
  beforeEach(() => resetProposalIdCounter())

  it('splits a comma-separated skills line into individual high-confidence candidates', () => {
    const sections: DetectedSection[] = [
      { kind: 'skills', headingText: 'Skills', blocks: [block('SQL, Product Strategy, Roadmapping')], matchedRule: 'HEADING_KEYWORD_SKILLS' },
    ]
    const proposals = extractSkills(sections, 'doc-1')
    expect(proposals.map((p) => p.candidateValue)).toEqual(['SQL', 'Product Strategy', 'Roadmapping'])
    expect(proposals.every((p) => p.destination.kind === 'canonical-profile-array' && p.destination.field === 'skills')).toBe(true)
    expect(proposals.every((p) => p.confidence === 'high')).toBe(true)
  })

  it('splits one skill per bullet block', () => {
    const sections: DetectedSection[] = [
      { kind: 'skills', headingText: 'Skills', blocks: [block('SQL', 0, 'list-item'), block('Product Strategy', 1, 'list-item')], matchedRule: 'HEADING_KEYWORD_SKILLS' },
    ]
    expect(extractSkills(sections, 'doc-1').map((p) => p.candidateValue)).toEqual(['SQL', 'Product Strategy'])
  })

  it('produces no candidates when no skills section was detected', () => {
    expect(extractSkills([{ kind: 'contact', headingText: null, blocks: [block('Jamie Rivera')], matchedRule: null }], 'doc-1')).toEqual([])
  })
})
