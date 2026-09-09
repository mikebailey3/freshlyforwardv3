import { beforeEach, describe, expect, it } from 'vitest'
import { extractEducation } from './education'
import { resetProposalIdCounter } from './helpers'
import type { DetectedSection, ExtractedBlock } from '../types'

let order = 0
function block(text: string): ExtractedBlock {
  return { order: order++, kind: 'line', text, page: 1, position: null, styleHint: null }
}
function educationSection(blocks: ExtractedBlock[]): DetectedSection {
  return { kind: 'education', headingText: 'Education', blocks, matchedRule: 'HEADING_KEYWORD_EDUCATION' }
}

describe('extractEducation', () => {
  beforeEach(() => {
    order = 0
    resetProposalIdCounter()
  })

  it('groups an institution + degree line into one candidate, medium confidence', () => {
    const proposals = extractEducation([educationSection([block('State University'), block('B.A. Economics, 2015')])], 'doc-1')
    expect(proposals).toHaveLength(1)
    expect(proposals[0].candidateValue).toContain('State University')
    expect(proposals[0].candidateValue).toContain('B.A. Economics, 2015')
    expect(proposals[0].destination).toEqual({ kind: 'canonical-profile-array', field: 'education', index: 'append' })
    expect(proposals[0].confidence).toBe('medium')
  })

  it('splits two institutions into two entries', () => {
    const proposals = extractEducation([educationSection([
      block('State University'), block('B.A. Economics, 2015'),
      block('Community College'), block('A.A. General Studies, 2011'),
    ])], 'doc-1')
    expect(proposals).toHaveLength(2)
  })

  it('produces no candidates when no education section was detected', () => {
    expect(extractEducation([{ kind: 'contact', headingText: null, blocks: [block('Jamie Rivera')], matchedRule: null }], 'doc-1')).toEqual([])
  })
})
