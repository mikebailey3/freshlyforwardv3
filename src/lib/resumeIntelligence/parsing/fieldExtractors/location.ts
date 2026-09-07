import { buildProposal } from './helpers'
import type { DetectedSection } from '../types'
import type { ResumeFieldProposal } from '@/types/resume'

// "City, ST" or "City, State" -- deliberately simple, US-biased pattern.
const LOCATION_RE = /\b([A-Z][a-zA-Z.'-]+(?:\s[A-Z][a-zA-Z.'-]+)*),\s*([A-Z]{2}|[A-Z][a-z]+)\b/

/** Scoped to the contact section only -- an employer's city elsewhere in the document is not the member's location. */
export function extractLocation(sections: DetectedSection[], sourceDocumentId: string): ResumeFieldProposal[] {
  const contact = sections.find((s) => s.kind === 'contact')
  if (!contact) return []

  for (const block of contact.blocks) {
    const match = block.text.match(LOCATION_RE)
    if (!match) continue

    return [
      buildProposal({
        candidateValue: match[0],
        destination: { kind: 'canonical-profile', field: 'location' },
        confidence: 'medium', // could be an employer's city, not necessarily the member's
        sourceDocumentId,
        sectionKind: contact.kind,
        block,
        sourceExcerpt: match[0],
        matchedRule: 'LOCATION_CITY_STATE_PATTERN',
      }),
    ]
  }
  return []
}
