import { beforeEach, describe, expect, it } from 'vitest'
import { extractCertifications } from './certifications'
import { resetProposalIdCounter } from './helpers'
import type { DetectedSection, ExtractedBlock } from '../types'

function block(text: string, order = 0): ExtractedBlock {
  return { order, kind: 'line', text, page: 1, position: null, styleHint: null }
}

describe('extractCertifications', () => {
  beforeEach(() => resetProposalIdCounter())

  it('proposes one candidate per block within a detected certifications section, high confidence', () => {
    const sections: DetectedSection[] = [
      { kind: 'certifications', headingText: 'Certifications', blocks: [block('PMP, Project Management Institute, 2022', 0), block('AWS Certified Solutions Architect', 1)], matchedRule: 'HEADING_KEYWORD_CERTIFICATIONS' },
    ]
    const proposals = extractCertifications(sections, 'doc-1')
    expect(proposals).toHaveLength(2)
    expect(proposals[0].candidateValue).toBe('PMP, Project Management Institute, 2022')
    expect(proposals[0].destination).toEqual({ kind: 'canonical-profile-array', field: 'certifications', index: 'append' })
    expect(proposals[0].confidence).toBe('high')
    expect(proposals[1].candidateValue).toBe('AWS Certified Solutions Architect')
  })

  it('produces no candidates when no certifications section was detected', () => {
    expect(extractCertifications([{ kind: 'contact', headingText: null, blocks: [block('Jamie Rivera', 0)], matchedRule: null }], 'doc-1')).toEqual([])
  })
})
