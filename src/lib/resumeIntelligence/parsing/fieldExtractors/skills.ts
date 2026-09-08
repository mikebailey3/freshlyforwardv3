import { buildProposal } from './helpers'
import type { DetectedSection } from '../types'
import type { ResumeFieldProposal } from '@/types/resume'

/** Splits each block on commas/bullets within the skills section into individual skill tokens. */
export function extractSkills(sections: DetectedSection[], sourceDocumentId: string): ResumeFieldProposal[] {
  const section = sections.find((s) => s.kind === 'skills')
  if (!section) return []

  const proposals: ResumeFieldProposal[] = []
  for (const block of section.blocks) {
    const tokens = block.text
      .split(/[,•·]/)
      .map((t) => t.trim())
      .filter((t) => t.length > 0)

    for (const token of tokens) {
      proposals.push(
        buildProposal({
          candidateValue: token,
          destination: { kind: 'canonical-profile-array', field: 'skills', index: 'append' },
          confidence: 'high',
          sourceDocumentId,
          sectionKind: section.kind,
          block,
          sourceExcerpt: token,
          matchedRule: 'SKILLS_SECTION_TOKEN_SPLIT',
        }),
      )
    }
  }
  return proposals
}
