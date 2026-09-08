import { beforeEach, describe, expect, it } from 'vitest'
import { extractPhone } from './phone'
import { resetProposalIdCounter } from './helpers'
import type { DetectedSection, ExtractedBlock } from '../types'

function block(text: string, order = 0): ExtractedBlock {
  return { order, kind: 'line', text, page: 1, position: null, styleHint: null }
}
function contactSection(blocks: ExtractedBlock[]): DetectedSection {
  return { kind: 'contact', headingText: null, blocks, matchedRule: null }
}

describe('extractPhone', () => {
  beforeEach(() => resetProposalIdCounter())

  it('matches a common (555) 123-4567 format at high confidence when unambiguous', () => {
    const proposals = extractPhone([contactSection([block('(555) 123-4567', 0)])], 'doc-1')
    expect(proposals).toHaveLength(1)
    expect(proposals[0].candidateValue).toBe('(555) 123-4567')
    expect(proposals[0].destination).toEqual({ kind: 'canonical-profile', field: 'phone' })
    expect(proposals[0].confidence).toBe('high')
  })

  it('matches a dash-separated format', () => {
    const proposals = extractPhone([contactSection([block('555-123-4567', 0)])], 'doc-1')
    expect(proposals[0].candidateValue).toBe('555-123-4567')
  })

  it('matches an international +1 format', () => {
    const proposals = extractPhone([contactSection([block('+1 555 123 4567', 0)])], 'doc-1')
    expect(proposals[0].candidateValue).toBe('+1 555 123 4567')
  })

  it('produces no candidate when no phone-shaped text exists', () => {
    const proposals = extractPhone([contactSection([block('Jamie Rivera', 0)])], 'doc-1')
    expect(proposals).toEqual([])
  })

  it('degrades to medium confidence when multiple candidates compete', () => {
    const proposals = extractPhone([contactSection([block('Cell: 555-123-4567 Office: 555-999-8888', 0)])], 'doc-1')
    expect(proposals).toHaveLength(2)
    expect(proposals.every((p) => p.confidence === 'medium')).toBe(true)
  })
})
