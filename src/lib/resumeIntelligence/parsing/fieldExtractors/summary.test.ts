import { beforeEach, describe, expect, it } from 'vitest'
import { extractSummary } from './summary'
import { resetProposalIdCounter } from './helpers'
import type { DetectedSection, ExtractedBlock } from '../types'

function block(text: string, order = 0, kind: ExtractedBlock['kind'] = 'paragraph'): ExtractedBlock {
  return { order, kind, text, page: 1, position: null, styleHint: null }
}

describe('extractSummary', () => {
  beforeEach(() => resetProposalIdCounter())

  it('proposes each paragraph block within a detected summary section, as resume-specific wording', () => {
    const sections: DetectedSection[] = [
      { kind: 'summary', headingText: 'Summary', blocks: [block('Product leader focused on measurable outcomes.', 0)], matchedRule: 'HEADING_KEYWORD_SUMMARY' },
    ]
    const proposals = extractSummary(sections, 'doc-1')
    expect(proposals).toHaveLength(1)
    expect(proposals[0].candidateValue).toBe('Product leader focused on measurable outcomes.')
    expect(proposals[0].destination).toEqual({ kind: 'resume-specific', field: 'summary_override' })
    expect(proposals[0].confidence).toBe('medium')
  })

  it('produces no candidate when no summary section was detected -- never guesses at contact-section text', () => {
    const sections: DetectedSection[] = [{ kind: 'contact', headingText: null, blocks: [block('Jamie Rivera', 0, 'line')], matchedRule: null }]
    expect(extractSummary(sections, 'doc-1')).toEqual([])
  })

  it('skips empty blocks within a summary section', () => {
    const sections: DetectedSection[] = [
      { kind: 'summary', headingText: 'Summary', blocks: [block('   ', 0)], matchedRule: 'HEADING_KEYWORD_SUMMARY' },
    ]
    expect(extractSummary(sections, 'doc-1')).toEqual([])
  })
})
