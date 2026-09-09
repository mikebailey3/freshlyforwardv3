import { buildProposal } from './helpers'
import type { DetectedSection } from '../types'
import type { ResumeFieldProposal } from '@/types/resume'

/**
 * Deliberately scoped to an explicitly-detected 'summary' section only --
 * never guesses which contact-section paragraph might be a summary when
 * no heading was found, to avoid an ambiguous, unexplainable candidate.
 * Always resume-specific (a summary variant is presentation, not a career
 * fact), never canonical-profile.
 */
export function extractSummary(sections: DetectedSection[], sourceDocumentId: string): ResumeFieldProposal[] {
  const section = sections.find((s) => s.kind === 'summary')
  if (!section) return []

  return section.blocks
    .filter((block) => block.text.trim().length > 0)
    .map((block) =>
      buildProposal({
        candidateValue: block.text.trim(),
        destination: { kind: 'resume-specific', field: 'summary_override' },
        confidence: 'medium',
        sourceDocumentId,
        sectionKind: section.kind,
        block,
        sourceExcerpt: block.text.trim(),
        matchedRule: 'SUMMARY_SECTION_PARAGRAPH',
      }),
    )
}
