import { buildProposal } from './helpers'
import type { DetectedSection } from '../types'
import type { ResumeFieldProposal } from '@/types/resume'

// 2-4 capitalized words, letters/hyphens/apostrophes only.
const NAME_SHAPE_RE = /^[A-Z][a-zA-Z'-]*(\s+[A-Z][a-zA-Z'-]*){1,3}$/

/**
 * Locked correction: this is a plausible heuristic that can misfire (a
 * subtitle, a mis-scoped section label, a two-word job title at the top
 * of a nonstandard layout) -- it stays at 'medium' confidence, never
 * 'high', with no stronger corroborating deterministic signal to promote
 * it in Phase 2.
 */
export function extractName(sections: DetectedSection[], sourceDocumentId: string): ResumeFieldProposal[] {
  const contact = sections.find((s) => s.kind === 'contact')
  if (!contact) return []

  for (const block of contact.blocks) {
    const text = block.text.trim()
    if (text.includes('@') || /\d/.test(text)) continue
    if (!NAME_SHAPE_RE.test(text)) continue

    return [
      buildProposal({
        candidateValue: text,
        destination: { kind: 'canonical-profile', field: 'full_name' },
        confidence: 'medium',
        sourceDocumentId,
        sectionKind: contact.kind,
        block,
        sourceExcerpt: text,
        matchedRule: 'NAME_HEURISTIC_FIRST_CAPITALIZED_LINE',
      }),
    ]
  }
  return []
}
