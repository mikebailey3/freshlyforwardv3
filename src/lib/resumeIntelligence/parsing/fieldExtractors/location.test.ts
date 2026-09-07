import { beforeEach, describe, expect, it } from 'vitest'
import { extractLocation } from './location'
import { resetProposalIdCounter } from './helpers'
import type { DetectedSection, ExtractedBlock } from '../types'

function block(text: string, order = 0): ExtractedBlock {
  return { order, kind: 'line', text, page: 1, position: null, styleHint: null }
}
function contactSection(blocks: ExtractedBlock[]): DetectedSection {
  return { kind: 'contact', headingText: null, blocks, matchedRule: null }
}

describe('extractLocation', () => {
  beforeEach(() => resetProposalIdCounter())

  it('matches a "City, ST" pattern at medium confidence -- ambiguous with an employer city', () => {
    const proposals = extractLocation([contactSection([block('Jamie Rivera', 0), block('Denver, CO', 1)])], 'doc-1')
    expect(proposals).toHaveLength(1)
    expect(proposals[0].candidateValue).toBe('Denver, CO')
    expect(proposals[0].destination).toEqual({ kind: 'canonical-profile', field: 'location' })
    expect(proposals[0].confidence).toBe('medium')
  })

  it('produces no candidate when nothing city-state-shaped exists in contact', () => {
    const proposals = extractLocation([contactSection([block('Jamie Rivera', 0)])], 'doc-1')
    expect(proposals).toEqual([])
  })

  it('does not scan outside the contact section', () => {
    const sections: DetectedSection[] = [
      contactSection([block('Jamie Rivera', 0)]),
      { kind: 'employment', headingText: 'Experience', blocks: [block('Acme Co, Austin, TX', 1)], matchedRule: 'HEADING_KEYWORD_EMPLOYMENT' },
    ]
    expect(extractLocation(sections, 'doc-1')).toEqual([])
  })
})
