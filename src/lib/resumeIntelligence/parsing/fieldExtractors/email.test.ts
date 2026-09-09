import { beforeEach, describe, expect, it } from 'vitest'
import { extractEmail } from './email'
import { resetProposalIdCounter } from './helpers'
import type { DetectedSection, ExtractedBlock } from '../types'

function block(text: string, order = 0): ExtractedBlock {
  return { order, kind: 'line', text, page: 1, position: null, styleHint: null }
}
function contactSection(blocks: ExtractedBlock[]): DetectedSection {
  return { kind: 'contact', headingText: null, blocks, matchedRule: null }
}

describe('extractEmail', () => {
  beforeEach(() => resetProposalIdCounter())

  it('returns a high-confidence proposal for a single unambiguous email in the contact section', () => {
    const proposals = extractEmail([contactSection([block('Jamie Rivera', 0), block('jamie@example.com', 1)])], 'doc-1')
    expect(proposals).toHaveLength(1)
    expect(proposals[0].candidateValue).toBe('jamie@example.com')
    expect(proposals[0].destination).toEqual({ kind: 'canonical-profile', field: 'email' })
    expect(proposals[0].confidence).toBe('high')
    expect(proposals[0].provenance.sourceExcerpt).toBe('jamie@example.com')
    expect(proposals[0].provenance.matchedRule).toBe('EMAIL_REGEX_MATCH')
    expect(proposals[0].provenance.sectionKind).toBe('contact')
  })

  it('extracts the email from within a longer line as a literal substring, not the whole line', () => {
    const proposals = extractEmail([contactSection([block('Email: jamie@example.com | Phone: 555-1234', 0)])], 'doc-1')
    expect(proposals[0].candidateValue).toBe('jamie@example.com')
    expect(proposals[0].provenance.sourceExcerpt).toBe('jamie@example.com')
  })

  it('produces no candidate when no email-shaped text exists anywhere', () => {
    const proposals = extractEmail([contactSection([block('Jamie Rivera', 0)])], 'doc-1')
    expect(proposals).toEqual([])
  })

  it('falls back to low confidence with multiple proposals when several email-shaped strings are found', () => {
    const proposals = extractEmail([contactSection([block('jamie@example.com or jamie.rivera@work.com', 0)])], 'doc-1')
    expect(proposals).toHaveLength(2)
    expect(proposals.every((p) => p.confidence === 'low')).toBe(true)
  })

  it('falls back to scanning the whole document when the contact section has no email', () => {
    const sections: DetectedSection[] = [
      contactSection([block('Jamie Rivera', 0)]),
      { kind: 'employment', headingText: 'Experience', blocks: [block('Reach me at jamie@example.com for references', 1)], matchedRule: 'HEADING_KEYWORD_EMPLOYMENT' },
    ]
    const proposals = extractEmail(sections, 'doc-1')
    expect(proposals).toHaveLength(1)
    expect(proposals[0].candidateValue).toBe('jamie@example.com')
    expect(proposals[0].provenance.sectionKind).toBe('employment')
  })
})
