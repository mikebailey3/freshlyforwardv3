import { beforeEach, describe, expect, it } from 'vitest'
import { extractName } from './name'
import { resetProposalIdCounter } from './helpers'
import type { DetectedSection, ExtractedBlock } from '../types'

function block(text: string, order = 0): ExtractedBlock {
  return { order, kind: 'line', text, page: 1, position: null, styleHint: null }
}
function contactSection(blocks: ExtractedBlock[]): DetectedSection {
  return { kind: 'contact', headingText: null, blocks, matchedRule: null }
}

describe('extractName', () => {
  beforeEach(() => resetProposalIdCounter())

  it('picks the first name-shaped block at medium confidence -- never high, per the locked correction', () => {
    const proposals = extractName([contactSection([block('Jamie Rivera', 0), block('jamie@example.com', 1)])], 'doc-1')
    expect(proposals).toHaveLength(1)
    expect(proposals[0].candidateValue).toBe('Jamie Rivera')
    expect(proposals[0].destination).toEqual({ kind: 'canonical-profile', field: 'full_name' })
    expect(proposals[0].confidence).toBe('medium')
    expect(proposals[0].provenance.matchedRule).toBe('NAME_HEURISTIC_FIRST_CAPITALIZED_LINE')
  })

  it('skips a line containing an email or digits when looking for the name', () => {
    const proposals = extractName([contactSection([block('jamie@example.com', 0), block('Jamie Rivera', 1)])], 'doc-1')
    expect(proposals[0].candidateValue).toBe('Jamie Rivera')
  })

  it('accepts 2 to 4 capitalized words', () => {
    const proposals = extractName([contactSection([block('Jamie De La Rivera', 0)])], 'doc-1')
    expect(proposals[0].candidateValue).toBe('Jamie De La Rivera')
  })

  it('produces no candidate when nothing in contact looks name-shaped', () => {
    const proposals = extractName([contactSection([block('jamie@example.com', 0), block('555-123-4567', 1)])], 'doc-1')
    expect(proposals).toEqual([])
  })

  it('produces no candidate when there is no contact section at all', () => {
    const proposals = extractName([{ kind: 'employment', headingText: 'Experience', blocks: [block('Acme Co', 0)], matchedRule: 'HEADING_KEYWORD_EMPLOYMENT' }], 'doc-1')
    expect(proposals).toEqual([])
  })
})
