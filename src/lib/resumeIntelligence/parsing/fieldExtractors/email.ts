import { buildProposal } from './helpers'
import type { DetectedSection } from '../types'
import type { ResumeFieldProposal } from '@/types/resume'

const EMAIL_RE = /[^\s@]+@[^\s@]+\.[^\s@]+/g

function findEmails(section: DetectedSection, sourceDocumentId: string): ResumeFieldProposal[] {
  const found: ResumeFieldProposal[] = []
  for (const block of section.blocks) {
    const matches = block.text.match(EMAIL_RE)
    if (!matches) continue
    for (const match of matches) {
      found.push(
        buildProposal({
          candidateValue: match,
          destination: { kind: 'canonical-profile', field: 'email' },
          confidence: 'high',
          sourceDocumentId,
          sectionKind: section.kind,
          block,
          sourceExcerpt: match,
          matchedRule: 'EMAIL_REGEX_MATCH',
        }),
      )
    }
  }
  return found
}

/** High confidence for exactly one unambiguous match; low confidence (all candidates kept) when multiple compete. */
export function extractEmail(sections: DetectedSection[], sourceDocumentId: string): ResumeFieldProposal[] {
  const contact = sections.find((s) => s.kind === 'contact')
  let matches = contact ? findEmails(contact, sourceDocumentId) : []

  if (matches.length === 0) {
    for (const section of sections) {
      if (section === contact) continue
      matches = findEmails(section, sourceDocumentId)
      if (matches.length > 0) break
    }
  }

  return matches.length > 1 ? matches.map((m) => ({ ...m, confidence: 'low' as const })) : matches
}
