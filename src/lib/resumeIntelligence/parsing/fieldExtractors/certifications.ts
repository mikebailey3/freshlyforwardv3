import { buildProposal } from './helpers'
import type { DetectedSection } from '../types'
import type { ResumeFieldProposal } from '@/types/resume'

/** One candidate per block within the certifications section -- most resumes list one certification per line. */
export function extractCertifications(sections: DetectedSection[], sourceDocumentId: string): ResumeFieldProposal[] {
  const section = sections.find((s) => s.kind === 'certifications')
  if (!section) return []

  return section.blocks
    .filter((block) => block.text.trim().length > 0)
    .map((block) =>
      buildProposal({
        candidateValue: block.text.trim(),
        destination: { kind: 'canonical-profile-array', field: 'certifications', index: 'append' },
        confidence: 'high',
        sourceDocumentId,
        sectionKind: section.kind,
        block,
        sourceExcerpt: block.text.trim(),
        matchedRule: 'CERTIFICATIONS_SECTION_LINE',
      }),
    )
}
