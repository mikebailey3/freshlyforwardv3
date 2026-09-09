import { buildProposal } from './helpers'
import type { DetectedSection } from '../types'
import type { ResumeFieldProposal } from '@/types/resume'

// Covers (555) 123-4567 / 555-123-4567 / 555.123.4567 / +1 555 123 4567 -- deliberately not exhaustive of every world format.
const PHONE_RE = /(\+\d{1,2}\s?)?(\(\d{3}\)|\d{3})[\s.-]?\d{3}[\s.-]?\d{4}/g

export function extractPhone(sections: DetectedSection[], sourceDocumentId: string): ResumeFieldProposal[] {
  const contact = sections.find((s) => s.kind === 'contact')
  if (!contact) return []

  const found: ResumeFieldProposal[] = []
  for (const block of contact.blocks) {
    const matches = block.text.match(PHONE_RE)
    if (!matches) continue
    for (const match of matches) {
      found.push(
        buildProposal({
          candidateValue: match.trim(),
          destination: { kind: 'canonical-profile', field: 'phone' },
          confidence: 'high',
          sourceDocumentId,
          sectionKind: contact.kind,
          block,
          sourceExcerpt: match,
          matchedRule: 'PHONE_REGEX_MATCH',
        }),
      )
    }
  }

  return found.length > 1 ? found.map((p) => ({ ...p, confidence: 'medium' as const })) : found
}
